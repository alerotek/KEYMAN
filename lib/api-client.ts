// Server-side API client to avoid HTTP self-calls
import { createSupabaseServer } from '@/lib/supabase/server'
import { VehicleUsageReport, RoomPerformanceReport, StaffPerformanceReport, RepeatCustomersReport, DailyRevenue } from '@/lib/types'

export async function getVehicleUsageReport(startDate: string, endDate: string): Promise<VehicleUsageReport> {
  const supabase = createSupabaseServer()
  
  // Direct database query instead of HTTP call
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, vehicle, total_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .neq('status', 'Cancelled')

  if (error) throw error

  const totalBookings = bookings?.length || 0
  const vehicleBookings = bookings?.filter(b => b.vehicle).length || 0
  const totalVehicleRevenue = bookings?.filter(b => b.vehicle).reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

  return {
    total_bookings_with_vehicle: vehicleBookings,
    total_vehicle_revenue: totalVehicleRevenue,
    vehicle_booking_percentage: totalBookings > 0 ? (vehicleBookings / totalBookings) * 100 : 0
  }
}

export async function getDailyRevenue(date: string): Promise<DailyRevenue> {
  const supabase = createSupabaseServer()
  
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('total_amount')
    .eq('created_at::date', date)
    .neq('status', 'Cancelled')

  if (error) throw error

  const revenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

  return {
    date,
    revenue,
    bookings_count: bookings?.length || 0
  }
}

export async function getRoomPerformanceReport(startDate: string, endDate: string): Promise<RoomPerformanceReport[]> {
  const supabase = createSupabaseServer()
  
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      total_amount,
      rooms!inner(room_type, base_price)
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .neq('status', 'Cancelled')

  if (error) throw error

  // Group by room type
  const roomStats = bookings?.reduce((acc, booking) => {
    const roomType = (booking.rooms as any)?.room_type || 'Unknown'
    if (!acc[roomType]) {
      acc[roomType] = {
        total_bookings: 0,
        total_revenue: 0,
        room_type: roomType
      }
    }
    acc[roomType].total_bookings++
    acc[roomType].total_revenue += booking.total_amount || 0
    return acc
  }, {} as Record<string, any>)

  return Object.values(roomStats).map(stat => ({
    ...stat,
    average_revenue: stat.total_bookings > 0 ? stat.total_revenue / stat.total_bookings : 0,
    occupancy_rate: 0 // Would need room count for accurate calculation
  }))
}

export async function getStaffPerformanceReport(startDate: string, endDate: string): Promise<StaffPerformanceReport[]> {
  const supabase = createSupabaseServer()
  
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      total_amount,
      created_by,
      profiles!inner(full_name)
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .neq('status', 'Cancelled')

  if (error) throw error

  // Group by staff
  const staffStats = bookings?.reduce((acc, booking) => {
    const staffId = booking.created_by
    const staffName = (booking.profiles as any)?.full_name || 'Unknown'
    if (!acc[staffId]) {
      acc[staffId] = {
        staff_id: staffId,
        staff_name: staffName,
        total_bookings_created: 0,
        total_revenue: 0
      }
    }
    acc[staffId].total_bookings_created++
    acc[staffId].total_revenue += booking.total_amount || 0
    return acc
  }, {} as Record<string, any>)

  return Object.values(staffStats).map(stat => ({
    ...stat,
    average_booking_value: stat.total_bookings_created > 0 ? stat.total_revenue / stat.total_bookings_created : 0
  }))
}

export async function getRepeatCustomersReport(): Promise<RepeatCustomersReport[]> {
  const supabase = createSupabaseServer()
  
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      guest_id,
      profiles!inner(full_name)
    `)
    .not('guest_id', 'is', null)

  if (error) throw error

  // Group by customer and count bookings
  const customerStats = bookings?.reduce((acc, booking) => {
    const customerId = booking.guest_id
    const customerName = (booking.profiles as any)?.full_name || 'Unknown'
    if (!acc[customerId]) {
      acc[customerId] = {
        customer_id: customerId,
        customer_name: customerName,
        booking_count: 0,
        is_repeat_customer: false
      }
    }
    acc[customerId].booking_count++
    return acc
  }, {} as Record<string, any>)

  // Mark repeat customers
  Object.values(customerStats).forEach(stat => {
    stat.is_repeat_customer = stat.booking_count > 1
  })

  return Object.values(customerStats)
}
