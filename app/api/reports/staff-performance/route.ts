import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    const supabase = createSupabaseServer()

    // Fix: Remove invalid relationship and use separate queries
    let bookingsQuery = supabase
      .from('bookings')
      .select('id, staff_id, total_amount')
      .neq('status', 'Cancelled')

    if (start_date && end_date) {
      bookingsQuery = bookingsQuery
        .gte('created_at', start_date)
        .lte('created_at', end_date)
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery

    if (bookingsError) {
      if (bookingsError.code === 'PGRST200') {
        throw new Error('Invalid Supabase relationship used in query')
      }
      throw bookingsError
    }

    const bookingIds = bookings?.map(b => b.id) || []
    
    if (bookingIds.length === 0) {
      return NextResponse.json([])
    }

    // Get unique staff IDs
    const staffIds = Array.from(new Set(bookings?.map(b => b.staff_id).filter(Boolean)))
    
    if (staffIds.length === 0) {
      return NextResponse.json([])
    }

    // Fetch staff separately (not profiles - actual table is staff)
    const { data: profiles, error: profilesError } = await supabase
      .from('staff')
      .select('id, full_name, email, role')
      .in('id', staffIds)

    if (profilesError) throw profilesError

    // Create profile lookup map
    const profileMap: Record<string, any> = (profiles || []).reduce((acc: Record<string, any>, profile: any) => {
      acc[profile.id] = profile
      return acc
    }, {})

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('booking_id, amount')
      .in('booking_id', bookingIds)

    if (paymentsError) throw paymentsError

    const staffPerformance = bookings?.reduce((acc: any, booking: any) => {
      const staff = profileMap[booking.staff_id]
      if (!staff) return acc
      
      const staffKey = staff.id
      
      if (!acc[staffKey]) {
        acc[staffKey] = {
          staff_id: staff.id,
          staff_name: staff.full_name,
          role: staff.role,
          booking_count: 0,
          total_revenue: 0
        }
      }
      
      acc[staffKey].booking_count++
      
      const bookingRevenue = payments
        ?.filter((p: any) => p.booking_id === booking.id)
        ?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
      
      acc[staffKey].total_revenue += bookingRevenue
      
      return acc
    }, {})

    const result = Object.values(staffPerformance || {})

    return NextResponse.json(result)
  } catch (error) {
    console.error('Staff performance report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate staff performance report' },
      { status: 500 }
    )
  }
}
export const dynamic = 'force-dynamic'
