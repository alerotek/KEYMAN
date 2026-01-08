import { createServerClient } from '@/lib/secureAuth'
import { NextResponse } from 'next/server'
import { sendBookingConfirmationEmail } from '@/lib/email/service'

export const dynamic = 'force-dynamic'

/* =========================
   GET — Fetch available rooms
========================= */
export async function GET() {
  try {
    const supabase = createServerClient()

    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('id, room_type, base_price, breakfast_price')
      .eq('is_active', true)
      .order('room_type', { ascending: true })

    if (error) {
      console.error('Rooms fetch error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ rooms: rooms ?? [] })
  } catch (err) {
    console.error('Rooms API crash:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/* =========================
   POST — Create booking
========================= */
export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    const {
      room_id,
      customer_id,
      check_in,
      check_out,
      guests_count,
      breakfast = false,
      vehicle = false,
      customer_name,
      customer_email,
      customer_phone
    } = body

    /* ---------- Validation ---------- */
    if (!room_id || !check_in || !check_out || !guests_count || !customer_name || !customer_email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    /* ---------- Fetch room ---------- */
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('room_type, base_price, breakfast_price')
      .eq('id', room_id)
      .single()

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    /* ---------- Date logic ---------- */
    const nights =
      (new Date(check_out).getTime() - new Date(check_in).getTime()) /
      (1000 * 60 * 60 * 24)

    if (nights <= 0) {
      return NextResponse.json(
        { error: 'Invalid check-in / check-out dates' },
        { status: 400 }
      )
    }

    /* ---------- Pricing ---------- */
    let basePrice = room.base_price
    let extraGuests = 0

    if (room.room_type === 'TWIN') {
      extraGuests = Math.max(guests_count - 2, 0)
      basePrice += extraGuests * 500
    }

    const breakfastCost = breakfast
      ? guests_count * room.breakfast_price * nights
      : 0

    const vehicleCost = vehicle ? 1000 : 0
    const totalAmount = basePrice * nights + breakfastCost + vehicleCost

    /* ---------- Customer ---------- */
    let customerId = customer_id

    if (!customerId) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customer_email)
        .maybeSingle()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert({
            full_name: customer_name,
            email: customer_email,
            phone: customer_phone
          })
          .select()
          .single()

        if (error) {
          return NextResponse.json(
            { error: 'Failed to create customer' },
            { status: 500 }
          )
        }

        customerId = newCustomer.id
      }
    }

    /* ---------- Conflict Check ---------- */
    const { data: conflictingBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', room_id)
      .in('status', ['Confirmed', 'Checked-In'])
      .or(
        `and(check_in.lte.${check_out}, check_out.gte.${check_in})`
      )

    if (conflictingBookings && conflictingBookings.length > 0) {
      return NextResponse.json(
        { error: 'Room is already booked for the selected dates' },
        { status: 409 }
      )
    }

    /* ---------- Booking ---------- */
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        room_id,
        customer_id: customerId,
        check_in,
        check_out,
        guests_count,
        breakfast,
        vehicle,
        base_price: basePrice,
        extras_price: breakfastCost + vehicleCost,
        total_amount: totalAmount,
        status: 'Pending'
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Booking error:', bookingError)
      return NextResponse.json(
        { error: bookingError.message },
        { status: 500 }
      )
    }

    /* ---------- Email ---------- */
    try {
      await sendBookingConfirmationEmail(booking)
    } catch (e) {
      console.warn('Email failed (non-blocking)')
    }

    return NextResponse.json({
      success: true,
      booking
    })
  } catch (err) {
    console.error('Booking API crash:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
