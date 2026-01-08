import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('staff')
  if (auth instanceof NextResponse) return auth
  const supabase = supabaseServer()
  const { data: rooms, error } = await supabase.from('rooms').select('id, room_number, room_type, base_price, breakfast_price, is_active').eq('is_active', true).order('room_number')
  if (error) return NextResponse.json({ error: 'Failed to fetch rooms', details: error.message }, { status:500 })
  return NextResponse.json({ rooms })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      room_type,
      max_guests,
      base_price,
      breakfast_price,
      is_active = true
    } = body

    // Validate required fields
    if (!room_type || !max_guests || !base_price || !breakfast_price) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert([{
        room_type,
        max_guests,
        base_price,
        breakfast_price,
        is_active
      }])
      .select()
      .single()

    if (roomError) {
      console.error('Room creation error:', roomError)
      return NextResponse.json(
        { error: 'Failed to create room', details: roomError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'Room created successfully',
      room 
    })
  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json(
      { error: 'Failed to create room', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
