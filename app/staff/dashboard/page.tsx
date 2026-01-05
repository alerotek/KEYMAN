'use client'

import { useState, useEffect } from 'react'

interface StaffDashboardData {
  metrics: {
    totalBookings: number
    pendingBookings: number
    confirmedBookings: number
    checkedInBookings: number
    todayCheckIns: number
    todayCheckOuts: number
    staffRevenue: number
  }
  todayCheckIns: any[]
  todayCheckOuts: any[]
  recentBookings: any[]
}

export default function StaffDashboard() {
  const [data, setData] = useState<StaffDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard/staff')
      if (response.ok) {
        const dashboardData = await response.json()
        setData(dashboardData)
      } else {
        setError('Failed to load dashboard data')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">No data available</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Staff Dashboard</h1>
          <p className="mt-2 text-gray-600">Your assigned bookings and tasks</p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-amber-100 rounded-lg">
                <div className="text-2xl font-bold text-amber-600">📋</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.totalBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <div className="text-2xl font-bold text-green-600">✅</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today Check-ins</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.todayCheckIns}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">🚪</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today Check-outs</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.todayCheckOuts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">💰</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Your Revenue</p>
                <p className="text-2xl font-bold text-gray-900">KES {data.metrics.staffRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Check-ins</h2>
            <div className="space-y-3">
              {data.todayCheckIns.length > 0 ? (
                data.todayCheckIns.map((booking, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{(booking.customers as any)?.full_name || 'Guest'}</p>
                        <p className="text-sm text-gray-500">Room {(booking.rooms as any)?.room_number}</p>
                        <p className="text-sm text-gray-500">{(booking.rooms as any)?.room_type}</p>
                      </div>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        Check-in
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No check-ins today</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Check-outs</h2>
            <div className="space-y-3">
              {data.todayCheckOuts.length > 0 ? (
                data.todayCheckOuts.map((booking, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{(booking.customers as any)?.full_name || 'Guest'}</p>
                        <p className="text-sm text-gray-500">Room {(booking.rooms as any)?.room_number}</p>
                        <p className="text-sm text-gray-500">{(booking.rooms as any)?.room_type}</p>
                      </div>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        Check-out
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No check-outs today</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Recent Bookings</h2>
          <div className="space-y-3">
            {data.recentBookings.map((booking, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{(booking.customers as any)?.full_name || 'Guest'}</p>
                    <p className="text-sm text-gray-500">Room {(booking.rooms as any)?.room_number} • {(booking.rooms as any)?.room_type}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                    booking.status === 'Confirmed' ? 'bg-blue-100 text-blue-800' :
                    booking.status === 'Checked-In' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {booking.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
