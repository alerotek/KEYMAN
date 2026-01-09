import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER'])
    
    const supabase = supabaseServer()
    const body = await req.json()

    const { booking_id, amount, payment_method, transaction_id } = body

    if (!booking_id || !amount || !payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields: booking_id, amount, payment_method' },
        { status: 400 }
      )
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id,
        amount,
        payment_method,
        payment_status: 'completed',
        transaction_id
      })
      .select()
      .single()

    if (paymentError) throw paymentError

    // Auto-confirm booking
    const { error: confirmError } = await supabase
      .rpc('confirm_booking_on_payment', { payment_id: payment.id })

    if (confirmError) throw confirmError

    // Get updated booking details
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        customers!bookings_customer_id_fkey (
          full_name,
          email
        ),
        rooms!bookings_room_id_fkey (
          room_number,
          room_type
        )
      `)
      .eq('id', booking_id)
      .single()

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_entity_type: 'payment',
      p_entity_id: payment.id,
      p_action: 'completed',
      p_new_values: { amount, payment_method, booking_id },
      p_metadata: { auto_confirmed: true }
    })

    // Create staff tasks for confirmed booking
    await supabase.rpc('create_booking_tasks', { booking_id })

    return NextResponse.json({
      payment,
      booking,
      message: 'Payment processed and booking confirmed successfully'
    })

  } catch (err: any) {
    console.error('Payment confirmation error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
