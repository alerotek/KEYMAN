import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    const supabase = createSupabaseServer()

    let bookingsQuery = supabase
      .from('bookings')
      .select(`
        *,
        rooms(room_type, room_number)
      `)
      .neq('status', 'Cancelled')

    if (start_date && end_date) {
      bookingsQuery = bookingsQuery
        .gte('created_at', start_date)
        .lte('created_at', end_date)
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery

    if (bookingsError) throw bookingsError

    const bookingIds = bookings?.map(b => b.id) || []
    
    if (bookingIds.length === 0) {
      return NextResponse.json([])
    }

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('booking_id, amount')
      .in('booking_id', bookingIds)
      .eq('status', 'Completed')

    if (paymentsError) throw paymentsError

    const roomPerformance = bookings?.reduce((acc: any, booking: any) => {
      const roomType = booking.rooms?.room_type || 'Unknown'
      
      if (!acc[roomType]) {
        acc[roomType] = {
          room_type: roomType,
          booking_count: 0,
          total_revenue: 0
        }
      }
      
      acc[roomType].booking_count++
      
      const bookingRevenue = payments
        ?.filter((p: any) => p.booking_id === booking.id)
        ?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
      
      acc[roomType].total_revenue += bookingRevenue
      
      return acc
    }, {})

    const result = Object.values(roomPerformance || {})

    return NextResponse.json(result)
  } catch (error) {
    console.error('Room performance report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate room performance report' },
      { status: 500 }
    )
  }
}
export const dynamic = 'force-dynamic'
