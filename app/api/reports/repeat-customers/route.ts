import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServer()

    // Fix: Remove invalid relationship and use separate queries
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('customer_id')
      .neq('status', 'Cancelled')

    if (bookingsError) {
      if (bookingsError.code === 'PGRST200') {
        throw new Error('Invalid Supabase relationship used in query')
      }
      throw bookingsError
    }

    // Get unique customer IDs
    const customerIds = Array.from(new Set(bookings?.map(b => b.customer_id).filter(Boolean)))
    
    if (customerIds.length === 0) {
      return NextResponse.json([])
    }

    // Fetch profiles separately
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .in('id', customerIds)

    if (profilesError) throw profilesError

    // Create profile lookup map
    const profileMap: Record<string, any> = (profiles || []).reduce((acc: Record<string, any>, profile: any) => {
      acc[profile.id] = profile
      return acc
    }, {})

    const customerBookings = bookings?.reduce((acc: any, booking: any) => {
      const customerId = booking.customer_id
      const profile = profileMap[customerId]
      
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
