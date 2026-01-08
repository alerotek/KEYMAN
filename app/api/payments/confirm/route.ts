import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireMinimumRole } from '@/lib/auth/requireRole'
import { sendPaymentConfirmationEmail } from '@/lib/email/service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Verify staff role or higher
    const authResult = await requireMinimumRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = supabaseServer()
    const formData = await request.formData()
    
    const bookingId = formData.get('bookingId') as string
    const paymentMethod = formData.get('paymentMethod') as string
    const amountPaid = parseFloat(formData.get('amountPaid') as string)
    const receiptFile = formData.get('receipt') as File

    if (!bookingId || !paymentMethod || !amountPaid) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, paymentMethod, amountPaid' },
        { status: 400 }
      )
    }

    // Validate booking exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Validate amount matches booking
    if (amountPaid !== booking.total_amount) {
      return NextResponse.json(
        { error: 'Payment amount does not match booking total' },
        { status: 400 }
      )
    }

    // Handle file upload if provided
    let receiptUrl = null
    if (receiptFile) {
      try {
        // In production, you would upload to a service like S3, Cloudinary, or Supabase Storage
        // For now, we'll simulate the upload and store the file info
        const fileName = `receipt-${bookingId}-${Date.now()}-${receiptFile.name}`
        
        // Create a record in the objects table for the receipt
        const { data: objectData, error: objectError } = await supabase
          .from('objects')
          .insert([{
            name: fileName,
            type: receiptFile.type,
            size: receiptFile.size,
            bucket: 'receipts',
            booking_id: bookingId,
            created_at: new Date().toISOString()
          }])
          .select('id')
          .single()

        if (!objectError && objectData) {
          receiptUrl = `/receipts/${objectData.id}`
        }
      } catch (uploadError) {
        console.error('File upload error:', uploadError)
        // Continue without file upload
      }
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        booking_id: bookingId,
        amount_paid: amountPaid,
        method: paymentMethod.toLowerCase(),
        receipt_url: receiptUrl,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single()

    if (paymentError) {
      console.error('Payment creation error:', paymentError)
      return NextResponse.json(
        { error: 'Failed to create payment record' },
        { status: 500 }
      )
    }

    // Update booking status to confirmed
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: 'Confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Booking status update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update booking status' },
        { status: 500 }
      )
    }

    // Get updated booking with customer info for email
    const { data: updatedBooking } = await supabase
      .from('bookings')
      .select(`
        *,
        customers(full_name, email),
        rooms(room_type)
      `)
      .eq('id', bookingId)
      .single()

    // Send confirmation email (in production)
    try {
      await sendPaymentConfirmationEmail(payment, updatedBooking)
      console.log('Payment confirmation email sent for booking:', bookingId)
    } catch (emailError) {
      console.error('Email error:', emailError)
      // Don't fail the payment if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Payment confirmed successfully',
      payment: {
        id: payment?.id,
        booking_id: bookingId,
        amount_paid: amountPaid,
        method: paymentMethod,
        receipt_url: receiptUrl
      },
      booking: updatedBooking
    })

  } catch (error) {
    console.error('Payment confirmation error:', error)
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
