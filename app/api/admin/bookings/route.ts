import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createSupabaseServer()
    
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        rooms(room_type, room_number),
        customers(full_name, email, phone),
        staff(full_name, role)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (bookingsError) {
      console.error('Bookings API error:', bookingsError)
      return NextResponse.json(
        { error: 'Failed to fetch bookings', details: bookingsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ bookings: bookings || [] })
  } catch (error) {
    console.error('Bookings API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
