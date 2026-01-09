import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createSupabaseServer()

  const { data } = await supabase
    .from('bookings')
    .select('total_amount')
    .eq('status', 'Confirmed')

  const total = data?.reduce((s, r) => s + r.total_amount, 0) || 0
  return NextResponse.json({ revenue: total })
}
