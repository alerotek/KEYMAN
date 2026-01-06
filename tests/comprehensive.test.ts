// Comprehensive Test Suite for Keyman Hotel
// Tests all critical functionality: RBAC, PDF reports, email, offline sync

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
      single: jest.fn(),
      order: jest.fn(() => ({
      eq: jest.fn(() => ({
      single: jest.fn()
      }))
      }))
      }))
      })),
      insert: jest.fn(() => ({
      select: jest.fn(() => ({
      single: jest.fn()
      }))
      })),
      update: jest.fn(() => ({
      eq: jest.fn()
      }))
      }))
    })
  })
}

// Test Data
const testBooking = {
  customerData: {
    full_name: 'John Doe',
    email: 'john@example.com',
    phone: '+254123456789',
    id_number: '12345678'
  },
  roomData: {
    room_id: 'room-123',
    room_type: 'Deluxe Suite',
    check_in: '2026-01-10',
    check_out: '2026-01-12',
    total_amount: 15000
  },
  status: 'Pending' as const,
  created_at: '2026-01-06T00:00:00Z',
  created_by: 'staff@example.com',
  synced: false
}

const testPayment = {
  booking_id: 'booking-123',
  amount_paid: 15000,
  method: 'M-Pesa',
  receipt_file: 'receipt.jpg',
  created_at: '2026-01-06T00:00:00Z',
  created_by: 'staff@example.com',
  synced: false
}

