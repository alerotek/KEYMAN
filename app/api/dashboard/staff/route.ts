import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify staff role
    const authResult = await requireRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const supabase = createSupabaseServer()

    // Get today's date
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // Get staff's assigned bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        rooms(room_type, room_number),
        customers(full_name, email, phone)
      `)
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false })

    if (bookingsError) throw bookingsError

    // Filter today's check-ins and check-outs
    const todayCheckIns = bookings?.filter(booking => {
      const checkInDate = new Date(booking.check_in)
      return checkInDate >= todayStart && checkInDate < todayEnd && booking.status === 'Confirmed'
    }) || []

    const todayCheckOuts = bookings?.filter(booking => {
      const checkOutDate = new Date(booking.check_out)
      return checkOutDate >= todayStart && checkOutDate < todayEnd && booking.status === 'Checked-In'
    }) || []

    // Get staff's performance metrics
    const totalBookings = bookings?.length || 0
    const pendingBookings = bookings?.filter(b => b.status === 'Pending').length || 0
    const confirmedBookings = bookings?.filter(b => b.status === 'Confirmed').length || 0
    const checkedInBookings = bookings?.filter(b => b.status === 'Checked-In').length || 0

    // Calculate revenue from staff's bookings
    const bookingIds = bookings?.map(b => b.id) || []
    let staffRevenue = 0

    if (bookingIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount_paid, booking_id')
        .in('booking_id', bookingIds)

      if (!paymentsError) {
        staffRevenue = payments?.reduce((sum, payment) => sum + payment.amount_paid, 0) || 0
      }
    }

    return NextResponse.json({
      metrics: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        checkedInBookings,
        todayCheckIns: todayCheckIns.length,
        todayCheckOuts: todayCheckOuts.length,
        staffRevenue
      },
      todayCheckIns,
      todayCheckOuts,
      recentBookings: bookings?.slice(0, 10) || []
    })
  } catch (error) {
    console.error('Staff dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff dashboard data' },
      { status: 500 }
    )
  }
}
