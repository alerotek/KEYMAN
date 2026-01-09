import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createSupabaseServer()

  const [rooms, bookings, revenue] = await Promise.all([
    supabase.from('rooms').select('id', { count: 'exact' }),
    supabase.from('bookings').select('id', { count: 'exact' }),
    supabase.from('bookings').select('total_amount')
  ])

  const totalRevenue = revenue.data?.reduce(
    (sum, b) => sum + (b.total_amount || 0),
    0
  )

  return NextResponse.json({
    rooms: rooms.count,
    bookings: bookings.count,
    revenue: totalRevenue
  })
}