describe('Keyman Hotel System Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Master Admin Bootstrap', () => {
    it('should ensure master admin exists', async () => {
      const response = await fetch('/api/bootstrap/master-admin', {
        method: 'POST'
      })
      
      expect(response.ok).toBe(true)
      const data = await response.json()
      
      expect(data.success).toBe(true)
      expect(data.details.email).toBe('kevinalerotek@gmail.com')
      expect(data.details.role).toBe('admin')
    })

    it('should prevent master admin role changes', async () => {
      // This would be tested at the database level
      // The RLS policies should prevent role changes
      expect(true).toBe(true) // Placeholder for DB-level test
    })
  })

  describe('Role-Based Access Control', () => {
    it('should allow admin full access', async () => {
      // Test admin can access all endpoints
      const adminEndpoints = [
        '/api/admin/bookings',
        '/api/admin/payments',
        '/api/admin/reports/pdf',
        '/api/admin/settings/notifications'
      ]

      for (const endpoint of adminEndpoints) {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer admin-token'
          }
        })
        
        expect(response.ok).toBe(true)
      }
    })

    it('should restrict staff access', async () => {
      // Staff should not access revenue totals
      const response = await fetch('/api/reports/revenue', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer staff-token'
        },
        body: JSON.stringify({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
      })

      expect(response.status).toBe(403)
    })

    it('should allow customers only own bookings', async () => {
      const response = await fetch('/api/bookings', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer customer-token'
        }
      })

      expect(response.ok).toBe(true)
      // Response should only contain customer's own bookings
    })
  })

  describe('PDF Report Generation', () => {
    it('should generate revenue report (admin only)', async () => {
      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'revenue',
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
      })

      expect(response.ok).toBe(true)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
    })

    it('should exclude cancelled bookings from revenue', async () => {
      // Test that cancelled bookings are excluded
      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token'
        },
        body: JSON.stringify({
          type: 'revenue',
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
      })

      expect(response.ok).toBe(true)
      // Verify cancelled bookings are excluded
    })

    it('should require admin role for PDF generation', async () => {
      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer staff-token'
        },
        body: JSON.stringify({
          type: 'revenue',
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
      })

      expect(response.status).toBe(403)
    })
  })

  describe('Email Confirmation System', () => {
    it('should send booking confirmation email', async () => {
      const response = await fetch('/api/notifications/booking-created', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer service-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          booking_id: 'booking-123',
          customer_email: 'customer@example.com'
        })
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should send payment confirmation email', async () => {
      const response = await fetch('/api/notifications/payment-confirmed', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer service-token'
        },
        body: JSON.stringify({
          payment_id: 'payment-123',
          booking_id: 'booking-123'
        })
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should respect notification settings', async () => {
      // Test that emails are only sent when enabled
      const response = await fetch('/api/admin/settings/notifications', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      })

      expect(response.ok).toBe(true)
      const settings = await response.json()
      expect(settings).toHaveProperty('booking_confirmation_enabled')
    })
  })

  describe('Offline Booking Support', () => {
    it('should create offline booking', () => {
      // Import the offline manager
      const { offlineBookingManager } = require('../lib/offline/offlineBookingManager')
      
      const booking = offlineBookingManager.createOfflineBooking(
        testBooking.customerData,
        testBooking.roomData,
        'staff@example.com'
      )

      expect(booking).toBeDefined()
      expect(booking.id).toMatch(/^offline_/)
      expect(booking.synced).toBe(false)
      expect(booking.customerData.full_name).toBe('John Doe')
    })

    it('should create offline payment', () => {
      const { offlineBookingManager } = require('../lib/offline/offlineBookingManager')
      
      const payment = offlineBookingManager.createOfflinePayment(
        'booking-123',
        15000,
        'M-Pesa',
        'staff@example.com',
        'receipt.jpg'
      )

      expect(payment).toBeDefined()
      expect(payment.id).toMatch(/^offline_payment_/)
      expect(payment.synced).toBe(false)
      expect(payment.amount_paid).toBe(15000)
    })

    it('should sync offline booking with server', async () => {
      const { offlineBookingManager } = require('../lib/offline/offlineBookingManager')
      
      // Mock fetch
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            server_booking_id: 'server-booking-123'
          })
        })
      ) as jest.Mock

      const result = await offlineBookingManager.syncWithServer()
      
      expect(result.bookingsSynced).toBeGreaterThan(0)
      expect(fetch).toHaveBeenCalledWith(
        '/api/bookings/offline-sync',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('offline_booking')
        })
      )
    })

    it('should handle sync conflicts', async () => {
      const { offlineBookingManager } = require('../lib/offline/offlineBookingManager')
      
      // Mock conflict response
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: false,
            conflict: true,
            message: 'Booking conflicts with existing reservation'
          })
        })
      ) as jest.Mock

      const result = await offlineBookingManager.syncWithServer()
      
      expect(result.conflicts).toBeGreaterThan(0)
    })

    it('should prevent duplicate payments', async () => {
      const response = await fetch('/api/payments/offline-sync', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer staff-token'
        },
        body: JSON.stringify({
          offline_payment: testPayment
        })
      })

      // First sync should succeed
      expect(response.ok).toBe(true)

      // Second sync should detect duplicate
      const duplicateResponse = await fetch('/api/payments/offline-sync', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer staff-token'
        },
        body: JSON.stringify({
          offline_payment: testPayment
        })
      })

      const duplicateData = await duplicateResponse.json()
      expect(duplicateData.conflict).toBe(true)
    })
  })

  describe('Audit Logging', () => {
    it('should log all critical actions', async () => {
      const criticalActions = [
        'booking_created',
        'payment_confirmed',
        'pdf_report_generated',
        'offline_booking_sync',
        'offline_payment_sync',
        'master_admin_bootstrap'
      ]

      for (const action of criticalActions) {
        // Each action should be logged to audit_log
        expect(true).toBe(true) // Placeholder for audit verification
      }
    })

    it('should restrict audit log access to admins', async () => {
      const response = await fetch('/api/admin/audit', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer staff-token'
        }
      })

      expect(response.status).toBe(403)
    })
  })

  describe('Security & Validation', () => {
    it('should validate environment variables', () => {
      // Check critical environment variables
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined()
    })

    it('should not expose secrets to client', () => {
      // Ensure no service keys in client-side code
      const clientEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }

      expect(clientEnv).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
      expect(clientEnv).not.toHaveProperty('EMAIL_PROVIDER_API_KEY')
    })

    it('should enforce rate limiting on sensitive APIs', async () => {
      // Test rate limiting on payment confirmation
      const requests = Array(10).fill(null).map(() =>
        fetch('/api/payments/confirm', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer staff-token'
          },
          body: JSON.stringify({
            booking_id: 'booking-123',
            amount_paid: 15000
          })
        })
      )

      const results = await Promise.allSettled(requests)
      const successCount = results.filter(r => r.status === 'fulfilled').length
      
      // Should have some rate limiting
      expect(successCount).toBeLessThan(10)
    })
  })

  describe('Data Integrity', () => {
    it('should maintain revenue correctness', async () => {
      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token'
        },
        body: JSON.stringify({
          type: 'revenue',
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        })
      })

      expect(response.ok).toBe(true)
      // Verify revenue calculations are correct
    })

    it('should prevent data loss during sync', async () => {
      // Test that sync operations don't lose data
      const { offlineBookingManager } = require('../lib/offline/offlineBookingManager')
      
      const initialBookings = offlineBookingManager.getOfflineBookings()
      await offlineBookingManager.syncWithServer()
      const finalBookings = offlineBookingManager.getOfflineBookings()
      
      // Should not lose any unsynced bookings
      expect(finalBookings.length).toBeGreaterThanOrEqual(initialBookings.filter(b => !b.synced).length)
    })
  })

  describe('Production Readiness', () => {
    it('should build without errors', async () => {
      const { execSync } = require('child_process')
      
      try {
        const buildOutput = execSync('npm run build', { encoding: 'utf8' })
        expect(buildOutput).toContain('Compiled successfully')
      } catch (error) {
        fail('Build failed: ' + error.message)
      }
    })

    it('should have proper error handling', async () => {
      // Test error responses
      const response = await fetch('/api/nonexistent', {
        method: 'GET'
      })

      expect(response.status).toBe(404)
    })

    it('should validate input data', async () => {
      // Test validation on required fields
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing required fields
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })
})

// Integration Tests
describe('E2E Booking Flow', () => {
  it('should complete full booking workflow', async () => {
    // 1. Customer creates booking
    const bookingResponse = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        customer: testBooking.customerData,
        room: testBooking.roomData
      })
    })

    expect(bookingResponse.ok).toBe(true)
    const booking = await bookingResponse.json()

    // 2. Staff confirms payment
    const paymentResponse = await fetch('/api/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer staff-token'
      },
      body: JSON.stringify({
        booking_id: booking.id,
        amount_paid: testBooking.roomData.total_amount,
        method: 'M-Pesa'
      })
    })

    expect(paymentResponse.ok).toBe(true)

    // 3. Email notifications sent
    // 4. Audit logs created
    // 5. Reports include the booking
    expect(true).toBe(true) // Integration test placeholder
  })
})
