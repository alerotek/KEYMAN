import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, profile } = authResult
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('dateRange') || '30'

    const supabase = supabaseServer()
    
    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(dateRange))

    // Get comprehensive metrics
    const [
      bookingsResult,
      paymentsResult,
      roomsResult,
      staffResult,
      expensesResult
    ] = await Promise.all([
      // Bookings metrics
      supabase
        .from('bookings')
        .select('id, status, total_amount, check_in, check_out, created_at, created_by, room_types!inner(name)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),

      // Payments metrics
      supabase
        .from('payments')
        .select('amount_paid, method, status, paid_at, recorded_by')
        .gte('paid_at', startDate.toISOString())
        .lte('paid_at', endDate.toISOString()),

      // Room metrics
      supabase
        .from('room_inventory_summary')
        .select('*'),

      // Staff performance
      supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .eq('role', 'staff'),

      // Expenses
      supabase
        .from('expenses')
        .select('amount, category, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
    ])

    if (bookingsResult.error || paymentsResult.error || roomsResult.error || 
        staffResult.error || expensesResult.error) {
      console.error('Dashboard data fetch error:', {
        bookings: bookingsResult.error,
        payments: paymentsResult.error,
        rooms: roomsResult.error,
        staff: staffResult.error,
        expenses: expensesResult.error
      })
      return NextResponse.json(
        { error: 'Failed to fetch dashboard data' },
        { status: 500 }
      )
    }

    // Calculate metrics
    const bookings = bookingsResult.data || []
    const payments = paymentsResult.data || []
    const rooms = roomsResult.data || []
    const staff = staffResult.data || []
    const expenses = expensesResult.data || []

    const totalRevenue = payments.reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0)
    const totalBookings = bookings.length
    const confirmedBookings = bookings.filter((b: any) => b.status === 'Confirmed').length
    const checkedInBookings = bookings.filter((b: any) => b.status === 'Checked-In').length
    const pendingBookings = bookings.filter((b: any) => b.status === 'Pending').length
    const cancelledBookings = bookings.filter((b: any) => b.status === 'Cancelled').length

    const totalRooms = rooms.reduce((sum: number, r: any) => sum + (r.total_rooms || 0), 0)
    const occupiedRooms = rooms.reduce((sum: number, r: any) => sum + (r.occupied_today || 0), 0)
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    const netProfit = totalRevenue - totalExpenses

    // Payment methods breakdown
    const paymentMethods: Record<string, { method: string; count: number; total: number }> = payments.reduce((acc: any, p: any) => {
      const method = p.method || 'Unknown'
      if (!acc[method]) {
        acc[method] = { method, count: 0, total: 0 }
      }
      acc[method].count++
      acc[method].total += (p as any).amount_paid || 0
      return acc
    }, {} as Record<string, { method: string; count: number; total: number }>)

    // Recent bookings
    const recentBookings = bookings
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    // Staff performance
    const staffPerformance = staff.map((s: any) => ({
      staff_name: s.full_name,
      role: s.role,
      booking_count: bookings.filter((b: any) => b.created_by === s.id).length,
      total_revenue: payments
        .filter((p: any) => p.recorded_by === s.id)
        .reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0)
    }))

    // Room performance
    const roomPerformance = rooms.map((r: any) => ({
      room_type: r.room_type_name,
      total_rooms: r.total_rooms,
      occupied_rooms: r.occupied_today,
      available_rooms: r.available_today,
      occupancy_rate: r.occupancy_rate_today,
      revenue: bookings
        .filter((b: any) => (b as any).room_types?.name === r.room_type_name)
        .reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0)
    }))

    const dashboardData = {
      metrics: {
        totalRevenue,
        totalBookings,
        confirmedBookings,
        checkedInBookings,
        pendingBookings,
        cancelledBookings,
        totalRooms,
        occupiedRooms,
        occupancyRate,
        totalExpenses,
        netProfit,
        averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0
      },
      recentBookings,
      paymentMethods: Object.values(paymentMethods),
      staffPerformance,
      roomPerformance,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: parseInt(dateRange)
      }
    }

    // Log dashboard access
    await supabase
      .from('audit_log')
      .insert({
        action: 'dashboard_accessed',
        entity: 'admin_dashboard',
        actor_id: user.id,
        actor_role: profile.role,
        details: {
          accessed_by: profile.full_name,
          date_range: dateRange,
          metrics_calculated: Object.keys(dashboardData.metrics).length
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      data: dashboardData
    })

  } catch (error) {
    console.error('Admin dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin dashboard data' },
      { status: 500 }
    )
  }
}

// Generate PDF reports for admin
export async function POST(request: Request) {
  try {
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, profile } = authResult
    const body = await request.json()
    const { reportType, startDate, endDate } = body

    if (!reportType || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Report type, start date, and end date are required' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    // Generate report based on type
    let reportData
    switch (reportType) {
      case 'bookings':
        const { data: bookings } = await supabase
          .from('bookings')
          .select(`
            *,
            room_types!inner(name),
            customers!inner(full_name, email)
          `)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
        reportData = { bookings, type: 'bookings' }
        break

      case 'revenue':
        const { data: revenue } = await supabase
          .from('payments')
          .select(`
            *,
            bookings!inner(
              id,
              total_amount,
              customers!inner(full_name, email)
            )
          `)
          .gte('paid_at', startDate)
          .lte('paid_at', endDate)
        reportData = { revenue, type: 'revenue' }
        break

      case 'occupancy':
        const { data: occupancy } = await supabase
          .from('room_inventory_summary')
          .select('*')
        reportData = { occupancy, type: 'occupancy' }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        )
    }

    // Log report generation
    await supabase
      .from('audit_log')
      .insert({
        action: 'report_generated',
        entity: 'admin_reports',
        entity_id: null,
        actor_id: user.id,
        actor_role: profile.role,
        details: {
          report_type: reportType,
          start_date: startDate,
          end_date: endDate,
          generated_by: profile.full_name
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: 'Report data generated successfully',
      data: reportData
    })

  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
