import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import jsPDF from 'jspdf'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request, 
  { params }: { params: { booking_id: string } }
) {
  try {
    const supabase = supabaseServer()
    const bookingId = params.booking_id

    // Get booking with all related data
    const { data: booking, error: bookingError } = await supabase
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
        ),
        payments (
          amount,
          payment_method,
          payment_date,
          payment_status
        )
      `)
      .eq('id', bookingId)
      .eq('status', 'Confirmed')
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Confirmed booking not found' },
        { status: 404 }
      )
    }

    // Calculate nights
    const checkIn = new Date(booking.check_in)
    const checkOut = new Date(booking.check_out)
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    // Generate PDF
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.width
    const margin = 20
    let yPosition = margin

    // Helper function for adding text
    const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
      pdf.setFontSize(fontSize)
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal')
      pdf.text(text, margin, yPosition)
      yPosition += fontSize * 0.5 + 2
    }

    // Header
    addText('KEYMAN HOTEL - INVOICE', 20, true)
    addText('Invoice #: ' + bookingId.toUpperCase(), 14)
    yPosition += 10

    // Customer Information
    addText('BILL TO:', 12, true)
    addText(booking.customers.full_name)
    addText(booking.customers.email)
    yPosition += 10

    // Booking Details
    addText('BOOKING DETAILS:', 12, true)
    addText(`Room Number: ${booking.rooms.room_number}`)
    addText(`Room Type: ${booking.rooms.room_type}`)
    addText(`Check-in: ${checkIn.toLocaleDateString()}`)
    addText(`Check-out: ${checkOut.toLocaleDateString()}`)
    addText(`Number of Nights: ${nights}`)
    addText(`Guests: ${booking.guests_count}`)
    yPosition += 10

    // Cost Breakdown
    addText('COST BREAKDOWN:', 12, true)
    addText(`Room Rate: $${booking.base_price.toFixed(2)} x ${nights} nights = $${(booking.base_price * nights).toFixed(2)}`)
    
    if (booking.breakfast) {
      const breakfastTotal = booking.breakfast_price * booking.guests_count * nights
      addText(`Breakfast: $${booking.breakfast_price.toFixed(2)} x ${booking.guests_count} guests x ${nights} nights = $${breakfastTotal.toFixed(2)}`)
    }
    
    addText('Vehicle Parking: FREE')
    yPosition += 10

    // Total
    addText(`TOTAL AMOUNT: $${booking.total_amount.toFixed(2)}`, 14, true)
    yPosition += 10

    // Payment Information
    if (booking.payments && booking.payments.length > 0) {
      addText('PAYMENT INFORMATION:', 12, true)
      booking.payments.forEach(payment => {
        if (payment.payment_status === 'completed') {
          addText(`Paid: $${payment.amount.toFixed(2)} via ${payment.payment_method} on ${new Date(payment.payment_date).toLocaleDateString()}`)
        }
      })
    }

    // Footer
    yPosition = pdf.internal.pageSize.height - 40
    addText('Thank you for choosing Keyman Hotel!', 10)
    addText('For inquiries: contact@keymanhotel.com', 10)
    addText('Vehicle parking is included free of charge', 10)

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

    // Return PDF with proper headers
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${bookingId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })

  } catch (err: any) {
    console.error('Invoice generation error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
