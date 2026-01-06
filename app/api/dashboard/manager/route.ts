import { createServerClient as createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireMinimumRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify manager role or higher
    const authResult = await requireMinimumRole('manager')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = createSupabaseServer()
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('dateRange') || '30'

    // Calculate date range
    const days = parseInt(dateRange)
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = new Date().toISOString().split('T')[0]

    // Get total revenue within date range
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount_paid, paid_at, method, booking_id')
      .gte('paid_at', startDate)
      .lte('paid_at', endDate)

    if (paymentsError) throw paymentsError

    const totalRevenue = payments?.reduce((sum: number, payment: any) => sum + payment.amount_paid, 0) || 0
    const paymentMethods = payments?.reduce((acc: any, payment: any) => {
      acc[payment.method] = (acc[payment.method] || 0) + payment.amount_paid
      return acc
    }, {} as Record<string, number>) || {}

    // Get booking statistics within date range
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        created_at,
        check_in,
        check_out,
        total_amount,
        guests_count,
        breakfast,
        vehicle,
        room_type_id,
        customer_id,
        created_by
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (bookingsError) throw bookingsError

    const totalBookings = bookings?.length || 0
    const pendingBookings = bookings?.filter((b: any) => b.status === 'Pending').length || 0
    const confirmedBookings = bookings?.filter((b: any) => b.status === 'Confirmed').length || 0
    const checkedInBookings = bookings?.filter((b: any) => b.status === 'Checked-In').length || 0
    const checkedOutBookings = bookings?.filter((b: any) => b.status === 'Checked-Out').length || 0
    const cancelledBookings = bookings?.filter((b: any) => b.status === 'Cancelled').length || 0

    // Get room occupancy
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, room_type, is_active, max_guests')

    if (roomsError) throw roomsError

    const totalRooms = rooms?.filter((r: any) => r.is_active).length || 0
    const occupiedRooms = checkedInBookings
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

    // Get room performance
    const roomPerformance = bookings?.reduce((acc: any, booking: any) => {
      const roomTypeId = booking.room_type_id || 'Unknown'
      
      if (!acc[roomTypeId]) {
        acc[roomTypeId] = {
          room_type_id: roomTypeId,
          booking_count: 0,
          total_revenue: 0,
          total_guests: 0
        }
      }
      
      acc[roomTypeId].booking_count++
      acc[roomTypeId].total_revenue += booking.total_amount || 0
      acc[roomTypeId].total_guests += booking.guests_count || 0
      
      return acc
    }, {} as Record<string, any>) || {}
    
    // Get staff performance
    const staffPerformance = bookings?.reduce((acc: any, booking: any) => {
      const createdById = booking.created_by || 'Unknown'
      
      if (!acc[createdById]) {
        acc[createdById] = {
          created_by: createdById,
          booking_count: 0,
          total_revenue: 0
        }
      }
      
      acc[createdById].booking_count++
      acc[createdById].total_revenue += booking.total_amount || 0
      
      return acc
    }, {} as Record<string, any>) || {}

    // Get daily revenue trend
    const dailyRevenue = payments?.reduce((acc: any, payment: any) => {
      const date = new Date(payment.paid_at).toISOString().split('T')[0]
      acc[date] = (acc[date] || 0) + payment.amount_paid
      return acc
    }, {} as Record<string, number>) || {}

    // Get vehicle usage
    const vehicleBookings = bookings?.filter((b: any) => b.vehicle === true).length || 0
    const vehicleRevenue = bookings?.filter((b: any) => b.vehicle === true).reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0) || 0

    // Get breakfast revenue
    const breakfastRevenue = bookings?.filter((b: any) => b.breakfast).reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0) || 0

    return NextResponse.json({
      metrics: {
        totalRevenue,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        checkedInBookings,
        checkedOutBookings,
        cancelledBookings,
        totalRooms,
        occupiedRooms,
        occupancyRate,
        vehicleBookings,
        vehicleRevenue,
        breakfastRevenue,
        averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0
      },
      paymentMethods,
      roomPerformance: Object.values(roomPerformance),
      dailyRevenue,
      recentBookings: bookings?.slice(0, 10) || [],
      dateRange: {
        start: startDate,
        end: endDate,
        days
      }
    })
  } catch (error) {
    console.error('Manager dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch manager dashboard data' },
      { status: 500 }
    )
  }
}
