import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireMinimumRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify manager role or higher
    const authResult = await requireMinimumRole('manager')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = createSupabaseServer()

    // Get total revenue
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount_paid')

    if (paymentsError) throw paymentsError

    const totalRevenue = payments?.reduce((sum, payment) => sum + payment.amount_paid, 0) || 0

    // Get booking statistics
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('status, created_at')

    if (bookingsError) throw bookingsError

    const totalBookings = bookings?.length || 0
    const pendingBookings = bookings?.filter(b => b.status === 'Pending').length || 0
    const confirmedBookings = bookings?.filter(b => b.status === 'Confirmed').length || 0
    const checkedInBookings = bookings?.filter(b => b.status === 'Checked-In').length || 0

    // Get room occupancy
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, is_active')

    if (roomsError) throw roomsError

    const totalRooms = rooms?.filter(r => r.is_active).length || 0
    const occupiedRooms = checkedInBookings

    // Get recent bookings for overview
    const recentBookings = bookings?.slice(-10).reverse() || []

    return NextResponse.json({
      metrics: {
        totalRevenue,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        checkedInBookings,
        totalRooms,
        occupiedRooms,
        occupancyRate: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0
      },
      recentBookings
    })
  } catch (error) {
    console.error('Manager dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch manager dashboard data' },
      { status: 500 }
    )
  }
}
