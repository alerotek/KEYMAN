import { createSupabaseServer } from '@/lib/supabase/server'
import DashboardClient from './client'
import { getVehicleUsageReport, getDailyRevenue, getRoomPerformanceReport, getStaffPerformanceReport, getRepeatCustomersReport } from '@/lib/api-client'

async function getReportData() {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Direct database calls instead of HTTP self-calls
  const [vehicleUsage, daily, roomPerformance, staffPerformance, repeatCustomers] = await Promise.all([
    getVehicleUsageReport(thirtyDaysAgo, today),
    getDailyRevenue(today),
    getRoomPerformanceReport(thirtyDaysAgo, today),
    getStaffPerformanceReport(thirtyDaysAgo, today),
    getRepeatCustomersReport()
  ])

  const vehicleData = vehicleUsage
  const dailyData = daily

  return {
    vehicleUsage: vehicleData,
    daily: dailyData,
    roomPerformance,
    staffPerformance,
    repeatCustomers
  }
}

export default async function AdminDashboard() {
  const reportData = await getReportData()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">Hotel management analytics and reports</p>
        </div>

        <DashboardClient data={reportData} />
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
