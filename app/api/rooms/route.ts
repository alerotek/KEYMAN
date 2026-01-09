import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = supabaseServer()

    const { data, error } = await supabase
      .from('rooms')
      .select('id, room_number, room_type, base_price, breakfast_price')
      .eq('is_active', true)
      .order('room_number')

    if (error) throw error

    return NextResponse.json({ rooms: data })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
