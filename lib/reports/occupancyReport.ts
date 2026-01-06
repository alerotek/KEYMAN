import { createSupabaseServer } from '@/lib/supabase/server'

export interface OccupancyReportData {
  totalRooms: number
  occupiedRooms: number
  availableRooms: number
  overallOccupancyRate: number
  occupancyByRoomType: Array<{
    roomType: string
    totalRooms: number
    occupiedRooms: number
    occupancyRate: number
  }>
  monthlyOccupancy: Array<{
    month: string
    occupancyRate: number
    totalNights: number
    occupiedNights: number
  }>
  roomTypePerformance: Array<{
    roomType: string
    totalRevenue: number
    averageRate: number
    occupancyRate: number
    nightsOccupied: number
  }>
  currentOccupancy: Array<{
    roomId: string
    roomType: string
    roomNumber: string
    status: string
    currentGuest?: string
    checkIn?: string
    checkOut?: string
  }>
}

export async function generateOccupancyReport(startDate: string, endDate: string): Promise<OccupancyReportData> {
  const supabase = createSupabaseServer()

  // Get all rooms
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*')

  if (roomsError) throw roomsError

  const totalRooms = rooms?.length || 0

  // Get active bookings in date range
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select(`
      *,
      rooms(room_type, room_number),
      customers(full_name)
    `)
    .or(`check_in.lte.${endDate},check_out.gte.${startDate}`)
    .in('status', ['confirmed', 'checked_in'])

  if (bookingsError) throw bookingsError

  // Calculate current occupancy
  const currentDate = new Date().toISOString().split('T')[0]
  const currentBookings = bookings?.filter((booking: any) => 
    booking.check_in <= currentDate && booking.check_out >= currentDate
  ) || []

  const occupiedRooms = currentBookings.length
  const availableRooms = totalRooms - occupiedRooms
  const overallOccupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

  // Occupancy by room type
  const roomsByType = rooms?.reduce((acc: { [key: string]: any[] }, room) => {
    const type = room.room_type || 'Unknown'
    if (!acc[type]) acc[type] = []
    acc[type].push(room)
    return acc
  }, {}) || {}

  const occupancyByRoomType = Object.entries(roomsByType).map(([roomType, roomList]: [string, any]) => {
    const totalRoomsByType = roomList.length
    const occupiedRoomsByType = currentBookings.filter(booking => 
      (booking.rooms as any)?.room_type === roomType
    ).length
    const occupancyRate = totalRoomsByType > 0 ? (occupiedRoomsByType / totalRoomsByType) * 100 : 0

    return {
      roomType,
      totalRooms: totalRoomsByType,
      occupiedRooms: occupiedRoomsByType,
      occupancyRate
    }
  })

  // Monthly occupancy (simplified calculation)
  const monthlyOccupancy = bookings?.reduce((acc: Array<{ month: string; occupancyRate: number; totalNights: number; occupiedNights: number }>, booking) => {
    const month = new Date(booking.check_in).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    const nights = Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24))
    
    const existing = acc.find((item: { month: string }) => item.month === month)
    if (existing) {
      existing.occupiedNights += nights
    } else {
      acc.push({
        month,
        occupancyRate: 0,
        totalNights: totalRooms * 30, // Approximate days in month
        occupiedNights: nights
      })
    }
    return acc
  }, [] as Array<{ month: string; occupancyRate: number; totalNights: number; occupiedNights: number }>) || []

  // Calculate occupancy rates for each month
  monthlyOccupancy.forEach(month => {
    month.occupancyRate = month.totalNights > 0 ? (month.occupiedNights / month.totalNights) * 100 : 0
  })

  // Room type performance
  const roomTypePerformance = occupancyByRoomType.map(roomType => {
    const typeBookings = bookings?.filter(booking => 
      (booking.rooms as any)?.room_type === roomType.roomType
    ) || []
    
    const totalRevenue = typeBookings.reduce((sum, booking) => sum + (booking.total_amount || 0), 0)
    const totalNights = typeBookings.reduce((sum, booking) => {
      return sum + Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24))
    }, 0)
    const averageRate = totalNights > 0 ? totalRevenue / totalNights : 0
    const nightsOccupied = totalNights

    return {
      roomType: roomType.roomType,
      totalRevenue,
      averageRate,
      occupancyRate: roomType.occupancyRate,
      nightsOccupied
    }
  })

  // Current occupancy details
  const currentOccupancy = rooms?.map(room => {
    const currentBooking = currentBookings.find(booking => booking.room_id === room.id)
    return {
      roomId: room.id,
      roomType: room.room_type || 'Unknown',
      roomNumber: room.room_number || 'N/A',
      status: currentBooking ? 'occupied' : 'available',
      currentGuest: currentBooking ? (currentBooking.customers as any)?.full_name : undefined,
      checkIn: currentBooking?.check_in,
      checkOut: currentBooking?.check_out
    }
  }) || []

  return {
    totalRooms,
    occupiedRooms,
    availableRooms,
    overallOccupancyRate,
    occupancyByRoomType,
    monthlyOccupancy,
    roomTypePerformance,
    currentOccupancy
  }
}

