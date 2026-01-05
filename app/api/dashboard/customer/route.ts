import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify customer role
    const authResult = await requireRole('customer')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const supabase = createSupabaseServer()

    // Get customer's bookings with related data
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        rooms(room_type),
        customers(full_name, email)
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })

    if (bookingsError) throw bookingsError

    // Get payments for customer's bookings
    const bookingIds = bookings?.map(b => b.id) || []
    let payments = []
    
    if (bookingIds.length > 0) {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .in('booking_id', bookingIds)
        .order('paid_at', { ascending: false })

      if (!paymentsError) {
        payments = paymentsData || []
      }
    }

    // Calculate customer's total payments
    const totalPayments = payments?.reduce((sum, payment) => sum + payment.amount_paid, 0) || 0

    // Get booking statistics
    const totalBookings = bookings?.length || 0
    const pendingBookings = bookings?.filter(b => b.status === 'Pending').length || 0
    const confirmedBookings = bookings?.filter(b => b.status === 'Confirmed').length || 0
    const checkedInBookings = bookings?.filter(b => b.status === 'Checked-In').length || 0
    const checkedOutBookings = bookings?.filter(b => b.status === 'Checked-Out').length || 0
    const activeBookings = bookings?.filter(b => ['Confirmed', 'Checked-In'].includes(b.status)).length || 0

    // Get upcoming bookings
    const today = new Date()
    const upcomingBookings = bookings?.filter(booking => {
      const checkInDate = new Date(booking.check_in)
      return checkInDate >= today && ['Confirmed', 'Pending'].includes(booking.status)
    }) || []

    // Get past bookings
    const pastBookings = bookings?.filter(booking => {
      const checkOutDate = new Date(booking.check_out)
      return checkOutDate < today || booking.status === 'Checked-Out'
    }) || []

    return NextResponse.json({
      metrics: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        checkedInBookings,
        checkedOutBookings,
        activeBookings,
        totalPayments,
        upcomingBookings: upcomingBookings.length,
        pastBookings: pastBookings.length
      },
      bookings: bookings || [],
      payments: payments || [],
      upcomingBookings,
      pastBookings
    })
  } catch (error) {
    console.error('Customer dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer dashboard data' },
      { status: 500 }
    )
  }
}
