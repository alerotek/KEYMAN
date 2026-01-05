import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Verify admin role only
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const body = await request.json()
    const { type, startDate, endDate } = body

    // Validate input
    if (!type || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: type, startDate, endDate' },
        { status: 400 }
      )
    }

    const validTypes = ['bookings', 'revenue', 'occupancy']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid report type' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Get admin user info
    const { data: adminUser } = await supabase
      .from('staff')
      .select('full_name')
      .eq('id', user.id)
      .single()

    let reportData: any = {}

    switch (type) {
      case 'bookings':
        reportData = await generateBookingReport(supabase, startDate, endDate)
        break
      case 'revenue':
        reportData = await generateRevenueReport(supabase, startDate, endDate)
        break
      case 'occupancy':
        reportData = await generateOccupancyReport(supabase, startDate, endDate)
        break
    }

    // Generate PDF content (HTML to PDF conversion)
    const pdfContent = await generatePDFContent(type, reportData, startDate, endDate, adminUser?.full_name || 'Admin')

    // Return PDF as downloadable file
    const filename = `${type}-report-${startDate}_to_${endDate}.pdf`
    
    return new NextResponse(pdfContent, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfContent.length.toString()
      }
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF report' },
      { status: 500 }
    )
  }
}

async function generateBookingReport(supabase: any, startDate: string, endDate: string) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id,
      status,
      check_in,
      check_out,
      total_amount,
      created_at,
      rooms(room_type),
      customers(full_name, email)
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate + ' 23:59:59')
    .order('created_at', { ascending: false })

  const totalBookings = bookings?.length || 0
  const confirmedBookings = bookings?.filter((b: any) => b.status === 'Confirmed').length || 0
  const cancelledBookings = bookings?.filter((b: any) => b.status === 'Cancelled').length || 0
  const checkedInBookings = bookings?.filter((b: any) => b.status === 'Checked-In').length || 0
  
  // Calculate occupancy
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id')
    .eq('is_active', true)
  
  const totalRooms = rooms?.length || 0
  const occupancyRate = totalRooms > 0 ? (checkedInBookings / totalRooms) * 100 : 0

  return {
    bookings: bookings || [],
    metrics: {
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      checkedInBookings,
      totalRooms,
      occupancyRate: occupancyRate.toFixed(1)
    }
  }
}

