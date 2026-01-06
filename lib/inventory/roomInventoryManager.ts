// Room Inventory Management System
// Enforces strict capacity limits and business rules

import { createSupabaseServer } from '@/lib/supabase/server'

export interface RoomType {
  id: string
  name: string
  total_rooms: number
  base_price: number
  description?: string
  amenities: Record<string, any>
  max_occupancy: number
  active: boolean
}

export interface RoomAvailability {
  total_rooms: number
  confirmed_bookings: number
  blocked_rooms: number
  overstays: number
  available_rooms: number
  occupancy_rate: number
  available_dates: Date[]
}

export interface BookingRequest {
  room_type_id: string
  check_in: string
  check_out: string
  customer_data: {
    full_name: string
    email: string
    phone: string
    id_number?: string
  }
}

export interface BookingValidation {
  is_available: boolean
  available_rooms: number
  total_price: number
  error_message?: string
  warnings?: string[]
}

export class RoomInventoryManager {
  private supabase: ReturnType<typeof createSupabaseServer>

  constructor() {
    this.supabase = createSupabaseServer()
  }

  // Get all active room types
  async getRoomTypes(): Promise<RoomType[]> {
    try {
      const { data, error } = await this.supabase
        .from('room_types')
        .select('*')
        .eq('active', true)
        .order('total_rooms', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching room types:', error)
      throw new Error('Failed to fetch room types')
    }
  }

  // Calculate availability for a room type and date range
  async calculateAvailability(
    roomTypeId: string,
    startDate: string,
    endDate: string
  ): Promise<RoomAvailability> {
    try {
      const { data, error } = await this.supabase
        .rpc('calculate_room_availability', {
          p_room_type_id: roomTypeId,
          p_start_date: startDate,
          p_end_date: endDate
        })

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error('Room type not found or inactive')
      }

      // Return the first (and only) result
      const result = data[0]
      return {
        total_rooms: result.total_rooms,
        confirmed_bookings: result.confirmed_bookings,
        blocked_rooms: result.blocked_rooms,
        overstays: result.overstays,
        available_rooms: result.available_rooms,
        occupancy_rate: result.occupancy_rate,
        available_dates: result.available_dates || []
      }
    } catch (error) {
      console.error('Error calculating availability:', error)
      throw new Error('Failed to calculate room availability')
    }
  }

