import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createSupabaseServer()
    
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        created_at,
        check_in,
        check_out,
        total_amount,
        guests_count,
        breakfast,
        vehicle,
        room_type_id,
        customer_id,
        created_by
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (bookingsError) {
      console.error('Staff bookings API error:', bookingsError)
      return NextResponse.json(
        { error: 'Failed to fetch bookings', details: bookingsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ bookings: bookings || [] })
  } catch (error) {
    console.error('Staff bookings API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
