import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('=== DEBUG: Testing Supabase connection ===')
    
    // Check environment variables
    console.log('Environment check:', {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })

    const supabase = supabaseServer()
    
    // Test simple connection
    console.log('Testing rooms table...')
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id')
      .limit(1)

    if (roomsError) {
      console.error('Rooms table error:', roomsError)
      return NextResponse.json({ 
        error: 'Rooms table error', 
        details: roomsError 
      }, { status: 500 })
    }

    console.log('Rooms table OK, found:', rooms?.length || 0)

    // Test bookings table
    console.log('Testing bookings table...')
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id')
      .limit(1)

    if (bookingsError) {
      console.error('Bookings table error:', bookingsError)
      return NextResponse.json({ 
        error: 'Bookings table error', 
        details: bookingsError 
      }, { status: 500 })
    }

    console.log('Bookings table OK, found:', bookings?.length || 0)

    return NextResponse.json({ 
      success: true,
      message: 'Database connection working',
      roomsCount: rooms?.length || 0,
      bookingsCount: bookings?.length || 0
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ 
      error: 'Debug endpoint failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
