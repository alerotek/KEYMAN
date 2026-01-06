import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const customer_id = searchParams.get('customer_id')
    const status = searchParams.get('status')

    const supabase = createSupabaseServer()
    
    let query = supabase
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
      .neq('status', 'Cancelled')

    if (customer_id) {
      query = query.eq('customer_id', customer_id)
    }
    
    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Bookings API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      customer_id,
      room_id,
      check_in_date,
      check_out_date,
      total_amount,
      status = 'Confirmed',
      vehicle_required = false,
      notes
    } = body

    if (!customer_id || !room_id || !check_in_date || !check_out_date || !total_amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    const { data, error } = await supabase
      .from('bookings')
      .insert([{
        customer_id,
        room_id,
        check_in_date,
        check_out_date,
        total_amount,
        status,
        vehicle_required,
        notes
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Create booking error:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}
export const dynamic = 'force-dynamic'
