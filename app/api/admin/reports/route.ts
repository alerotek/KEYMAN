import { createServerClient as createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createSupabaseServer()
    
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Get all reports data
    const [vehicleUsageResult, dailyRevenueResult, roomPerformanceResult, staffPerformanceResult, repeatCustomersResult] = await Promise.all([
      // Vehicle usage report
      supabase
        .from('bookings')
        .select('vehicle, total_amount')
        .gte('created_at', thirtyDaysAgo)
        .lte('created_at', today)
        .neq('status', 'Cancelled'),
      
      // Daily revenue
      supabase
        .from('payments')
        .select('amount_paid, paid_at')
        .gte('paid_at', today)
        .lte('paid_at', today),
      
      // Room performance
      supabase
        .from('bookings')
        .select(`
          rooms(room_type),
          total_amount
        `)
        .gte('created_at', thirtyDaysAgo)
        .lte('created_at', today)
        .neq('status', 'Cancelled'),
      
      // Staff performance
      supabase
        .from('bookings')
        .select(`
          staff_id,
          total_amount,
          staff!bookings_staff_id_fkey(
            full_name,
            role
          )
        `)
        .gte('created_at', thirtyDaysAgo)
        .lte('created_at', today)
        .neq('status', 'Cancelled')
        .not('staff_id', 'is', null),
      
      // Repeat customers
      supabase
        .from('bookings')
        .select('customer_id')
        .neq('status', 'Cancelled')
    ])

    // Handle errors
    if (vehicleUsageResult.error) throw vehicleUsageResult.error
    if (dailyRevenueResult.error) throw dailyRevenueResult.error
    if (roomPerformanceResult.error) throw roomPerformanceResult.error
    if (staffPerformanceResult.error) throw staffPerformanceResult.error
    if (repeatCustomersResult.error) throw repeatCustomersResult.error

    const vehicleUsage = vehicleUsageResult.data || []
    const dailyRevenue = dailyRevenueResult.data || []
    const roomPerformance = roomPerformanceResult.data || []
    const staffPerformance = staffPerformanceResult.data || []
    const repeatCustomers = repeatCustomersResult.data || []

    // Process vehicle usage
    const totalBookings = vehicleUsage.length || 0
    const vehicleBookings = vehicleUsage.filter((b: any) => b.vehicle).length || 0
    const vehicleBookingPercentage = totalBookings > 0 ? (vehicleBookings / totalBookings) * 100 : 0

    // Process daily revenue
    const revenue = dailyRevenue.reduce((sum: number, payment: any) => sum + payment.amount_paid, 0) || 0
    const bookingsCount = dailyRevenue.length || 0

    // Process room performance
    const roomStats = roomPerformance.reduce((acc: Record<string, any>, booking: any) => {
      const roomType = booking.rooms?.room_type || 'Unknown'
      if (!acc[roomType]) {
        acc[roomType] = { count: 0, revenue: 0 }
      }
      acc[roomType].count++
      acc[roomType].revenue += booking.total_amount || 0
      return acc
    }, {} as Record<string, any>)

    // Process staff performance
    const staffStats = staffPerformance.reduce((acc: Record<string, any>, booking: any) => {
      const staffId = booking.staff_id
      const staff = booking.staff
      
      if (!acc[staffId]) {
        acc[staffId] = {
          staff_id: staffId,
          staff_name: staff?.full_name || 'Unknown',
          role: staff?.role || 'Unknown',
          booking_count: 0,
          total_revenue: 0
        }
      }
      
      acc[staffId].booking_count++
      acc[staffId].total_revenue += booking.total_amount || 0
      
      return acc
    }, {} as Record<string, any>)

    // Process repeat customers
    const customerBookings = repeatCustomers.reduce((acc: Record<string, number>, booking: any) => {
      const customerId = booking.customer_id
      if (!acc[customerId]) {
        acc[customerId] = 0
      }
      acc[customerId]++
      return acc
    }, {} as Record<string, number>)

    const repeatCustomersList = Object.entries(customerBookings)
      .filter(([_, count]) => (count as number) > 1)
      .map(([customerId, count]) => ({
        customer_id: customerId,
        booking_count: count
      }))

    return NextResponse.json({
      vehicleUsage: {
        total_bookings: totalBookings,
        vehicle_bookings: vehicleBookings,
        vehicle_booking_percentage: vehicleBookingPercentage
      },
      daily: {
        revenue,
        bookings_count: bookingsCount
      },
      roomPerformance: Object.entries(roomStats).map(([roomType, stats]) => ({
        room_type: roomType,
        booking_count: (stats as any).count,
        total_revenue: (stats as any).revenue
      })),
      staffPerformance: Object.values(staffStats),
      repeatCustomers: repeatCustomersList
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
