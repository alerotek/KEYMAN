import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServer()
    const body = await req.json()

    const {
      room_id,
      check_in,
      check_out,
      guests_count,
      breakfast,
      customer_name,
      customer_email
    } = body

    if (!room_id || !check_in || !check_out) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('base_price, breakfast_price')
      .eq('id', room_id)
      .single()

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const nights =
      (new Date(check_out).getTime() - new Date(check_in).getTime()) /
      (1000 * 60 * 60 * 24)

    const breakfastCost = breakfast
      ? room.breakfast_price * guests_count * nights
      : 0

    const totalAmount = room.base_price * nights + breakfastCost
    const vehicleCost = 0 // FREE PARKING

    // Create or reuse customer
    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customer_email)
      .single()

    if (!customer) {
      const res = await supabase
        .from('customers')
        .insert({
          full_name: customer_name,
          email: customer_email
        })
        .select()
        .single()

      customer = res.data
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        room_id,
        customer_id: customer.id,
        check_in,
        check_out,
        guests_count,
        breakfast,
        vehicle: true,
        base_price: room.base_price,
        extras_price: breakfastCost + vehicleCost,
        total_amount: totalAmount,
        status: 'Pending'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ booking })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
