import { createServerClient as createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Require staff or higher role
    const authResult = await requireRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const body = await request.json()
    const { offline_payment, client_timestamp } = body

    if (!offline_payment) {
      return NextResponse.json(
        { error: 'Offline payment data is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Verify the booking exists and is confirmed
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, total_amount, paid_amount')
      .eq('id', offline_payment.booking_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    if (booking.status !== 'Confirmed') {
      return NextResponse.json(
        { error: 'Payment can only be added to confirmed bookings' },
        { status: 400 }
      )
    }

    // Check for duplicate payments
    const { data: existingPayments, error: paymentCheckError } = await supabase
      .from('payments')
      .select('id, amount_paid, method, paid_at')
      .eq('booking_id', offline_payment.booking_id)
      .eq('amount_paid', offline_payment.amount_paid)
      .eq('method', offline_payment.method)

    if (paymentCheckError) {
      console.error('Error checking for duplicate payments:', paymentCheckError)
      return NextResponse.json(
        { error: 'Failed to check for duplicate payments' },
        { status: 500 }
      )
    }

    // Check for potential duplicate
    const isDuplicate = existingPayments?.some((payment: any) => {
      const paymentTime = new Date(payment.paid_at).getTime()
      const offlineTime = new Date(offline_payment.created_at).getTime()
      const timeDiff = Math.abs(paymentTime - offlineTime)
      
      return timeDiff < 60000 // Within 1 minute
    })

    if (isDuplicate) {
      return NextResponse.json({
        success: false,
        conflict: true,
        message: 'Duplicate payment detected',
        existing_payments: existingPayments
      })
    }

    // Calculate new paid amount
    const newPaidAmount = (booking.paid_amount || 0) + offline_payment.amount_paid
    const isFullyPaid = newPaidAmount >= booking.total_amount

    // Create payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id: offline_payment.booking_id,
        amount_paid: offline_payment.amount_paid,
        method: offline_payment.method,
        receipt_file: offline_payment.receipt_file,
        paid_at: offline_payment.created_at,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment:', paymentError)
      return NextResponse.json(
        { error: 'Failed to create payment' },
        { status: 500 }
      )
    }

    // Update booking paid amount and status if fully paid
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        paid_amount: newPaidAmount,
        status: isFullyPaid ? 'Checked-In' : 'Confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', offline_payment.booking_id)

    if (updateError) {
      console.error('Error updating booking:', updateError)
      return NextResponse.json(
        { error: 'Failed to update booking' },
        { status: 500 }
      )
    }

    // Log the sync action
    await supabase
      .from('audit_log')
      .insert([{
        action: 'offline_payment_sync',
        details: {
          offline_payment_id: offline_payment.id,
          server_payment_id: payment.id,
          booking_id: offline_payment.booking_id,
          amount_paid: offline_payment.amount_paid,
          method: offline_payment.method,
          staff_email: user.email,
          client_timestamp,
          server_timestamp: new Date().toISOString(),
          booking_fully_paid: isFullyPaid,
          status: 'synced'
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      server_payment_id: payment.id,
      booking_id: offline_payment.booking_id,
      is_fully_paid: isFullyPaid,
      new_paid_amount: newPaidAmount,
      message: 'Offline payment synced successfully'
    })

  } catch (error) {
    console.error('Offline payment sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync offline payment' },
      { status: 500 }
    )
  }
}
