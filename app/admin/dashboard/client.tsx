'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ReportData {
  vehicleUsage: any
  daily: any
  roomPerformance: any[]
  staffPerformance: any[]
  repeatCustomers: any[]
}

export default function DashboardClient({ data }: { data: ReportData }) {
  const [selectedPeriod, setSelectedPeriod] = useState('30days')

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <nav className="flex space-x-4">
          <Link 
            href="/admin/dashboard" 
            className="px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700"
          >
            Dashboard
          </Link>
          <Link 
            href="/admin/audit" 
            className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            Audit Log
          </Link>
        </nav>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Today's Revenue</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">${data.daily.total_revenue || 0}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Vehicle Usage</h3>
          <p className="mt-2 text-3xl font-bold text-blue-600">{data.vehicleUsage.vehicle_percentage || 0}%</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Bookings</h3>
          <p className="mt-2 text-3xl font-bold text-purple-600">{data.daily.total_bookings || 0}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Outstanding Balance</h3>
          <p className="mt-2 text-3xl font-bold text-orange-600">${data.daily.outstanding_balance || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Vehicle Usage Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-700">Vehicle Bookings</h4>
            <p className="text-2xl font-bold text-blue-600">{data.vehicleUsage.vehicle_count}</p>
            <p className="text-sm text-gray-500">Revenue: ${data.vehicleUsage.vehicle_revenue}</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700">Non-Vehicle Bookings</h4>
            <p className="text-2xl font-bold text-gray-600">{data.vehicleUsage.non_vehicle_count}</p>
            <p className="text-sm text-gray-500">Revenue: ${data.vehicleUsage.non_vehicle_revenue}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Room Performance</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.roomPerformance.map((room: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{room.room_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{room.booking_count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${room.total_revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Staff Performance</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.staffPerformance.map((staff: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{staff.staff_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.role}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.booking_count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${staff.total_revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Repeat Customers</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.repeatCustomers.map((customer: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.full_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.booking_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
