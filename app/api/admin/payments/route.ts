import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = supabaseServer()
    
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select(`
        *,
        bookings(
          id,
          customers(full_name, email),
          rooms(room_type, room_number)
        )
      `)
      .order('paid_at', { ascending: false })
      .limit(50)

    if (paymentsError) {
      console.error('Payments API error:', paymentsError)
      return NextResponse.json(
        { error: 'Failed to fetch payments', details: paymentsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ payments: payments || [] })
  } catch (error) {
    console.error('Payments API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
