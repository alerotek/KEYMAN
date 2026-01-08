import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('admin')
  if (auth instanceof NextResponse) return auth

  const supabase = supabaseServer()
  
  // Fetch all data for admin overview
  const [bookingsResult, paymentsResult, roomsResult, staffResult, customersResult] = await Promise.all([
    supabase.from('bookings').select('*').order('created_at', { ascending: false }),
    supabase.from('payments').select('*').order('paid_at', { ascending: false }),
    supabase.from('rooms').select('*'),
    supabase.from('profiles').select('*').eq('role', 'staff'),
    supabase.from('customers').select('*').order('created_at', { ascending: false })
  ])

  if (bookingsResult.error) {
    console.error('Admin dashboard bookings error:', bookingsResult.error)
    return NextResponse.json({ error: 'Failed to fetch bookings', details: bookingsResult.error.message }, { status: 500 })
  }

  if (paymentsResult.error) {
    console.error('Admin dashboard payments error:', paymentsResult.error)
    return NextResponse.json({ error: 'Failed to fetch payments', details: paymentsResult.error.message }, { status: 500 })
  }

  if (roomsResult.error) {
    console.error('Admin dashboard rooms error:', roomsResult.error)
    return NextResponse.json({ error: 'Failed to fetch rooms', details: roomsResult.error.message }, { status: 500 })
  }

  if (staffResult.error) {
    console.error('Admin dashboard staff error:', staffResult.error)
    return NextResponse.json({ error: 'Failed to fetch staff', details: staffResult.error.message }, { status: 500 })
  }

  if (customersResult.error) {
    console.error('Admin dashboard customers error:', customersResult.error)
    return NextResponse.json({ error: 'Failed to fetch customers', details: customersResult.error.message }, { status: 500 })
  }

  // Calculate comprehensive metrics
  const bookings = bookingsResult.data || []
  const payments = paymentsResult.data || []
  const rooms = roomsResult.data || []
  const staff = staffResult.data || []
  const customers = customersResult.data || []

  const totalRevenue = payments.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0)
  const totalBookings = bookings.length
  const totalRooms = rooms.length
  const totalStaff = staff.length
  const totalCustomers = customers.length

  const bookingStatusCounts = bookings.reduce((acc, booking) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const occupiedRooms = bookingStatusCounts['Checked-In'] || 0
  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

  return NextResponse.json({
    metrics: {
      totalRevenue,
      totalBookings,
      totalRooms,
      totalStaff,
      totalCustomers,
      occupiedRooms,
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      bookingStatusCounts
    },
    data: {
      bookings: bookings.slice(0, 50),
      payments: payments.slice(0, 50),
      rooms,
      staff,
      customers: customers.slice(0, 50)
    }
  })
}
