import { createServerClient as createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireMinimumRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify staff role or higher
    const authResult = await requireMinimumRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const supabase = createSupabaseServer()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Get all bookings (staff can view all bookings)
    let query = supabase
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
      .order('created_at', { ascending: false })

    // Apply filters if provided
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    const { data: bookings, error: bookingsError } = await query

    if (bookingsError) throw bookingsError

    // Get today's date
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // Filter today's check-ins and check-outs
    const todayCheckIns = bookings?.filter((booking: any) => {
      const checkInDate = new Date(booking.check_in)
      return checkInDate >= todayStart && checkInDate < todayEnd && booking.status === 'Confirmed'
    }) || []

    const todayCheckOuts = bookings?.filter((booking: any) => {
      const checkOutDate = new Date(booking.check_out)
      return checkOutDate >= todayStart && checkOutDate < todayEnd && booking.status === 'Checked-In'
    }) || []

    // Get booking statistics
    const totalBookings = bookings?.length || 0
    const pendingBookings = bookings?.filter((b: any) => b.status === 'Pending').length || 0
    const confirmedBookings = bookings?.filter((b: any) => b.status === 'Confirmed').length || 0
    const checkedInBookings = bookings?.filter((b: any) => b.status === 'Checked-In').length || 0
    const checkedOutBookings = bookings?.filter((b: any) => b.status === 'Checked-Out').length || 0

    // Calculate revenue from all bookings
    const bookingIds = bookings?.map((b: any) => b.id) || []
    let totalRevenue = 0

    if (bookingIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount_paid, booking_id')
        .in('booking_id', bookingIds)

      if (!paymentsError) {
        totalRevenue = payments?.reduce((sum: number, payment: any) => sum + payment.amount_paid, 0) || 0
      }
    }

    // Get staff's assigned bookings (for personal metrics)
    const { data: staffBookings, error: staffBookingsError } = await supabase
      .from('bookings')
      .select('*')
      .eq('staff_id', user.id)

    let staffRevenue = 0
    if (!staffBookingsError && staffBookings) {
      const staffBookingIds = staffBookings.map((b: any) => b.id)
      if (staffBookingIds.length > 0) {
        const { data: staffPayments, error: staffPaymentsError } = await supabase
          .from('payments')
          .select('amount_paid, booking_id')
          .in('booking_id', staffBookingIds)

        if (!staffPaymentsError) {
          staffRevenue = staffPayments?.reduce((sum: number, payment: any) => sum + payment.amount_paid, 0) || 0
        }
      }
    }

    return NextResponse.json({
      metrics: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        checkedInBookings,
        checkedOutBookings,
        todayCheckIns: todayCheckIns.length,
        todayCheckOuts: todayCheckOuts.length,
        totalRevenue,
        staffRevenue,
        staffBookingsCount: staffBookings?.length || 0
      },
      todayCheckIns,
      todayCheckOuts,
      recentBookings: bookings?.slice(0, 20) || [],
      filters: {
        status: status || 'all',
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      }
    })
  } catch (error) {
    console.error('Staff dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff dashboard data' },
      { status: 500 }
    )
  }
}
