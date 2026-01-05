import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify admin role
    const authResult = await requireRole('admin')
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

    // Get staff performance
    const { data: staffBookings, error: staffError } = await supabase
      .from('bookings')
      .select(`
        staff_id,
        total_amount,
        staff!bookings_staff_id_fkey(
          full_name,
          role
        )
      `)
      .not('staff_id', 'is', null)

    if (staffError) throw staffError

    const staffPerformance = staffBookings?.reduce((acc, booking) => {
      const staffId = booking.staff_id
      const staff = booking.staff as any
      
      if (!acc[staffId]) {
        acc[staffId] = {
          staff_id: staffId,
          staff_name: staff?.full_name || 'Unknown',
          role: staff?.role || 'Unknown',
          booking_count: 0,
          total_revenue: 0
        }
      }
      
      acc[staffId].booking_count++
      acc[staffId].total_revenue += booking.total_amount || 0
      
      return acc
    }, {} as Record<string, any>)

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
      staffPerformance: Object.values(staffPerformance || {}),
      recentBookings: bookings?.slice(-5).reverse() || []
    })
  } catch (error) {
    console.error('Admin dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin dashboard data' },
      { status: 500 }
    )
  }
}