async function generateRevenueReport(supabase: any, startDate: string, endDate: string) {
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_paid, method, paid_at')
    .gte('paid_at', startDate)
    .lte('paid_at', endDate + ' 23:59:59')
    .order('paid_at', { ascending: false })

  const totalRevenue = payments?.reduce((sum: number, payment: any) => sum + payment.amount_paid, 0) || 0
  
  // Revenue by payment method
  const revenueByMethod = payments?.reduce((acc: any, payment: any) => {
    const method = payment.method || 'unknown'
    acc[method] = (acc[method] || 0) + payment.amount_paid
    return acc
  }, {} as Record<string, number>) || {}

  // Daily breakdown
  const dailyRevenue = payments?.reduce((acc: any, payment: any) => {
    const date = payment.paid_at.split('T')[0]
    if (!acc[date]) {
      acc[date] = { total: 0, count: 0 }
    }
    acc[date].total += payment.amount_paid
    acc[date].count += 1
    return acc
  }, {} as Record<string, { total: number; count: number }>) || {}

  return {
    totalRevenue,
    revenueByMethod,
    dailyRevenue: Object.entries(dailyRevenue)
      .map(([date, data]: [string, any]) => ({ date, ...data }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
  }
}

async function generateOccupancyReport(supabase: any, startDate: string, endDate: string) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('check_in, check_out, status')
    .or(`check_in.gte.${startDate},check_out.gte.${startDate}`)
    .or(`check_in.lte.${endDate},check_out.lte.${endDate}`)
    .in('status', ['Confirmed', 'Checked-In'])

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id')
    .eq('is_active', true)

  const totalRooms = rooms?.length || 0
  
  // Calculate occupied rooms for each day in the range
  const start = new Date(startDate)
  const end = new Date(endDate)
  const dailyOccupancy: Record<string, number> = {}

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0]
    
    const occupiedRooms = bookings?.filter((booking: any) => {
      const checkIn = new Date(booking.check_in)
      const checkOut = new Date(booking.check_out)
      const currentDate = new Date(dateStr)
      
      return currentDate >= checkIn && currentDate < checkOut && 
             ['Confirmed', 'Checked-In'].includes(booking.status)
    }).length || 0

    dailyOccupancy[dateStr] = occupiedRooms
  }

  const averageOccupancy = Object.values(dailyOccupancy).reduce((sum, occupied) => sum + occupied, 0) / Object.keys(dailyOccupancy).length
  const occupancyRate = totalRooms > 0 ? (averageOccupancy / totalRooms) * 100 : 0

  return {
    totalRooms,
    averageOccupancy: averageOccupancy.toFixed(1),
    occupancyRate: occupancyRate.toFixed(1),
    dailyOccupancy: Object.entries(dailyOccupancy)
      .map(([date, occupied]) => ({ date, occupied, rate: totalRooms > 0 ? ((occupied / totalRooms) * 100).toFixed(1) : '0' }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}

async function generatePDFContent(type: string, data: any, startDate: string, endDate: string, generatedBy: string) {
  const generatedAt = new Date().toLocaleString()
  
  let content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Keyman Hotel Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #d97706; padding-bottom: 20px; }
    .logo { font-size: 28px; font-weight: bold; color: #d97706; margin-bottom: 10px; }
    .title { font-size: 20px; margin: 10px 0; }
    .meta { font-size: 12px; color: #666; margin: 5px 0; }
    .metrics { display: flex; justify-content: space-around; margin: 20px 0; }
    .metric { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 5px; min-width: 120px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #d97706; }
    .metric-label { font-size: 12px; color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
    th { background-color: #f9fafb; font-weight: bold; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center; }
    .status-pending { color: #d97706; }
    .status-confirmed { color: #059669; }
    .status-checked-in { color: #2563eb; }
    .status-checked-out { color: #6b7280; }
    .status-cancelled { color: #dc2626; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Keyman Hotel</div>
    <div class="title">${type.charAt(0).toUpperCase() + type.slice(1)} Report</div>
    <div class="meta">Date Range: ${startDate} to ${endDate}</div>
    <div class="meta">Generated by: ${generatedBy}</div>
    <div class="meta">Generated at: ${generatedAt}</div>
  </div>
`

  switch (type) {
    case 'bookings':
      content += generateBookingReportHTML(data)
      break
    case 'revenue':
      content += generateRevenueReportHTML(data)
      break
    case 'occupancy':
      content += generateOccupancyReportHTML(data)
      break
  }

  content += `
  <div class="footer">
    <p>Keyman Hotel Management System - Confidential Report</p>
    <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>
</body>
</html>`

  // Convert HTML to PDF (simplified version - in production, use a proper PDF library)
  // For now, return the HTML content as-is (would be converted to PDF in production)
  return Buffer.from(content, 'utf-8')
}

function generateBookingReportHTML(data: any) {
  const { bookings, metrics } = data
  
  let html = `
  <div class="metrics">
    <div class="metric">
      <div class="metric-value">${metrics.totalBookings}</div>
      <div class="metric-label">Total Bookings</div>
    </div>
    <div class="metric">
      <div class="metric-value">${metrics.confirmedBookings}</div>
      <div class="metric-label">Confirmed</div>
    </div>
    <div class="metric">
      <div class="metric-value">${metrics.cancelledBookings}</div>
      <div class="metric-label">Cancelled</div>
    </div>
    <div class="metric">
      <div class="metric-value">${metrics.occupancyRate}%</div>
      <div class="metric-label">Occupancy Rate</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Booking ID</th>
        <th>Room Type</th>
        <th>Customer</th>
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Status</th>
        <th>Amount (KES)</th>
      </tr>
    </thead>
    <tbody>
`

  bookings.forEach((booking: any) => {
    const statusClass = `status-${booking.status.toLowerCase().replace(' ', '-')}`
    html += `
      <tr>
        <td>${booking.id}</td>
        <td>${(booking.rooms as any)?.room_type || 'N/A'}</td>
        <td>${(booking.customers as any)?.full_name || 'N/A'}</td>
        <td>${new Date(booking.check_in).toLocaleDateString()}</td>
        <td>${new Date(booking.check_out).toLocaleDateString()}</td>
        <td class="${statusClass}">${booking.status}</td>
        <td>${booking.total_amount?.toLocaleString() || 0}</td>
      </tr>
    `
  })

  html += `
    </tbody>
  </table>
  `

  return html
}

function generateRevenueReportHTML(data: any) {
  const { totalRevenue, revenueByMethod, dailyRevenue } = data
  
  let html = `
  <div class="metrics">
    <div class="metric">
      <div class="metric-value">KES ${totalRevenue.toLocaleString()}</div>
      <div class="metric-label">Total Revenue</div>
    </div>
  </div>

  <h3>Revenue by Payment Method</h3>
  <table>
    <thead>
      <tr>
        <th>Payment Method</th>
        <th>Amount (KES)</th>
        <th>Percentage</th>
      </tr>
    </thead>
    <tbody>
`

  Object.entries(revenueByMethod).forEach(([method, amount]) => {
    const percentage = totalRevenue > 0 ? ((amount as number / totalRevenue) * 100).toFixed(1) : 0
    html += `
      <tr>
        <td>${method.charAt(0).toUpperCase() + method.slice(1)}</td>
        <td>${(amount as number).toLocaleString()}</td>
        <td>${percentage}%</td>
      </tr>
    `
  })

  html += `
    </tbody>
  </table>

  <h3>Daily Revenue Breakdown</h3>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Total Paid (KES)</th>
        <th>Payment Count</th>
      </tr>
    </thead>
    <tbody>
`

  dailyRevenue.forEach((day: any) => {
    html += `
      <tr>
        <td>${new Date(day.date).toLocaleDateString()}</td>
        <td>${day.total.toLocaleString()}</td>
        <td>${day.count}</td>
      </tr>
    `
  })

  html += `
    </tbody>
  </table>
  `

  return html
}

function generateOccupancyReportHTML(data: any) {
  const { totalRooms, averageOccupancy, occupancyRate, dailyOccupancy } = data
  
  let html = `
  <div class="metrics">
    <div class="metric">
      <div class="metric-value">${totalRooms}</div>
      <div class="metric-label">Total Rooms</div>
    </div>
    <div class="metric">
      <div class="metric-value">${averageOccupancy}</div>
      <div class="metric-label">Avg Occupied Rooms</div>
    </div>
    <div class="metric">
      <div class="metric-value">${occupancyRate}%</div>
      <div class="metric-label">Occupancy Rate</div>
    </div>
  </div>

  <h3>Daily Occupancy</h3>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Occupied Rooms</th>
        <th>Occupancy Rate</th>
      </tr>
    </thead>
    <tbody>
`

  dailyOccupancy.forEach((day: any) => {
    html += `
      <tr>
        <td>${new Date(day.date).toLocaleDateString()}</td>
        <td>${day.occupied}</td>
        <td>${day.rate}%</td>
      </tr>
    `
  })

  html += `
    </tbody>
  </table>
  `

  return html
}
