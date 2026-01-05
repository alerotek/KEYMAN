'use client'

import { useState, useEffect } from 'react'

interface CustomerDashboardData {
  metrics: {
    totalBookings: number
    pendingBookings: number
    confirmedBookings: number
    activeBookings: number
    totalPayments: number
  }
  bookings: any[]
}

export default function CustomerDashboard() {
  const [data, setData] = useState<CustomerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard/customer')
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
          <h1 className="text-4xl font-bold text-gray-900">My Bookings</h1>
          <p className="mt-2 text-gray-600">Manage your hotel reservations</p>
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
                <p className="text-sm font-medium text-gray-500">Active Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.activeBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">⏳</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.pendingBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">💰</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Paid</p>
                <p className="text-2xl font-bold text-gray-900">KES {data.metrics.totalPayments.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Booking History</h2>
          <div className="space-y-4">
            {data.bookings.map((booking, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="font-medium text-gray-900 mr-3">
                        Room {(booking.rooms as any)?.room_number} • {(booking.rooms as any)?.room_type}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        booking.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        booking.status === 'Confirmed' ? 'bg-blue-100 text-blue-800' :
                        booking.status === 'Checked-In' ? 'bg-green-100 text-green-800' :
                        booking.status === 'Checked-Out' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Check-in</p>
                        <p className="font-medium">{new Date(booking.check_in).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Check-out</p>
                        <p className="font-medium">{new Date(booking.check_out).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total Amount</p>
                        <p className="font-medium">KES {booking.total_amount?.toLocaleString()}</p>
                      </div>
                    </div>
                    {(booking.payments as any[])?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">Payments</p>
                        <div className="space-y-1">
                          {(booking.payments as any[]).map((payment, paymentIndex) => (
                            <div key={paymentIndex} className="flex justify-between text-sm">
                              <span className="text-gray-600">{payment.method} • {new Date(payment.paid_at).toLocaleDateString()}</span>
                              <span className="font-medium">KES {payment.amount_paid.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
