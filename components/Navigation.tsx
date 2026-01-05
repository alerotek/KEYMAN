'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check user role (simplified for demo)
    const checkUserRole = async () => {
      try {
        // In a real app, this would check auth state
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
      <nav className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="text-xl font-bold">Keyman Hotel</div>
            <div className="animate-pulse">Loading...</div>
          </div>
        </div>
      </nav>
    )
  }

  const publicLinks = [
    { href: '/', label: 'Home' },
    { href: '/book', label: 'Book Now' },
    { href: '/contact', label: 'Contact' },
  ]

  const guestLinks = [
    { href: '/my-bookings', label: 'My Bookings' },
    { href: '/book', label: 'Book New Stay' },
    { href: '/payments', label: 'Payments' },
    { href: '/profile', label: 'Profile' },
  ]

  const staffLinks = [
    { href: '/staff/dashboard', label: 'Dashboard' },
    { href: '/staff/bookings', label: 'Bookings' },
    { href: '/staff/payments', label: 'Payments' },
    { href: '/staff/guests', label: 'Guests' },
  ]

  const adminLinks = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/rooms', label: 'Rooms' },
    { href: '/admin/bookings', label: 'Bookings' },
    { href: '/admin/payments', label: 'Payments' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/staff', label: 'Staff' },
    { href: '/admin/audit', label: 'Audit Logs' },
  ]

  const getNavigationLinks = () => {
    switch (userRole) {
      case 'admin':
      case 'manager':
        return adminLinks
      case 'staff':
      case 'receptionist':
        return staffLinks
      case 'customer':
        return guestLinks
      default:
        return publicLinks
    }
  }

  const links = getNavigationLinks()

  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold">
              Keyman Hotel
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === link.href
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Role Switcher for Demo */}
            <div className="ml-4 pl-4 border-l border-gray-600">
              <select
                value={userRole || 'guest'}
                onChange={(e) => {
                  const newRole = e.target.value
                  localStorage.setItem('userRole', newRole)
                  setUserRole(newRole)
                  router.push('/')
                }}
                className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
              >
                <option value="guest">Guest</option>
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
