import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { sendBookingConfirmationEmail } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Verify booking creation trigger (could be from any authenticated user)
    const authResult = await requireRole('guest')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { bookingId } = body

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    // Get booking details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        rooms(room_type),
        customers(full_name, email),
        staff(full_name, role)
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Send booking confirmation email
    const emailResult = await sendBookingConfirmationEmail(booking)

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Failed to send booking confirmation email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Booking confirmation email sent successfully'
    })

  } catch (error) {
    console.error('Booking notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send booking notification' },
      { status: 500 }
    )
  }
}
