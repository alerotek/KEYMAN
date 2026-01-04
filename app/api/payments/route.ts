import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const booking_id = searchParams.get('booking_id')

    const supabase = createSupabaseServer()
    
    let query = supabase
      .from('payments')
      .select(`
        *,
        bookings(
          customer_id,
          total_amount,
          status
        )
      `)

    if (booking_id) {
      query = query.eq('booking_id', booking_id)
    }

    const { data, error } = await query.order('payment_date', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Payments API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      booking_id,
      amount,
      payment_method,
      payment_date = new Date().toISOString(),
      status = 'Completed',
      notes
    } = body

    if (!booking_id || !amount || !payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    const { data, error } = await supabase
      .from('payments')
      .insert([{
        booking_id,
        amount,
        payment_method,
        payment_date,
        status,
        notes
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Create payment error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { booking_id } = body

    if (!booking_id) {
      return NextResponse.json(
        { error: 'Booking ID required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', booking_id)
      .eq('status', 'Completed')

    if (paymentsError) throw paymentsError

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('total_amount')
      .eq('id', booking_id)
      .single()

    if (bookingError) throw bookingError

    const totalPaid = payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
    const outstanding = booking.total_amount - totalPaid

    return NextResponse.json({
      total_paid: totalPaid,
      outstanding_balance: outstanding,
      booking_total: booking.total_amount
    })
  } catch (error) {
    console.error('Reconcile payment error:', error)
    return NextResponse.json(
      { error: 'Failed to reconcile payments' },
      { status: 500 }
    )
  }
}
export const dynamic = 'force-dynamic'
