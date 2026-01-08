import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('customer')
  if (auth instanceof NextResponse) return auth

  const supabase = supabaseServer()
  
  // Fetch customer's bookings
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', auth.profile.id)
    .order('created_at', { ascending: false })

  if (bookingsError) {
    console.error('Customer dashboard bookings error:', bookingsError)
    return NextResponse.json({ error: 'Failed to fetch bookings', details: bookingsError.message }, { status: 500 })
  }

  // Fetch customer's payments
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', auth.profile.id)
    .order('paid_at', { ascending: false })

  if (paymentsError) {
    console.error('Customer dashboard payments error:', paymentsError)
    return NextResponse.json({ error: 'Failed to fetch payments', details: paymentsError.message }, { status: 500 })
  }

  // Calculate metrics
  const totalBookings = bookings?.length || 0
  const totalSpent = payments?.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0) || 0
  const upcomingBookings = bookings?.filter(b => b.status === 'Confirmed' && new Date(b.check_in) > new Date()).length || 0
  const pastBookings = bookings?.filter(b => new Date(b.check_out) < new Date()).length || 0

  return NextResponse.json({
    metrics: {
      totalBookings,
      totalSpent,
      upcomingBookings,
      pastBookings
    },
    bookings: bookings || [],
    payments: payments || []
  })
}
