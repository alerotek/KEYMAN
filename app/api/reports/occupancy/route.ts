import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('manager')
  if (auth instanceof NextResponse) return auth

  const supabase = supabaseServer()
  
  // Fetch all bookings for occupancy analysis
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*')
    .order('check_in', { ascending: true })

  if (bookingsError) {
    console.error('Occupancy report bookings error:', bookingsError)
    return NextResponse.json({ error: 'Failed to fetch bookings', details: bookingsError.message }, { status: 500 })
  }

  // Fetch all rooms for room type analysis
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*')

  if (roomsError) {
    console.error('Occupancy report rooms error:', roomsError)
    return NextResponse.json({ error: 'Failed to fetch rooms', details: roomsError.message }, { status: 500 })
  }

  // Fetch payments for revenue analysis
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .order('paid_at', { ascending: false })

  if (paymentsError) {
    console.error('Occupancy report payments error:', paymentsError)
    return NextResponse.json({ error: 'Failed to fetch payments', details: paymentsError.message }, { status: 500 })
  }

  // Calculate occupancy by room type
  const roomTypes: Record<string, {
    totalRooms: number
    occupiedRooms: number
    revenue: number
    occupancyRate: number
  }> = rooms?.reduce((acc, room) => {
    const roomType = room.room_type
    if (!acc[roomType]) {
      acc[roomType] = {
        totalRooms: 0,
        occupiedRooms: 0,
        revenue: 0,
        occupancyRate: 0
      }
    }
    acc[roomType].totalRooms += 1
    return acc
  }, {} as Record<string, any>)

  // Calculate occupancy and revenue per room type
  bookings?.forEach(booking => {
    const room = rooms?.find(r => r.id === booking.room_id)
    if (room) {
      const roomType = room.room_type
      if (booking.status === 'Checked-In') {
        roomTypes[roomType].occupiedRooms += 1
      }
      const bookingRevenue = payments?.find(p => p.booking_id === booking.id)?.amount_paid || 0
      roomTypes[roomType].revenue += bookingRevenue
    }
  })

  // Calculate occupancy rates
  Object.keys(roomTypes).forEach(roomType => {
    const data = roomTypes[roomType]
    data.occupancyRate = data.totalRooms > 0 ? (data.occupiedRooms / data.totalRooms) * 100 : 0
  })

  // Calculate overall metrics
  const totalRevenue = payments?.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0) || 0
  const totalOccupiedRooms = Object.values(roomTypes).reduce((sum, rt) => sum + rt.occupiedRooms, 0)
  const totalAvailableRooms = Object.values(roomTypes).reduce((sum, rt) => sum + (rt.totalRooms - rt.occupiedRooms), 0)

  return NextResponse.json({
    summary: {
      totalRevenue,
      totalOccupiedRooms,
      totalAvailableRooms,
      overallOccupancyRate: rooms?.length > 0 ? (totalOccupiedRooms / rooms.length) * 100 : 0
    },
    roomTypes,
    report: {
      generatedAt: new Date().toISOString(),
      period: 'All time',
      totalBookings: bookings?.length || 0,
      totalRooms: rooms?.length || 0
    }
  })
}
