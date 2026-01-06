import { createServerClient as createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    const supabase = createSupabaseServer()

    let bookingsQuery = supabase
      .from('bookings')
      .select('*')
      .neq('status', 'Cancelled')

    if (start_date && end_date) {
      bookingsQuery = bookingsQuery
        .gte('created_at', start_date)
        .lte('created_at', end_date)
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery

    if (bookingsError) throw bookingsError

    const bookingIds = bookings?.map((b: any) => b.id) || []
    
    if (bookingIds.length === 0) {
      return NextResponse.json({
        vehicle_count: 0,
        non_vehicle_count: 0,
        vehicle_revenue: 0,
        non_vehicle_revenue: 0,
        vehicle_percentage: 0,
        non_vehicle_percentage: 0
      })
    }

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('booking_id, amount')
      .in('booking_id', bookingIds)
      .eq('status', 'Completed')

    if (paymentsError) throw paymentsError

    const vehicleBookings = bookings?.filter((b: any) => b.vehicle_required && b.vehicle_required === true) || []
    const nonVehicleBookings = bookings?.filter((b: any) => !b.vehicle_required || b.vehicle_required === false) || []

    const vehicleRevenue = payments?.reduce((sum: number, p: any) => {
      const booking = bookings?.find((b: any) => b.id === p.booking_id)
      return booking?.vehicle_required ? sum + p.amount : sum
    }, 0) || 0

    const nonVehicleRevenue = payments?.reduce((sum: number, p: any) => {
      const booking = bookings?.find((b: any) => b.id === p.booking_id)
      return !booking?.vehicle_required ? sum + p.amount : sum
    }, 0) || 0

    const totalRevenue = vehicleRevenue + nonVehicleRevenue
    const vehiclePercentage = totalRevenue > 0 ? (vehicleRevenue / totalRevenue) * 100 : 0
    const nonVehiclePercentage = totalRevenue > 0 ? (nonVehicleRevenue / totalRevenue) * 100 : 0

    return NextResponse.json({
      vehicle_count: vehicleBookings.length,
      non_vehicle_count: nonVehicleBookings.length,
      vehicle_revenue: vehicleRevenue,
      non_vehicle_revenue: nonVehicleRevenue,
      vehicle_percentage: Math.round(vehiclePercentage * 100) / 100,
      non_vehicle_percentage: Math.round(nonVehiclePercentage * 100) / 100,
      note: "Vehicle parking is complimentary - no additional charges"
    })
  } catch (error) {
    console.error('Vehicle usage report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate vehicle usage report' },
      { status: 500 }
    )
  }
}
export const dynamic = 'force-dynamic'