  // Get current room price with seasonal overrides
  async getRoomPrice(
    roomTypeId: string,
    checkIn: string,
    checkOut: string
  ): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_room_price', {
          p_room_type_id: roomTypeId,
          p_check_in: checkIn,
          p_check_out: checkOut
        })

      if (error) throw error
      return data || 0
    } catch (error) {
      console.error('Error getting room price:', error)
      throw new Error('Failed to get room price')
    }
  }

  // Validate booking request
  async validateBookingRequest(
    request: BookingRequest
  ): Promise<BookingValidation> {
    try {
      // Check room type exists and is active
      const roomType = await this.supabase
        .from('room_types')
        .select('name, total_rooms, active')
        .eq('id', request.room_type_id)
        .eq('active', true)
        .single()

      if (!roomType.data) {
        return {
          is_available: false,
          available_rooms: 0,
          total_price: 0,
          error_message: 'Room type not found or inactive'
        }
      }

      // Calculate availability
      const availability = await this.calculateAvailability(
        request.room_type_id,
        request.check_in,
        request.check_out
      )

      // Get price
      const price = await this.getRoomPrice(
        request.room_type_id,
        request.check_in,
        request.check_out
      )

      // Calculate nights
      const nights = Math.ceil(
        (new Date(request.check_out).getTime() - new Date(request.check_in).getTime()) / 
        (1000 * 60 * 60 * 24)
      )
      const totalPrice = price * nights

      const warnings: string[] = []

      // Check warnings
      if (availability.occupancy_rate > 85) {
        warnings.push('High occupancy period - limited availability')
      }

      if (availability.overstays > 0) {
        warnings.push(`${availability.overstays} overstays detected - may affect availability`)
      }

      // Check if available
      if (availability.available_rooms <= 0) {
        return {
          is_available: false,
          available_rooms: 0,
          total_price: totalPrice,
          error_message: `No ${roomType.data.name} rooms available for selected dates`,
          warnings
        }
      }

      return {
        is_available: true,
        available_rooms: availability.available_rooms,
        total_price: totalPrice,
        warnings
      }

    } catch (error) {
      console.error('Error validating booking request:', error)
      return {
        is_available: false,
        available_rooms: 0,
        total_price: 0,
        error_message: 'Failed to validate booking request'
      }
    }
  }

  // Create booking with availability check
  async createBooking(request: BookingRequest): Promise<{
    success: boolean
    booking_id?: string
    error?: string
  }> {
    try {
      // First validate the request
      const validation = await this.validateBookingRequest(request)
      
      if (!validation.is_available) {
        return {
          success: false,
          error: validation.error_message || 'Room not available'
        }
      }

      // Create customer first
      const { data: customer, error: customerError } = await this.supabase
        .from('customers')
        .insert([{
          full_name: request.customer_data.full_name,
          email: request.customer_data.email,
          phone: request.customer_data.phone,
          id_number: request.customer_data.id_number
        }])
        .select()
        .single()

      if (customerError) throw customerError

      // Calculate price and nights
      const price = await this.getRoomPrice(
        request.room_type_id,
        request.check_in,
        request.check_out
      )
      
      const nights = Math.ceil(
        (new Date(request.check_out).getTime() - new Date(request.check_in).getTime()) / 
        (1000 * 60 * 60 * 24)
      )
      const totalAmount = price * nights

      // Create booking (trigger will prevent overbooking)
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .insert([{
          customer_id: customer.id,
          room_type_id: request.room_type_id,
          check_in: request.check_in,
          check_out: request.check_out,
          total_amount: totalAmount,
          status: 'Pending',
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (bookingError) {
        // Check if it's an overbooking error
        if (bookingError.message?.includes('No rooms available')) {
          return {
            success: false,
            error: 'Room was just booked by someone else. Please try different dates.'
          }
        }
        throw bookingError
      }

      // Log the booking creation
      await this.supabase
        .from('audit_log')
        .insert([{
          action: 'booking_created',
          details: {
            booking_id: booking.id,
            room_type_id: request.room_type_id,
            customer_email: request.customer_data.email,
            check_in: request.check_in,
            check_out: request.check_out,
            total_amount: totalAmount,
            availability_check: true
          },
          created_at: new Date().toISOString()
        }])

      return {
        success: true,
        booking_id: booking.id
      }

    } catch (error) {
      console.error('Error creating booking:', error)
      return {
        success: false,
        error: 'Failed to create booking'
      }
    }
  }

  // Get seasonal pricing for room type
  async getSeasonalPricing(roomTypeId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('seasonal_pricing')
        .select('*')
        .eq('room_type_id', roomTypeId)
        .eq('active', true)
        .order('start_date', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching seasonal pricing:', error)
      return []
    }
  }

  // Add seasonal pricing (admin/manager only)
  async addSeasonalPricing(
    roomTypeId: string,
    startDate: string,
    endDate: string,
    priceOverride: number,
    reason: string,
    createdBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('seasonal_pricing')
        .insert([{
          room_type_id: roomTypeId,
          start_date: startDate,
          end_date: endDate,
          price_override: priceOverride,
          reason,
          created_by: createdBy
        }])

      if (error) throw error

      // Log the pricing change
      await this.supabase
        .from('audit_log')
        .insert([{
          action: 'seasonal_pricing_added',
          details: {
            room_type_id: roomTypeId,
            start_date: startDate,
            end_date: endDate,
            price_override: priceOverride,
            reason,
            created_by: createdBy
          },
          created_at: new Date().toISOString()
        }])

      return { success: true }
    } catch (error) {
      console.error('Error adding seasonal pricing:', error)
      return { success: false, error: 'Failed to add seasonal pricing' }
    }
  }

  // Block rooms for maintenance/admin holds
  async blockRooms(
    roomTypeId: string,
    startDate: string,
    endDate: string,
    reason: 'maintenance' | 'admin_hold' | 'renovation' | 'emergency',
    description: string,
    blockedRooms: number,
    createdBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('room_blocks')
        .insert([{
          room_type_id: roomTypeId,
          start_date: startDate,
          end_date: endDate,
          reason,
          description,
          blocked_rooms: blockedRooms,
          created_by: createdBy
        }])

      if (error) throw error

      // Log the room block
      await this.supabase
        .from('audit_log')
        .insert([{
          action: 'rooms_blocked',
          details: {
            room_type_id: roomTypeId,
            start_date: startDate,
            end_date: endDate,
            reason,
            blocked_rooms: blockedRooms,
            created_by: createdBy
          },
          created_at: new Date().toISOString()
        }])

      return { success: true }
    } catch (error) {
      console.error('Error blocking rooms:', error)
      return { success: false, error: 'Failed to block rooms' }
    }
  }

  // Get active room blocks
  async getRoomBlocks(roomTypeId?: string): Promise<any[]> {
    try {
      let query = this.supabase
        .from('room_blocks')
        .select(`
          *,
          room_types(name)
        `)
        .gte('end_date', new Date().toISOString().split('T')[0])

      if (roomTypeId) {
        query = query.eq('room_type_id', roomTypeId)
      }

      const { data, error } = await query.order('start_date', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching room blocks:', error)
      return []
    }
  }

  // Detect and report overstays
  async detectOverstays(): Promise<{ overstays: number; details: any[] }> {
    try {
      // Call the overstay detection function
      const { error } = await this.supabase.rpc('detect_overstays')
      if (error) throw error

      // Get overstays details
      const { data, error: fetchError } = await this.supabase
        .from('bookings')
        .select(`
          id,
          check_out,
          customers(full_name, email, phone),
          room_types(name),
          overstay_detected
        `)
        .eq('overstay_detected', true)
        .eq('status', 'Checked-In')
        .lt('check_out', new Date().toISOString().split('T')[0])

      if (fetchError) throw fetchError

      return {
        overstays: data?.length || 0,
        details: data || []
      }
    } catch (error) {
      console.error('Error detecting overstays:', error)
      return { overstays: 0, details: [] }
    }
  }

  // Get dashboard data based on user role
  async getDashboardData(userRole: string): Promise<any> {
    try {
      const roomTypes = await this.getRoomTypes()
      const today = new Date().toISOString().split('T')[0]
      const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Base data for all roles
      const baseData = {
        room_types: roomTypes,
        today: today
      }

      // Role-specific data
      switch (userRole) {
        case 'admin':
          return {
            ...baseData,
            // Admin gets everything
            total_revenue: await this.getTotalRevenue(),
            occupancy_rates: await this.getOccupancyRates(),
            seasonal_pricing: await this.getAllSeasonalPricing(),
            room_blocks: await this.getRoomBlocks(),
            overstays: await this.detectOverstays(),
            daily_operations: await this.getDailyOperations()
          }

        case 'manager':
          return {
            ...baseData,
            // Manager gets most data except system settings
            occupancy_rates: await this.getOccupancyRates(),
            seasonal_pricing: await this.getAllSeasonalPricing(),
            room_blocks: await this.getRoomBlocks(),
            overstays: await this.detectOverstays(),
            daily_operations: await this.getDailyOperations()
          }

        case 'staff':
          return {
            ...baseData,
            // Staff gets operational data only
            todays_bookings: await this.getTodaysBookings(),
            pending_payments: await this.getPendingPayments(),
            overstays: await this.detectOverstays()
          }

        case 'customer':
          return {
            ...baseData,
            // Customer gets availability and pricing only
            availability: await this.getAvailabilitySnapshot(today, thirtyDaysLater)
          }

        default:
          return baseData
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      throw new Error('Failed to fetch dashboard data')
    }
  }

  // Helper methods for dashboard data
  private async getTotalRevenue(): Promise<number> {
    const { data } = await this.supabase
      .from('payments')
      .select('amount_paid')
      .eq('status', 'confirmed')
    
    return data?.reduce((sum, payment) => sum + payment.amount_paid, 0) || 0
  }

  private async getOccupancyRates(): Promise<any[]> {
    const roomTypes = await this.getRoomTypes()
    const today = new Date().toISOString().split('T')[0]
    
    const rates = []
    for (const roomType of roomTypes) {
      const availability = await this.calculateAvailability(
        roomType.id,
        today,
        today
      )
      rates.push({
        room_type_name: roomType.name,
        occupancy_rate: availability.occupancy_rate,
        available_rooms: availability.available_rooms
      })
    }
    return rates
  }

  private async getAllSeasonalPricing(): Promise<any[]> {
    const { data } = await this.supabase
      .from('seasonal_pricing')
      .select(`
        *,
        room_types(name)
      `)
      .eq('active', true)
      .order('start_date', { ascending: true })
    
    return data || []
  }

  private async getDailyOperations(): Promise<any> {
    const today = new Date().toISOString().split('T')[0]
    
    const [bookings, payments] = await Promise.all([
      this.supabase
        .from('bookings')
        .select('id, status, check_in, check_out')
        .eq('check_in', today),
      this.supabase
        .from('payments')
        .select('id, amount_paid, method')
        .like('created_at', `${today}%`)
    ])

    return {
      new_bookings: bookings.data?.length || 0,
      payments_received: payments.data?.length || 0,
      payment_total: payments.data?.reduce((sum, p) => sum + p.amount_paid, 0) || 0
    }
  }

  private async getTodaysBookings(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await this.supabase
      .from('bookings')
      .select(`
        id,
        status,
        check_in,
        check_out,
        customers(full_name, email),
        room_types(name)
      `)
      .or(`check_in.eq.${today},check_out.eq.${today}`)
    
    return data || []
  }

  private async getPendingPayments(): Promise<any[]> {
    const { data } = await this.supabase
      .from('bookings')
      .select(`
        id,
        total_amount,
        paid_amount,
        customers(full_name, email),
        room_types(name)
      `)
      .eq('status', 'Confirmed')
      .lt('paid_amount', this.supabase.rpc('total_amount'))
    
    return data || []
  }

  private async getAvailabilitySnapshot(startDate: string, endDate: string): Promise<any[]> {
    const roomTypes = await this.getRoomTypes()
    const availability = []

    for (const roomType of roomTypes) {
      const avail = await this.calculateAvailability(roomType.id, startDate, endDate)
      availability.push({
        room_type_name: roomType.name,
        total_rooms: avail.total_rooms,
        available_rooms: avail.available_rooms,
        base_price: roomType.base_price
      })
    }

    return availability
  }
}

