import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('Fetching rooms...')
    const supabase = supabaseServer()
    
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('room_type', { ascending: true })

    if (roomsError) {
      console.error('Rooms API error:', roomsError)
      return NextResponse.json(
        { error: 'Failed to fetch rooms', details: roomsError.message },
        { status: 500 }
      )
    }

    console.log('Rooms fetched successfully:', rooms?.length || 0)
    return NextResponse.json({ rooms: rooms || [] })
  } catch (error) {
    console.error('Rooms API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    )
  }
}
