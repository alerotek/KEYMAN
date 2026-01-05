import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = createSupabaseServer()
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('dateRange') || '30'
    const reportType = searchParams.get('reportType')

    // Calculate date range
    const days = parseInt(dateRange)
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = new Date().toISOString().split('T')[0]

    // Get total revenue within date range
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount_paid, paid_at, method')
      .gte('paid_at', startDate)
      .lte('paid_at', endDate)

    if (paymentsError) throw paymentsError

    const totalRevenue = payments?.reduce((sum, payment) => sum + payment.amount_paid, 0) || 0
    const paymentMethods = payments?.reduce((acc, payment) => {
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
        rooms(room_type, base_price),
        customers(full_name, email),
        staff(full_name, role)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (bookingsError) throw bookingsError

    const totalBookings = bookings?.length || 0
    const pendingBookings = bookings?.filter(b => b.status === 'Pending').length || 0
    const confirmedBookings = bookings?.filter(b => b.status === 'Confirmed').length || 0
    const checkedInBookings = bookings?.filter(b => b.status === 'Checked-In').length || 0
    const checkedOutBookings = bookings?.filter(b => b.status === 'Checked-Out').length || 0
    const cancelledBookings = bookings?.filter(b => b.status === 'Cancelled').length || 0

    // Get room occupancy
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, room_type, is_active, max_guests')

    if (roomsError) throw roomsError

    const totalRooms = rooms?.filter(r => r.is_active).length || 0
    const occupiedRooms = checkedInBookings
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

    // Get room performance
    const roomPerformance = bookings?.reduce((acc, booking) => {
      const roomData = booking.rooms as any
      const roomType = roomData?.room_type || 'Unknown'
      
      if (!acc[roomType]) {
        acc[roomType] = {
          room_type: roomType,
          booking_count: 0,
          total_revenue: 0,
          total_guests: 0
        }
      }
      
      acc[roomType].booking_count++
      acc[roomType].total_revenue += booking.total_amount || 0
      acc[roomType].total_guests += booking.guests_count || 0
      
      return acc
    }, {} as Record<string, any>) || {}

    // Get staff performance
    const staffPerformance = bookings?.reduce((acc, booking) => {
      const staffData = booking.staff as any
      if (!staffData) return acc
      
      const staffId = staffData.full_name
      
      if (!acc[staffId]) {
        acc[staffId] = {
          staff_name: staffData.full_name,
          role: staffData.role,
          booking_count: 0,
          total_revenue: 0
        }
      }
      
      acc[staffId].booking_count++
      acc[staffId].total_revenue += booking.total_amount || 0
      
      return acc
    }, {} as Record<string, any>) || {}

    // Get daily revenue trend
    const dailyRevenue = payments?.reduce((acc, payment) => {
      const date = new Date(payment.paid_at).toISOString().split('T')[0]
      acc[date] = (acc[date] || 0) + payment.amount_paid
      return acc
    }, {} as Record<string, number>) || {}

    // Get vehicle usage
    const vehicleBookings = bookings?.filter(b => b.vehicle).length || 0
    const vehicleRevenue = bookings?.filter(b => b.vehicle).reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

    // Get breakfast revenue
    const breakfastRevenue = bookings?.filter(b => b.breakfast).reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

    const response = {
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
      staffPerformance: Object.values(staffPerformance),
      dailyRevenue,
      recentBookings: bookings?.slice(0, 10) || [],
      dateRange: {
        start: startDate,
        end: endDate,
        days
      }
    }

    // Handle PDF export request
    if (reportType === 'pdf') {
      return NextResponse.json({
        ...response,
        exportData: {
          title: 'Keyman Hotel - Admin Report',
          generatedAt: new Date().toISOString(),
          dateRange: `${startDate} to ${endDate}`,
          metrics: response.metrics,
          roomPerformance: response.roomPerformance,
          staffPerformance: response.staffPerformance,
          paymentMethods: response.paymentMethods
        }
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Admin dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin dashboard data' },
      { status: 500 }
    )
  }
}
