import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('manager')
  if (auth instanceof NextResponse) return auth

  const supabase = supabaseServer()
  
  // Fetch revenue data
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .in('status', ['Completed', 'Confirmed'])
    .order('paid_at', { ascending: false })

  if (paymentsError) {
    console.error('Manager dashboard payments error:', paymentsError)
    return NextResponse.json({ error: 'Failed to fetch payments', details: paymentsError.message }, { status: 500 })
  }

  // Fetch bookings data
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })

  if (bookingsError) {
    console.error('Manager dashboard bookings error:', bookingsError)
    return NextResponse.json({ error: 'Failed to fetch bookings', details: bookingsError.message }, { status: 500 })
  }

  // Fetch rooms data
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*')

  if (roomsError) {
    console.error('Manager dashboard rooms error:', roomsError)
    return NextResponse.json({ error: 'Failed to fetch rooms', details: roomsError.message }, { status: 500 })
  }

  // Calculate metrics
  const totalRevenue = payments?.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0) || 0
  const totalBookings = bookings?.length || 0
  const confirmedBookings = bookings?.filter(b => b.status === 'Confirmed').length || 0
  const pendingBookings = bookings?.filter(b => b.status === 'Pending').length || 0
  const totalRooms = rooms?.length || 0
  const occupiedRooms = bookings?.filter(b => b.status === 'Checked-In').length || 0
  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

  return NextResponse.json({
    metrics: {
      totalRevenue,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      totalRooms,
      occupiedRooms,
      occupancyRate: Math.round(occupancyRate * 10) / 10
    },
    recentBookings: bookings?.slice(0, 20) || [],
    recentPayments: payments?.slice(0, 20) || []
  })
}
