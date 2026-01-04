import { createSupabaseServer } from '@/lib/supabase/server'
import DashboardClient from './client'

async function getReportData() {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [vehicleUsage, daily, roomPerformance, staffPerformance, repeatCustomers] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/reports/vehicle-usage?start_date=${thirtyDaysAgo}&end_date=${today}`),
    fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/reports/daily?date=${today}`),
    fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/reports/room-performance?start_date=${thirtyDaysAgo}&end_date=${today}`),
    fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/reports/staff-performance?start_date=${thirtyDaysAgo}&end_date=${today}`),
    fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/reports/repeat-customers`)
  ])

  return {
    vehicleUsage: await vehicleUsage.json(),
    daily: await daily.json(),
    roomPerformance: await roomPerformance.json(),
    staffPerformance: await staffPerformance.json(),
    repeatCustomers: await repeatCustomers.json()
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
