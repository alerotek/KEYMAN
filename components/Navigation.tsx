'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string>('guest')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check user role (simplified for demo - in production, check auth state)
    const checkUserRole = async () => {
      try {
        // In a real app, this would check auth state from Supabase
        const role = localStorage.getItem('userRole') || 'guest'
        setUserRole(role)
      } catch (error) {
        setUserRole('guest')
      } finally {
        setIsLoading(false)
      }
    }
    
    checkUserRole()
  }, [])

  if (isLoading) {
    return (
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="text-2xl font-bold text-amber-600">Keyman Hotel</div>
            <div className="animate-pulse text-gray-500">Loading...</div>
          </div>
        </div>
      </nav>
    )
  }

  const publicLinks = [
    { href: '/home', label: 'Home' },
    { href: '/book', label: 'Book Now' },
  ]

  const customerLinks = [
    { href: '/customer/dashboard', label: 'My Bookings' },
    { href: '/book', label: 'Book New Stay' },
  ]

  const staffLinks = [
    { href: '/staff/dashboard', label: 'Dashboard' },
    { href: '/staff/bookings', label: 'Bookings' },
  ]

  const managerLinks = [
    { href: '/manager/dashboard', label: 'Dashboard' },
    { href: '/admin/bookings', label: 'Bookings' },
    { href: '/admin/rooms', label: 'Rooms' },
  ]

  const adminLinks = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/bookings', label: 'Bookings' },
    { href: '/admin/rooms', label: 'Rooms' },
    { href: '/admin/payments', label: 'Payments' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/staff', label: 'Staff' },
    { href: '/admin/audit', label: 'Audit Logs' },
  ]

  const getNavigationLinks = () => {
    switch (userRole) {
      case 'admin':
        return adminLinks
      case 'manager':
        return managerLinks
      case 'staff':
      case 'receptionist':
        return staffLinks
      case 'customer':
        return customerLinks
      default:
        return publicLinks
    }
  }

  const links = getNavigationLinks()

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/home" className="text-2xl font-bold text-amber-600">
              Keyman Hotel
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-gray-700 hover:text-amber-600 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-amber-600 border-b-2 border-amber-600'
                    : ''
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Role Switcher for Demo */}
            <div className="ml-4 pl-4 border-l border-gray-200">
              <select
                value={userRole}
                onChange={(e) => {
                  const newRole = e.target.value
                  localStorage.setItem('userRole', newRole)
                  setUserRole(newRole)
                  router.push('/home')
                }}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="guest">Guest</option>
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <div className="ml-2">
              <select
                value={userRole}
                onChange={(e) => {
                  const newRole = e.target.value
                  localStorage.setItem('userRole', newRole)
                  setUserRole(newRole)
                  router.push('/home')
                }}
                className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs border border-gray-300"
              >
                <option value="guest">Guest</option>
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="md:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-gray-700 hover:text-amber-600 block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === link.href
                    ? 'text-amber-600 bg-amber-50'
                    : ''
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
