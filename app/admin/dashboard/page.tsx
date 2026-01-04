'use client'

import { useState } from 'react'
import VehicleUsage from '../../../components/dashboard/VehicleUsage'
import RoomPerformance from '../../../components/dashboard/RoomPerformance'
import RevenueSummary from '../../../components/dashboard/RevenueSummary'
import OccupancyRate from '../../../components/dashboard/OccupancyRate'
import RepeatCustomers from '../../../components/dashboard/RepeatCustomers'
import BookingSummary from '../../../components/dashboard/BookingSummary'

export default function AdminDashboard() {
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)
    return thirtyDaysAgo.toISOString().split('T')[0]
  })

  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  // TODO: Add role-based access control for admin only
  // This should be handled at the page level or in a layout

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

        {/* Date Range Picker */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Date Range Filter</h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-sm text-gray-600">
              Showing data from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Dashboard Components Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Row 1 */}
          <RevenueSummary startDate={startDate} endDate={endDate} />
          <OccupancyRate startDate={startDate} endDate={endDate} />

          {/* Row 2 */}
          <VehicleUsage startDate={startDate} endDate={endDate} />
          <RoomPerformance startDate={startDate} endDate={endDate} />

          {/* Row 3 - Full Width */}
          <div className="lg:col-span-2">
            <RepeatCustomers startDate={startDate} endDate={endDate} />
          </div>

          {/* Row 4 - Full Width */}
          <div className="lg:col-span-2">
            <BookingSummary startDate={startDate} endDate={endDate} />
          </div>
        </div>
      </div>
    </div>
  )
}
