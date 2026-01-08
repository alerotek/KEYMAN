import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

// Create booking with validation
export async function POST(request: Request) {
  try {
    const authResult = await requireRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, profile } = authResult
    const body = await request.json()
    const {
      customer_id,
      room_type_id,
      check_in,
      check_out,
      guests_count,
      breakfast = false,
      vehicle = false,
      notes
    } = body

    // Validate required fields
    if (!customer_id || !room_type_id || !check_in || !check_out || !guests_count) {
      return NextResponse.json(
        { error: 'Missing required booking fields' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    // Validate dates
    const checkInDate = new Date(check_in)
    const checkOutDate = new Date(check_out)
    const today = new Date()

    if (checkInDate < today) {
      return NextResponse.json(
        { error: 'Check-in date cannot be in the past' },
        { status: 400 }
      )
    }

    if (checkOutDate <= checkInDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      )
    }

    // Validate room capacity
    const { data: roomType, error: roomTypeError } = await supabase
      .from('room_types')
      .select('capacity, base_price, name, total_rooms')
      .eq('id', room_type_id)
      .eq('active', true)
      .single()

    if (roomTypeError || !roomType) {
      return NextResponse.json(
        { error: 'Invalid room type' },
        { status: 400 }
      )
    }

    if (guests_count > roomType.capacity) {
      return NextResponse.json(
        { error: `Room capacity is ${roomType.capacity} guests` },
        { status: 400 }
      )
    }

    // Check room availability
    const { data: availableRooms, error: availabilityError } = await supabase
      .rpc('get_available_rooms', {
        p_room_type_name: roomType.name,
        p_check_in: check_in,
        p_check_out: check_out
      })

    if (availabilityError) {
      console.error('Availability check error:', availabilityError)
      return NextResponse.json(
        { error: 'Failed to check room availability' },
        { status: 500 }
      )
    }

    const availableRoomCount = availableRooms?.filter((r: any) => r.is_available).length || 0

    if (availableRoomCount === 0) {
      return NextResponse.json(
        { error: 'No rooms available for selected dates' },
        { status: 400 }
      )
    }

    // Calculate total amount
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    const basePrice = roomType.base_price * nights
    const breakfastPrice = breakfast ? 10 * nights * guests_count : 0
    const vehiclePrice = vehicle ? 15 * nights : 0
    const totalAmount = basePrice + breakfastPrice + vehiclePrice

    // Get an available room
    const selectedRoom = availableRooms.find((r: any) => r.is_available)

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        customer_id,
        room_id: selectedRoom.room_id,
        room_type_id,
        check_in,
        check_out,
        guests_count,
        breakfast,
        vehicle,
        total_amount: totalAmount,
        status: 'Pending',
        notes,
        created_by: user.id
      }])
      .select()
      .single()

    if (bookingError) {
      console.error('Booking creation error:', bookingError)
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      )
    }

    // Log booking creation
    await supabase
      .from('audit_log')
      .insert({
        action: 'booking_created',
        entity: 'bookings',
        entity_id: booking.id,
        actor_id: user.id,
        actor_role: profile.role,
        before_state: null,
        after_state: {
          customer_id,
          room_type: roomType.name,
          check_in,
          check_out,
          guests_count,
          total_amount: totalAmount,
          status: 'Pending'
        },
        details: {
          created_by: profile.full_name,
          room_number: selectedRoom.room_number,
          nights,
          base_price: basePrice,
          breakfast_price: breakfastPrice,
          vehicle_price: vehiclePrice
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: 'Booking created successfully',
      booking: {
        ...booking,
        room_type: roomType.name,
        room_number: selectedRoom.room_number,
        nights,
        breakdown: {
          base_price: basePrice,
          breakfast_price: breakfastPrice,
          vehicle_price: vehiclePrice,
          total: totalAmount
        }
      }
    })

  } catch (error) {
    console.error('Booking creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}

// Get bookings with role-based filtering
export async function GET(request: Request) {
  try {
    const authResult = await requireRole('customer')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, profile } = authResult
    const { searchParams } = new URL(request.url)
    const customer_id = searchParams.get('customer_id')
    const status = searchParams.get('status')

    const supabase = supabaseServer()
    
    let query = supabase
      .from('bookings')
      .select(`
        id,
        status,
        created_at,
        check_in,
        check_out,
        total_amount,
        guests_count,
        breakfast,
        vehicle,
        room_type_id,
        customer_id,
        created_by,
        room_types!inner(name, capacity, base_price),
        customers!inner(full_name, email, phone),
        rooms!inner(room_number)
      `)

    // Apply role-based filtering
    if (profile.role === 'customer') {
      // Customers can only see their own bookings
      query = query.eq('customer_id', user.id)
    } else if (customer_id && (profile.role === 'staff' || profile.role === 'manager' || profile.role === 'admin')) {
      // Staff/Manager/Admin can filter by customer
      query = query.eq('customer_id', customer_id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Bookings fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      bookings: data || [],
      total_count: data?.length || 0
    })

  } catch (error) {
    console.error('Bookings API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

// Update booking status
export async function PATCH(request: Request) {
  try {
    const authResult = await requireRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, profile } = authResult
    const body = await request.json()
    const { booking_id, status, check_in_date, check_out_date } = body

    if (!booking_id || !status) {
      return NextResponse.json(
        { error: 'Booking ID and status are required' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    // Get current booking
    const { data: currentBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single()

    if (fetchError || !currentBooking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      'Pending': ['Confirmed', 'Cancelled'],
      'Confirmed': ['Checked-In', 'Cancelled'],
      'Checked-In': ['Checked-Out'],
      'Checked-Out': [],
      'Cancelled': []
    }

    if (!validTransitions[currentBooking.status as string]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${currentBooking.status} to ${status}` },
        { status: 400 }
      )
    }

    // Update booking
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (check_in_date) {
      updateData.check_in_date = check_in_date
    }

    if (check_out_date) {
      updateData.check_out_date = check_out_date
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', booking_id)
      .select()
      .single()

    if (updateError) {
      console.error('Booking update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update booking' },
        { status: 500 }
      )
    }

    // Log booking update
    await supabase
      .from('audit_log')
      .insert({
        action: 'booking_updated',
        entity: 'bookings',
        entity_id: booking_id,
        actor_id: user.id,
        actor_role: profile.role,
        before_state: { status: currentBooking.status },
        after_state: { status, check_in_date, check_out_date },
        details: {
          updated_by: profile.full_name,
          previous_status: currentBooking.status,
          new_status: status
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: `Booking status updated to ${status}`,
      booking: updatedBooking
    })

  } catch (error) {
    console.error('Booking update error:', error)
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    )
  }
}
      
