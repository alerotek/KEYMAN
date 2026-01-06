import { createSupabaseServer } from '@/lib/supabase/server'

export interface RevenueReportData {
  totalRevenue: number
  totalPayments: number
  averagePaymentAmount: number
  revenueByPaymentMethod: Record<string, number>
  revenueByDate: Array<{ date: string; revenue: number; count: number }>
  revenueByRoomType: Array<{ roomType: string; revenue: number; count: number }>
  paymentMethods: Array<{ method: string; count: number; revenue: number; percentage: number }>
  dailyRevenue: Array<{ date: string; revenue: number; payments: number }>
  period: {
    startDate: string
    endDate: string
    totalDays: number
  }
}

export async function generateRevenueReport(startDate: string, endDate: string): Promise<RevenueReportData> {
  const supabase = createSupabaseServer()

  try {
    // Get all payments within date range, excluding cancelled bookings
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        id,
        amount_paid,
        method,
        paid_at,
        booking_id,
        bookings!inner(
          id,
          status,
          rooms!inner(
            id,
            room_type
          )
        )
      `)
      .gte('paid_at', startDate)
      .lte('paid_at', endDate + ' 23:59:59')
      .eq('bookings.status', 'Confirmed') // Exclude cancelled bookings
      .order('paid_at', { ascending: false })

    if (error) {
      console.error('Error fetching revenue data:', error)
      throw new Error('Failed to fetch revenue data')
    }

    // Calculate total revenue and payments
    const totalRevenue = payments.reduce((sum: number, payment: any) => sum + payment.amount_paid, 0)
    const totalPayments = payments.length
    const averagePaymentAmount = totalRevenue / totalPayments

    // Revenue by payment method
    const revenueByPaymentMethod = payments.reduce((acc: Record<string, number>, payment: any) => {
      const method = payment.method || 'unknown'
      acc[method] = (acc[method] || 0) + payment.amount_paid
      return acc
    }, {} as Record<string, number>)

    // Revenue by date
    const revenueByDate = payments.reduce((acc: Array<{ date: string; revenue: number; count: number }>, payment: any) => {
      const date = payment.paid_at.split('T')[0]
      const existing = acc.find((item: { date: string }) => item.date === date)
      if (existing) {
        existing.revenue += payment.amount_paid
        existing.count += 1
      } else {
        acc.push({ date, revenue: payment.amount_paid, count: 1 })
      }
      return acc
    }, [] as Array<{ date: string; revenue: number; count: number }>)

    // Revenue by room type
    const revenueByRoomType = payments.reduce((acc: Array<{ roomType: string; revenue: number; count: number }>, payment: any) => {
      const roomType = payment.bookings?.rooms?.room_type || 'Unknown'
      const existing = acc.find((item: { roomType: string }) => item.roomType === roomType)
      if (existing) {
        existing.revenue += payment.amount_paid
        existing.count += 1
      } else {
        acc.push({ roomType, revenue: payment.amount_paid, count: 1 })
      }
      return acc
    }, [] as Array<{ roomType: string; revenue: number; count: number }>)

    // Payment methods with percentages
    const paymentMethods = Object.entries(revenueByPaymentMethod).map(([method, revenue]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      count: payments.filter((p: any) => p.method === method).length,
      revenue: revenue as number,
      percentage: totalRevenue > 0 ? (revenue as number / totalRevenue) * 100 : 0
    }))

    // Daily revenue data
    const dailyRevenue = revenueByDate.map(({ date, revenue, count }) => ({
      date,
      revenue,
      payments: count
    })).sort((a: any, b: any) => a.date.localeCompare(b.date))

    return {
      totalRevenue,
      totalPayments,
      averagePaymentAmount,
      revenueByPaymentMethod,
      revenueByDate,
      revenueByRoomType,
      paymentMethods,
      dailyRevenue,
      period: {
        startDate,
        endDate,
        totalDays: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
      }
    }
  } catch (error) {
    console.error('Revenue report generation error:', error)
    throw new Error('Failed to generate revenue report')
  }
}

export function generateRevenueReportHTML(data: RevenueReportData, startDate: string, endDate: string): string {
  const {
    totalRevenue,
    totalPayments,
    averagePaymentAmount,
    paymentMethods,
    revenueByRoomType,
    dailyRevenue,
    period
  } = data

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Revenue Report - Keyman Hotel</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #1f2937; background: #f9fafb; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #d97706, #f59e0b); color: white; padding: 40px; text-align: center; border-radius: 12px 12px 0 0; }
    .logo { font-size: 36px; font-weight: bold; margin-bottom: 10px; }
    .title { font-size: 24px; margin: 10px 0; opacity: 0.9; }
    .period { font-size: 16px; opacity: 0.8; }
    .content { padding: 40px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .metric { background: #f8fafc; padding: 24px; border-radius: 8px; border-left: 4px solid #d97706; }
    .metric-value { font-size: 32px; font-weight: bold; color: #d97706; margin-bottom: 8px; }
    .metric-label { font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .section { margin-bottom: 40px; }
    .section-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f8fafc; font-weight: 600; color: #374151; }
    .percentage { background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .footer { text-align: center; padding: 30px; background: #f8fafc; border-radius: 0 0 12px 12px; color: #64748b; font-size: 12px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; color: #f3f4f6; z-index: -1; opacity: 0.3; font-weight: bold; }
  </style>
</head>
<body>
  <div class="watermark">KEYMAN HOTEL</div>
  
  <div class="container">
    <div class="header">
      <div class="logo">🏨 Keyman Hotel</div>
      <div class="title">Revenue Report</div>
      <div class="period">${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</div>
      <div class="period">Generated: ${new Date().toLocaleString()}</div>
    </div>
    
    <div class="content">
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">KES ${totalRevenue.toLocaleString()}</div>
          <div class="metric-label">Total Revenue</div>
        </div>
        <div class="metric">
          <div class="metric-value">${totalPayments}</div>
          <div class="metric-label">Total Payments</div>
        </div>
        <div class="metric">
          <div class="metric-value">KES ${averagePaymentAmount.toLocaleString()}</div>
          <div class="metric-label">Average Payment</div>
        </div>
        <div class="metric">
          <div class="metric-value">${period.totalDays}</div>
          <div class="metric-label">Report Period (Days)</div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">Revenue by Payment Method</h2>
        <table>
          <thead>
            <tr>
              <th>Payment Method</th>
              <th>Count</th>
              <th>Revenue (KES)</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${paymentMethods.map((method: any) => `
              <tr>
                <td>${method.method}</td>
                <td>${method.count}</td>
                <td>KES ${method.revenue.toLocaleString()}</td>
                <td><span class="percentage">${method.percentage.toFixed(1)}%</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2 class="section-title">Revenue by Room Type</h2>
        <table>
          <thead>
            <tr>
              <th>Room Type</th>
              <th>Bookings</th>
              <th>Revenue (KES)</th>
              <th>Average per Booking</th>
            </tr>
          </thead>
          <tbody>
            ${revenueByRoomType.map((room: any) => `
              <tr>
                <td>${room.roomType}</td>
                <td>${room.count}</td>
                <td>KES ${room.revenue.toLocaleString()}</td>
                <td>KES ${Math.round(room.revenue / room.count).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2 class="section-title">Daily Revenue Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Revenue (KES)</th>
              <th>Number of Payments</th>
            </tr>
          </thead>
          <tbody>
            ${dailyRevenue.slice(0, 30).map((day: any) => `
              <tr>
                <td>${new Date(day.date).toLocaleDateString()}</td>
                <td>KES ${day.revenue.toLocaleString()}</td>
                <td>${day.payments}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${dailyRevenue.length > 30 ? `<p><em>Showing first 30 days of ${dailyRevenue.length} total days</em></p>` : ''}
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Keyman Hotel Management System</strong></p>
      <p>📍 Nairobi, Kenya | 📞 +254 123 456 789</p>
      <p>Confidential Revenue Report - Admin Only</p>
      <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
    </div>
  </div>
</body>
</html>
  `
}
