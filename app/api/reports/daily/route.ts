import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    const supabase = supabaseServer()

    const targetDate = date || new Date().toISOString().split('T')[0]
    const startDate = `${targetDate}T00:00:00.000Z`
    const endDate = `${targetDate}T23:59:59.999Z`

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .neq('status', 'Cancelled')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (bookingsError) throw bookingsError

    const bookingIds = bookings?.map((b: any) => b.id) || []
    
    if (bookingIds.length === 0) {
      return NextResponse.json({
        total_bookings: 0,
        total_revenue: 0,
        outstanding_balance: 0,
        checkins_today: 0,
        checkouts_today: 0
      })
    }

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('booking_id, amount')
      .in('booking_id', bookingIds)
      .eq('status', 'Completed')

    if (paymentsError) throw paymentsError

    const totalRevenue = payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
    const totalBookings = bookings?.length || 0

    const { data: checkins, error: checkinsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('check_in_date', targetDate)
      .neq('status', 'Cancelled')

    if (checkinsError) throw checkinsError

    const { data: checkouts, error: checkoutsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('check_out_date', targetDate)
      .neq('status', 'Cancelled')

    if (checkoutsError) throw checkoutsError

    const { data: outstandingData, error: outstandingError } = await supabase
      .from('bookings')
      .select('id, total_amount')
      .neq('status', 'Cancelled')
      .lt('created_at', endDate)

    if (outstandingError) throw outstandingError

    const outstandingIds = outstandingData?.map((b: any) => b.id) || []
    
    const { data: outstandingPayments, error: outstandingPaymentsError } = await supabase
      .from('payments')
      .select('booking_id, amount')
      .in('booking_id', outstandingIds)
      .eq('status', 'Completed')

    if (outstandingPaymentsError) throw outstandingPaymentsError

    const totalPaid = outstandingPayments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
    const totalBookingsAmount = outstandingData?.reduce((sum: number, b: any) => sum + b.total_amount, 0) || 0
    const outstandingBalance = totalBookingsAmount - totalPaid

    return NextResponse.json({
      total_bookings: totalBookings,
      total_revenue: totalRevenue,
      outstanding_balance: Math.max(0, outstandingBalance),
      checkins_today: checkins?.length || 0,
      checkouts_today: checkouts?.length || 0
    })
  } catch (error) {
    console.error('Daily report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate daily report' },
      { status: 500 }
    )
  }
}
export const dynamic = 'force-dynamic'
