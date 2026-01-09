import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const supabase = createSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    const check_in = searchParams.get('check_in')
    const check_out = searchParams.get('check_out')
    const room_type = searchParams.get('room_type')

    if (!check_in || !check_out) {
      return NextResponse.json(
        { error: 'Missing required parameters: check_in, check_out' },
        { status: 400 }
      )
    }

    // Validate dates
    const checkInDate = new Date(check_in)
    const checkOutDate = new Date(check_out)
    
    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      )
    }

    // Get all active rooms
    let roomsQuery = supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)

    if (room_type) {
      roomsQuery = roomsQuery.eq('room_type', room_type)
    }

    const { data: rooms, error: roomsError } = await roomsQuery

    if (roomsError) throw roomsError

    // Check availability for each room during the requested period
    const availableRooms = []

    for (const room of rooms) {
      // Check if room has any bookings that overlap with the requested dates
      const { data: conflictingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('room_id', room.id)
        .in('status', ['Pending', 'Confirmed'])
        .or(`and(check_in.lt.${check_out},check_out.gt.${check_in})`)

      // Room is available if no conflicting bookings exist
      const isAvailable = !conflictingBookings || conflictingBookings.length === 0

      availableRooms.push({
        ...room,
        is_available: isAvailable,
        availability_status: isAvailable ? 'Available' : 'Not Available'
      })
    }

    // Calculate summary statistics
    const totalRooms = availableRooms.length
    const availableCount = availableRooms.filter(r => r.is_available).length
    const unavailableCount = totalRooms - availableCount

    return NextResponse.json({
      rooms: availableRooms,
      summary: {
        total_rooms: totalRooms,
        available_rooms: availableCount,
        unavailable_rooms: unavailableCount,
        occupancy_rate: totalRooms > 0 ? ((unavailableCount / totalRooms) * 100).toFixed(1) : '0',
        check_in: check_in,
        check_out: check_out
      }
    })

  } catch (err: any) {
    console.error('Room availability check error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
