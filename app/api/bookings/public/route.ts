import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendBookingConfirmationEmail } from '@/lib/email/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServer()
    
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('room_type', { ascending: true })

    if (roomsError) {
      console.error('Rooms API error:', roomsError)
      return NextResponse.json(
        { error: 'Failed to fetch rooms', details: roomsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ rooms: rooms || [] })
  } catch (error) {
    console.error('Rooms API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
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

    // Validate required fields
    if (!room_id || !check_in || !check_out || !guests_count || !customer_name || !customer_email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Get room details for pricing
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('room_type, base_price, breakfast_price')
      .eq('id', room_id)
      .single()

    if (roomError) {
      console.error('Room fetch error:', roomError)
      return NextResponse.json(
        { error: 'Room not found', details: roomError.message },
        { status: 404 }
      )
    }

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // Calculate nights
    const checkInDate = new Date(check_in)
    const checkOutDate = new Date(check_out)
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (nights <= 0) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      )
    }

    // Calculate pricing
    let basePrice = room.base_price
    let extraGuests = 0
    
    if (room.room_type === 'DOUBLE') {
      extraGuests = Math.max(guests_count - 2, 0)
      basePrice = basePrice + (extraGuests * 500)
    }
    
    const breakfastCost = breakfast ? (guests_count * room.breakfast_price * nights) : 0
    const vehicleCost = vehicle ? 1000 : 0
    const totalAmount = (basePrice * nights) + breakfastCost + vehicleCost

    // Create customer if not exists
    let customerId = customer_id
    if (!customerId) {
      // Check if customer already exists
      const { data: existingCustomer, error: findError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customer_email)
        .single()

      if (findError && findError.code !== 'PGRST116') {
        console.error('Customer lookup error:', findError)
        return NextResponse.json(
          { error: 'Failed to lookup customer', details: findError.message },
          { status: 500 }
        )
      }

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([{
            full_name: customer_name,
            email: customer_email
          }])
          .select()
          .single()

        if (customerError) {
          console.error('Customer creation error:', customerError)
          return NextResponse.json(
            { error: 'Failed to create customer', details: customerError.message },
            { status: 500 }
          )
        }
        customerId = newCustomer.id
      }
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
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
      }])
      .select(`
        *,
        rooms(room_type),
        customers(full_name, email)
      `)
      .single()

    if (bookingError) {
      console.error('Booking creation error:', bookingError)
      return NextResponse.json(
        { error: 'Failed to create booking', details: bookingError.message },
        { status: 500 }
      )
    }

    // Send booking confirmation email
    try {
      await sendBookingConfirmationEmail(booking)
    } catch (emailError) {
      console.error('Failed to send booking confirmation email:', emailError)
      // Don't fail the booking if email fails
    }

    return NextResponse.json({ 
      message: 'Booking created successfully',
      booking 
    })
  } catch (error) {
    console.error('Create booking error:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}
