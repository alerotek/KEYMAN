// @ts-nocheck

import { createSupabaseServer } from '@/lib/supabase/server'

export interface BookingReportData {
  totalBookings: number
  confirmedBookings: number
  pendingBookings: number
  cancelledBookings: number
  totalRevenue: number
  averageBookingValue: number
  bookingsByRoomType: Array<{
    roomType: string
    count: number
    revenue: number
  }>
  bookingsByStatus: Array<{
    status: string
    count: number
    percentage: number
  }>
  monthlyTrend: Array<{
    month: string
    bookings: number
    revenue: number
  }>
  recentBookings: Array<{
    id: string
    customerName: string
    roomType: string
    checkIn: string
    checkOut: string
    amount: number
    status: string
  }>
}

export async function generateBookingReport(startDate: string, endDate: string): Promise<BookingReportData> {
  const supabase = createSupabaseServer()

  // Get all bookings in date range
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      rooms(room_type),
      customers(full_name)
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })

  if (error) throw error

  const totalBookings = bookings?.length || 0
  const confirmedBookings = bookings?.filter((b: any) => b.status === 'confirmed').length || 0
  const pendingBookings = bookings?.filter((b: any) => b.status === 'pending').length || 0
  const cancelledBookings = bookings?.filter((b: any) => b.status === 'cancelled').length || 0
  const totalRevenue = bookings?.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0) || 0
  const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0

  // Bookings by room type
  const bookingsByRoomType = bookings?.reduce((acc: Array<{ roomType: string; count: number; revenue: number }>, booking) => {
    const roomType = (booking.rooms as any)?.room_type || 'Unknown'
    const existing = acc.find((item: { roomType: string }) => item.roomType === roomType)
    if (existing) {
      existing.count += 1
      existing.revenue += booking.total_amount || 0
    } else {
      acc.push({
        roomType,
        count: 1,
        revenue: booking.total_amount || 0
      })
    }
    return acc
  }, [] as Array<{ roomType: string; count: number; revenue: number }>) || []

  // Bookings by status
  const bookingsByStatus = [
    { status: 'confirmed', count: confirmedBookings, percentage: totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0 },
    { status: 'pending', count: pendingBookings, percentage: totalBookings > 0 ? (pendingBookings / totalBookings) * 100 : 0 },
    { status: 'cancelled', count: cancelledBookings, percentage: totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0 }
  ]

  // Monthly trend (simplified - groups by month)
  const monthlyTrend = bookings?.reduce((acc: Array<{ month: string; bookings: number; revenue: number }>, booking) => {
    const month = new Date(booking.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    const existing = acc.find((item: { month: string }) => item.month === month)
    if (existing) {
      existing.bookings += 1
      existing.revenue += booking.total_amount || 0
    } else {
      acc.push({
        month,
        bookings: 1,
        revenue: booking.total_amount || 0
      })
    }
    return acc
  }, [] as Array<{ month: string; bookings: number; revenue: number }>) || []

  // Recent bookings
  const recentBookings = bookings?.slice(0, 10).map(booking => ({
    id: booking.id,
    customerName: (booking.customers as any)?.full_name || 'Unknown',
    roomType: (booking.rooms as any)?.room_type || 'Unknown',
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    amount: booking.total_amount || 0,
    status: booking.status
  })) || []

  return {
    totalBookings,
    confirmedBookings,
    pendingBookings,
    cancelledBookings,
    totalRevenue,
    averageBookingValue,
    bookingsByRoomType,
    bookingsByStatus,
    monthlyTrend,
    recentBookings
  }
}

export function generateBookingReportHTML(data: BookingReportData, startDate: string, endDate: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Booking Report - Keyman Hotel</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .header { background: linear-gradient(135deg, #d97706, #f59e0b); color: white; padding: 40px; text-align: center; margin-bottom: 30px; }
    .logo { font-size: 36px; font-weight: bold; margin-bottom: 10px; }
    .report-title { font-size: 28px; margin: 20px 0; }
    .date-range { font-size: 16px; opacity: 0.9; }
    .content { max-width: 1200px; margin: 0 auto; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #d97706; }
    .summary-value { font-size: 32px; font-weight: bold; color: #d97706; margin-bottom: 5px; }
    .summary-label { font-size: 14px; color: #6b7280; text-transform: uppercase; }
    .section { background: white; padding: 30px; margin-bottom: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #111827; border-bottom: 2px solid #d97706; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-confirmed { background: #d1fae5; color: #065f46; }
    .status-pending { background: #fed7aa; color: #92400e; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }
    .chart-placeholder { background: #f3f4f6; height: 200px; display: flex; align-items: center; justify-content: center; color: #6b7280; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏨 Keyman Hotel</div>
    <h1 class="report-title">Booking Report</h1>
    <div class="date-range">${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</div>
  </div>
  
  <div class="content">
    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-value">${data.totalBookings}</div>
        <div class="summary-label">Total Bookings</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${data.confirmedBookings}</div>
        <div class="summary-label">Confirmed</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">KES ${data.totalRevenue.toLocaleString()}</div>
        <div class="summary-label">Total Revenue</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">KES ${data.averageBookingValue.toLocaleString()}</div>
        <div class="summary-label">Avg. Booking Value</div>
      </div>
    </div>

    <!-- Bookings by Status -->
    <div class="section">
      <h2 class="section-title">Bookings by Status</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${data.bookingsByStatus.map(status => `
            <tr>
              <td>
                <span class="status-badge status-${status.status}">${status.status.toUpperCase()}</span>
              </td>
              <td>${status.count}</td>
              <td>${status.percentage.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Bookings by Room Type -->
    <div class="section">
      <h2 class="section-title">Bookings by Room Type</h2>
      <table>
        <thead>
          <tr>
            <th>Room Type</th>
            <th>Bookings</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${data.bookingsByRoomType.map(room => `
            <tr>
              <td>${room.roomType}</td>
              <td>${room.count}</td>
              <td>KES ${room.revenue.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Monthly Trend -->
    <div class="section">
      <h2 class="section-title">Monthly Trend</h2>
      <div class="chart-placeholder">
        Chart: Monthly bookings and revenue trend
      </div>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Bookings</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${data.monthlyTrend.map(month => `
            <tr>
              <td>${month.month}</td>
              <td>${month.bookings}</td>
              <td>KES ${month.revenue.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Recent Bookings -->
    <div class="section">
      <h2 class="section-title">Recent Bookings</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Room Type</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.recentBookings.map(booking => `
            <tr>
              <td>#${booking.id}</td>
              <td>${booking.customerName}</td>
              <td>${booking.roomType}</td>
              <td>${new Date(booking.checkIn).toLocaleDateString()}</td>
              <td>${new Date(booking.checkOut).toLocaleDateString()}</td>
              <td>KES ${booking.amount.toLocaleString()}</td>
              <td>
                <span class="status-badge status-${booking.status}">${booking.status.toUpperCase()}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <p><strong>Keyman Hotel</strong> - Booking Report</p>
    <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
    <p>📍 Nairobi, Kenya | 📞 +254 123 456 789</p>
  </div>
</body>
</html>
  `
}
