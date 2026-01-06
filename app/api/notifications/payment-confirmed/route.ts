import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireMinimumRole } from '@/lib/auth/requireRole'
import { sendPaymentConfirmationEmail } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Verify staff role or higher for payment confirmation
    const authResult = await requireMinimumRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { paymentId, bookingId } = body

    if (!paymentId || !bookingId) {
      return NextResponse.json(
        { error: 'Payment ID and Booking ID are required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        rooms(room_type),
        customers(full_name, email),
        staff(full_name, role)
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Send payment confirmation email
    const emailResult = await sendPaymentConfirmationEmail(payment, booking)

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Failed to send payment confirmation email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Payment confirmation email sent successfully'
    })

  } catch (error) {
    console.error('Payment notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send payment notification' },
      { status: 500 }
    )
  }
}
