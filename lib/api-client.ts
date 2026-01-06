// Server-side API client to avoid HTTP self-calls
// @ts-nocheck

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for better type safety
interface Booking {
  id: string
  vehicle?: boolean
  total_amount?: number
  created_at?: string
  rooms?: {
    room_type?: string
  }
}

interface Payment {
  booking_id: string
  amount?: number
  paid_at?: string
}

interface RoomStats {
  total_bookings: number
  total_revenue: number
  room_type: string
}

interface DailyRevenue {
  date: string
  revenue: number
  bookings_count: number
}

interface RoomPerformanceReport {
  room_type: string
  total_bookings: number
  total_revenue: number
  average_revenue: number
  occupancy_rate: number
}

interface VehicleUsageReport {
  total_bookings_with_vehicle: number
  total_vehicle_revenue: number
  vehicle_booking_percentage: number
}

interface StaffPerformanceReport {
  staff_id: string
  staff_name: string
  total_bookings_created: number
  total_revenue: number
  average_booking_value: number
}

interface RepeatCustomersReport {
  customer_id: string
  customer_name: string
  booking_count: number
  is_repeat_customer: boolean
}

export async function getVehicleUsageReport(startDate: string, endDate: string): Promise<VehicleUsageReport> {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, vehicle, total_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .neq('status', 'Cancelled')

  if (error) throw error

  const totalBookings = bookings?.length || 0
  const vehicleBookings = bookings?.filter((b: Booking) => b.vehicle).length || 0
  const totalVehicleRevenue = bookings?.filter((b: Booking) => b.vehicle).reduce((sum: number, b: Booking) => sum + (b.total_amount || 0), 0) || 0

  return {
    total_bookings_with_vehicle: vehicleBookings,
    total_vehicle_revenue: totalVehicleRevenue,
    vehicle_booking_percentage: totalBookings > 0 ? (vehicleBookings / totalBookings) * 100 : 0
  }
}

export async function getDailyRevenue(date: string): Promise<DailyRevenue> {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, total_amount')
    .eq('created_at::date', date)
    .neq('status', 'Cancelled')

  if (error) throw error

  const totalBookings = bookings?.length || 0
  const revenue = bookings?.reduce((sum: number, b: Booking) => sum + (b.total_amount || 0), 0) || 0

  return {
    date,
    revenue,
    bookings_count: totalBookings
  }
}

export async function getRoomPerformanceReport(startDate: string, endDate: string): Promise<RoomPerformanceReport[]> {
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
  const roomStats = bookings?.reduce((acc: Record<string, RoomStats>, booking: Booking) => {
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
  }, {} as Record<string, RoomStats>)

  return Object.values(roomStats).map(stat => ({
    ...stat,
    average_revenue: stat.total_bookings > 0 ? stat.total_revenue / stat.total_bookings : 0,
    occupancy_rate: 0 // Would need room count for accurate calculation
  }))
}

export async function getStaffPerformanceReport(startDate: string, endDate: string): Promise<StaffPerformanceReport[]> {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      total_amount,
      staff_id,
      staff!bookings_staff_id_fkey(
        full_name,
        role
      )
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .neq('status', 'Cancelled')

  if (error) throw error

  // Group by staff
  const staffStats = bookings?.reduce((acc: Record<string, StaffPerformanceReport>, booking: Booking) => {
    const staffId = booking.staff_id
    const staffName = (booking.staff as any)?.full_name || 'Unknown'
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
  }, {} as Record<string, StaffPerformanceReport>)

  return Object.values(staffStats).map(stat => ({
    ...stat,
    average_booking_value: stat.total_bookings_created > 0 ? stat.total_revenue / stat.total_bookings_created : 0
  }))
}

export async function getRepeatCustomersReport(): Promise<RepeatCustomersReport[]> {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      customer_id,
      customers!bookings_customer_id_fkey(
        full_name,
        email
      )
    `)
    .not('customer_id', 'is', null)

  if (error) throw error

  // Group by customer and count bookings
  const customerStats = bookings?.reduce((acc, booking) => {
    const customerId = booking.customer_id
    const customerName = (booking.customers as any)?.full_name || 'Unknown'
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
