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

    // Get customer's bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        rooms(room_type, room_number),
        payments(amount_paid, method, paid_at)
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })

    if (bookingsError) throw bookingsError

    // Calculate customer's total payments
    const totalPayments = bookings?.reduce((sum, booking) => {
      const bookingPayments = (booking.payments as any[]) || []
      return sum + bookingPayments.reduce((paymentSum: number, payment: any) => paymentSum + payment.amount_paid, 0)
    }, 0) || 0

    // Get booking statistics
    const totalBookings = bookings?.length || 0
    const pendingBookings = bookings?.filter(b => b.status === 'Pending').length || 0
    const confirmedBookings = bookings?.filter(b => b.status === 'Confirmed').length || 0
    const activeBookings = bookings?.filter(b => ['Confirmed', 'Checked-In'].includes(b.status)).length || 0

    return NextResponse.json({
      metrics: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        activeBookings,
        totalPayments
      },
      bookings: bookings || []
    })
  } catch (error) {
    console.error('Customer dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer dashboard data' },
      { status: 500 }
    )
  }
}
