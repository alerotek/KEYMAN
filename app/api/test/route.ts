import { createServerClient as createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('Testing Supabase connection...')
    console.log('Environment variables:', {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
    
    const supabase = createSupabaseServer()
    
    // Test simple connection
    const { data, error } = await supabase
      .from('rooms')
      .select('count')
      .limit(1)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ 
        error: 'Database error', 
        details: error.message,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      }, { status: 500 })
    }

    // Test rooms query
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('room_type', { ascending: true })

    if (roomsError) {
      console.error('Rooms query error:', roomsError)
      return NextResponse.json({ 
        error: 'Failed to fetch rooms', 
        details: roomsError.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      count: data?.length || 0,
      rooms: rooms || [],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    })
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({ 
      error: 'Server error', 
      details: error.message 
    }, { status: 500 })
  }
}
