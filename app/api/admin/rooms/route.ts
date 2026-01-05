import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createSupabaseServer()
    
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .order('room_type', { ascending: true })

    if (roomsError) {
      console.error('Rooms API error:', roomsError)
      return NextResponse.json(
        { error: 'Failed to fetch rooms', details: roomsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ rooms: rooms || [] })
  } catch (error) {
    console.error('Rooms API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rooms', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
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

    const supabase = createSupabaseServer()

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
