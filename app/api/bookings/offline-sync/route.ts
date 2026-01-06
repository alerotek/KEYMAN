import { createSupabaseServer } from '@/lib/supabase/server'
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
    const { offline_booking, client_timestamp } = body

    if (!offline_booking) {
      return NextResponse.json(
        { error: 'Offline booking data is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Check for potential conflicts
    const { data: existingBookings, error: checkError } = await supabase
      .from('bookings')
      .select('id, check_in, check_out, room_id')
      .eq('check_in', offline_booking.roomData.check_in)
      .eq('room_id', offline_booking.roomData.room_id)

    if (checkError) {
      console.error('Error checking for conflicts:', checkError)
      return NextResponse.json(
        { error: 'Failed to check for conflicts' },
        { status: 500 }
      )
    }

    // Check for date conflicts
    const hasConflict = existingBookings?.some(booking => {
      const existingCheckIn = new Date(booking.check_in)
      const existingCheckOut = new Date(booking.check_out)
      const newCheckIn = new Date(offline_booking.roomData.check_in)
      const newCheckOut = new Date(offline_booking.roomData.check_out)

      return (
        (newCheckIn >= existingCheckIn && newCheckIn < existingCheckOut) ||
        (newCheckOut > existingCheckIn && newCheckOut <= existingCheckOut) ||
        (newCheckIn <= existingCheckIn && newCheckOut >= existingCheckOut)
      )
    })

    if (hasConflict) {
      return NextResponse.json({
        success: false,
        conflict: true,
        message: 'Booking conflicts with existing reservation',
        existing_bookings: existingBookings
      })
    }

    // Create customer first
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        full_name: offline_booking.customerData.full_name,
        email: offline_booking.customerData.email,
        phone: offline_booking.customerData.phone,
        id_number: offline_booking.customerData.id_number,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (customerError) {
      console.error('Error creating customer:', customerError)
      return NextResponse.json(
        { error: 'Failed to create customer' },
        { status: 500 }
      )
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: customer.id,
        room_id: offline_booking.roomData.room_id,
        check_in: offline_booking.roomData.check_in,
        check_out: offline_booking.roomData.check_out,
        total_amount: offline_booking.roomData.total_amount,
        status: offline_booking.status,
        created_at: offline_booking.created_at,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Error creating booking:', bookingError)
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      )
    }

    // Log the sync action
    await supabase
      .from('audit_log')
      .insert([{
        action: 'offline_booking_sync',
        details: {
          offline_booking_id: offline_booking.id,
          server_booking_id: booking.id,
          customer_id: customer.id,
          staff_email: user.email,
          client_timestamp,
          server_timestamp: new Date().toISOString(),
          status: 'synced'
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      server_booking_id: booking.id,
      customer_id: customer.id,
      message: 'Offline booking synced successfully'
    })

  } catch (error) {
    console.error('Offline booking sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync offline booking' },
      { status: 500 }
    )
  }
}
