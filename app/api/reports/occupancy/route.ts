import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createSupabaseServer()

  const { data } = await supabase
    .from('bookings')
    .select('room_id')
    .eq('status', 'Confirmed')

  return NextResponse.json({
    occupiedRooms: new Set(data?.map(b => b.room_id)).size
  })
}
