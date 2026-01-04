import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServer()

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        customer_id,
        profiles!bookings_customer_id_fkey(
          full_name,
          email,
          phone
        )
      `)
      .neq('status', 'Cancelled')

    if (bookingsError) throw bookingsError

    const customerBookings = bookings?.reduce((acc: any, booking: any) => {
      const customerId = booking.customer_id
      const profile = booking.profiles
      
      if (!acc[customerId]) {
        acc[customerId] = {
          customer_id: customerId,
          full_name: profile?.full_name || 'Unknown',
          email: profile?.email || 'Unknown',
          phone: profile?.phone || 'Unknown',
          booking_count: 0
        }
      }
      
      acc[customerId].booking_count++
      
      return acc
    }, {})

    const repeatCustomers = Object.values(customerBookings || {})
      .filter((customer: any) => customer.booking_count >= 2)
      .sort((a: any, b: any) => b.booking_count - a.booking_count)

    return NextResponse.json(repeatCustomers)
  } catch (error) {
    console.error('Repeat customers report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate repeat customers report' },
      { status: 500 }
    )
  }
}
export const dynamic = 'force-dynamic'
