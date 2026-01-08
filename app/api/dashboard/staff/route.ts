import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('staff')
  if (auth instanceof NextResponse) return auth

  const supabase = supabaseServer()
  
  // Fetch room occupancy data
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, room_type, room_number, is_active')
    .eq('is_active', true)

  if (roomsError) {
    console.error('Staff dashboard rooms error:', roomsError)
    return NextResponse.json({ error: 'Failed to fetch rooms', details: roomsError.message }, { status: 500 })
  }

  // Fetch current bookings
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*')
    .in('status', ['Confirmed', 'Checked-In', 'Pending'])
    .order('check_in', { ascending: true })

  if (bookingsError) {
    console.error('Staff dashboard bookings error:', bookingsError)
    return NextResponse.json({ error: 'Failed to fetch bookings', details: bookingsError.message }, { status: 500 })
  }

  // Calculate metrics
  const totalRooms = rooms?.length || 0
  const occupiedRooms = bookings?.filter(b => b.status === 'Checked-In').length || 0
  const pendingBookings = bookings?.filter(b => b.status === 'Pending').length || 0
  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

  return NextResponse.json({
    metrics: {
      totalRooms,
      occupiedRooms,
      availableRooms: totalRooms - occupiedRooms,
      pendingBookings,
      occupancyRate: Math.round(occupancyRate * 10) / 10
    },
    rooms: rooms || [],
    recentBookings: bookings?.slice(0, 10) || []
  })
}
