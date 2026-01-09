import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireRole(request, ['MANAGER'])
    
    const supabase = supabaseServer()
    
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)

    if (roomsError) throw roomsError

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })

    if (bookingsError) throw bookingsError

    return NextResponse.json({
      rooms: rooms || [],
      bookings: bookings || []
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500 }
    )
  }
}
