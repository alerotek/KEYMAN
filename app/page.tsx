import { createSupabaseServer } from '@/lib/supabase/server'
import Link from 'next/link'

async function getDashboardData() {
  const supabase = createSupabaseServer()
  
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [bookingsResponse, vehicleUsageResponse, dailyResponse] = await Promise.all([
    supabase.from('bookings').select('count').neq('status', 'Cancelled'),
    fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/reports/vehicle-usage?start_date=${thirtyDaysAgo}&end_date=${today}`),
    fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/reports/daily?date=${today}`)
  ])

  const bookings = await bookingsResponse
  const vehicleUsage = await vehicleUsageResponse.json()
  const daily = await dailyResponse.json()

  return {
    totalBookings: bookings.count || 0,
    vehicleUsage,
    daily
  }
}

export default async function HomePage() {
  const dashboardData = await getDashboardData()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Keyman Hotel Management</h1>
          <p className="mt-2 text-gray-600">Complete hotel management solution</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Bookings</h3>
            <p className="mt-2 text-3xl font-bold text-blue-600">{dashboardData.totalBookings}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Today's Revenue</h3>
            <p className="mt-2 text-3xl font-bold text-green-600">${dashboardData.daily.total_revenue || 0}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Vehicle Usage</h3>
            <p className="mt-2 text-3xl font-bold text-purple-600">{dashboardData.vehicleUsage.vehicle_percentage || 0}%</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Today's Check-ins</h3>
            <p className="mt-2 text-3xl font-bold text-orange-600">{dashboardData.daily.checkins_today || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/admin/dashboard" className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Admin Dashboard
              </Link>
              <Link href="/reception" className="block w-full text-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                Reception Desk
              </Link>
              <Link href="/bookings" className="block w-full text-center bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                View Bookings
              </Link>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">System Status</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Database</span>
                <span className="text-green-600 font-medium">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">API Routes</span>
                <span className="text-green-600 font-medium">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Auth System</span>
                <span className="text-green-600 font-medium">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