export function generateOccupancyReportHTML(data: OccupancyReportData, startDate: string, endDate: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Occupancy Report - Keyman Hotel</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 40px; text-align: center; margin-bottom: 30px; }
    .logo { font-size: 36px; font-weight: bold; margin-bottom: 10px; }
    .report-title { font-size: 28px; margin: 20px 0; }
    .date-range { font-size: 16px; opacity: 0.9; }
    .content { max-width: 1200px; margin: 0 auto; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #7c3aed; }
    .summary-value { font-size: 32px; font-weight: bold; color: #7c3aed; margin-bottom: 5px; }
    .summary-label { font-size: 14px; color: #6b7280; text-transform: uppercase; }
    .section { background: white; padding: 30px; margin-bottom: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #111827; border-bottom: 2px solid #7c3aed; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-occupied { background: #d1fae5; color: #065f46; }
    .status-available { background: #dbeafe; color: #1e40af; }
    .status-maintenance { background: #fed7aa; color: #92400e; }
    .occupancy-bar { width: 100%; height: 20px; background: #f3f4f6; border-radius: 10px; overflow: hidden; }
    .occupancy-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #a855f7); transition: width 0.3s ease; }
    .chart-placeholder { background: #f3f4f6; height: 200px; display: flex; align-items: center; justify-content: center; color: #6b7280; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏨 Keyman Hotel</div>
    <h1 class="report-title">Occupancy Report</h1>
    <div class="date-range">${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</div>
  </div>
  
  <div class="content">
    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-value">${data.totalRooms}</div>
        <div class="summary-label">Total Rooms</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${data.occupiedRooms}</div>
        <div class="summary-label">Occupied Rooms</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${data.availableRooms}</div>
        <div class="summary-label">Available Rooms</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${data.overallOccupancyRate.toFixed(1)}%</div>
        <div class="summary-label">Occupancy Rate</div>
      </div>
    </div>

    <!-- Overall Occupancy Visual -->
    <div class="section">
      <h2 class="section-title">Current Occupancy Status</h2>
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <span>Occupancy Rate</span>
          <span>${data.overallOccupancyRate.toFixed(1)}%</span>
        </div>
        <div class="occupancy-bar">
          <div class="occupancy-fill" style="width: ${data.overallOccupancyRate}%"></div>
        </div>
      </div>
    </div>

    <!-- Occupancy by Room Type -->
    <div class="section">
      <h2 class="section-title">Occupancy by Room Type</h2>
      <table>
        <thead>
          <tr>
            <th>Room Type</th>
            <th>Total Rooms</th>
            <th>Occupied</th>
            <th>Available</th>
            <th>Occupancy Rate</th>
          </tr>
        </thead>
        <tbody>
          ${data.occupancyByRoomType.map(roomType => `
            <tr>
              <td>${roomType.roomType}</td>
              <td>${roomType.totalRooms}</td>
              <td>${roomType.occupiedRooms}</td>
              <td>${roomType.totalRooms - roomType.occupiedRooms}</td>
              <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div class="occupancy-bar" style="width: 100px; height: 8px;">
                    <div class="occupancy-fill" style="width: ${roomType.occupancyRate}%"></div>
                  </div>
                  <span>${roomType.occupancyRate.toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Monthly Occupancy Trend -->
    <div class="section">
      <h2 class="section-title">Monthly Occupancy Trend</h2>
      <div class="chart-placeholder">
        Chart: Monthly occupancy trend over time
      </div>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Occupancy Rate</th>
            <th>Occupied Nights</th>
            <th>Total Available Nights</th>
          </tr>
        </thead>
        <tbody>
          ${data.monthlyOccupancy.map(month => `
            <tr>
              <td>${month.month}</td>
              <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div class="occupancy-bar" style="width: 100px; height: 8px;">
                    <div class="occupancy-fill" style="width: ${month.occupancyRate}%"></div>
                  </div>
                  <span>${month.occupancyRate.toFixed(1)}%</span>
                </div>
              </td>
              <td>${month.occupiedNights}</td>
              <td>${month.totalNights}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Room Type Performance -->
    <div class="section">
      <h2 class="section-title">Room Type Performance</h2>
      <table>
        <thead>
          <tr>
            <th>Room Type</th>
            <th>Total Revenue</th>
            <th>Average Rate/Night</th>
            <th>Occupancy Rate</th>
            <th>Nights Occupied</th>
          </tr>
        </thead>
        <tbody>
          ${data.roomTypePerformance.map(performance => `
            <tr>
              <td>${performance.roomType}</td>
              <td>KES ${performance.totalRevenue.toLocaleString()}</td>
              <td>KES ${performance.averageRate.toLocaleString()}</td>
              <td>${performance.occupancyRate.toFixed(1)}%</td>
              <td>${performance.nightsOccupied}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Current Room Status -->
    <div class="section">
      <h2 class="section-title">Current Room Status</h2>
      <table>
        <thead>
          <tr>
            <th>Room Number</th>
            <th>Room Type</th>
            <th>Status</th>
            <th>Current Guest</th>
            <th>Check-in</th>
            <th>Check-out</th>
          </tr>
        </thead>
        <tbody>
          ${data.currentOccupancy.map(room => `
            <tr>
              <td>${room.roomNumber}</td>
              <td>${room.roomType}</td>
              <td>
                <span class="status-badge status-${room.status}">${room.status.toUpperCase()}</span>
              </td>
              <td>${room.currentGuest || '-'}</td>
              <td>${room.checkIn ? new Date(room.checkIn).toLocaleDateString() : '-'}</td>
              <td>${room.checkOut ? new Date(room.checkOut).toLocaleDateString() : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <p><strong>Keyman Hotel</strong> - Occupancy Report</p>
    <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
    <p>📍 Nairobi, Kenya | 📞 +254 123 456 789</p>
  </div>
</body>
</html>
  `
}
