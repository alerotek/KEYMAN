import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendBookingConfirmationEmail } from '@/lib/email/service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { room_id, customer_id, check_in, check_out, guests_count, breakfast=false, customer_name, customer_email } = await request.json()
    if (!room_id || !check_in || !check_out || !guests_count || !customer_name || !customer_email) return NextResponse.json({ error:'Missing required fields' }, { status:400 })

    const supabase = supabaseServer()
    const { data: room, error: roomError } = await supabase.from('rooms').select('room_type, base_price, breakfast_price').eq('id', room_id).single()
    if (roomError || !room) return NextResponse.json({ error:'Room not found', details: roomError?.message }, { status:404 })

    const nights = Math.ceil((new Date(check_out).getTime()-new Date(check_in).getTime())/(1000*60*60*24))
    if (nights<=0) return NextResponse.json({ error:'Check-out must be after check-in' }, { status:400 })

    let basePrice = room.base_price
    if(room.room_type==='DOUBLE') basePrice += Math.max(guests_count-2,0)*500
    const breakfastCost = breakfast? guests_count*room.breakfast_price*nights : 0
    const vehicleCost = 0
    const totalAmount = basePrice*nights + breakfastCost + vehicleCost

    let custId = customer_id
    if(!custId){
      const { data: existing } = await supabase.from('customers').select('id').eq('email', customer_email).single()
      custId = existing?.id
      if(!custId){
        const { data: newCustomer } = await supabase.from('customers').insert({ full_name: customer_name, email: customer_email }).select().single()
        custId = newCustomer.id
      }
    }

    const { data: booking } = await supabase.from('bookings').insert([{ room_id, customer_id: custId, check_in, check_out, guests_count, breakfast, base_price: basePrice, extras_price: breakfastCost+vehicleCost, total_amount: totalAmount, status:'Pending' }]).select('*').single()
    try{ await sendBookingConfirmationEmail(booking) } catch{}

    return NextResponse.json({ message:'Booking created successfully', booking })
  } catch(err) {
    console.error('Booking API error:', err)
    return NextResponse.json({ error:'Failed to create booking' }, { status:500 })
  }
}
