// Offline-Safe Booking Support
// Enables staff to create bookings and queue payments when offline
// Syncs with server when online with conflict resolution

interface OfflineBooking {
  id: string
  customerData: {
    full_name: string
    email: string
    phone: string
    id_number?: string
  }
  roomData: {
    room_id: string
    room_type: string
    check_in: string
    check_out: string
    total_amount: number
  }
  status: 'Pending' | 'Confirmed'
  created_at: string
  created_by: string
  synced: boolean
  server_booking_id?: string
  conflict_resolved?: boolean
}

interface OfflinePayment {
  id: string
  booking_id: string
  amount_paid: number
  method: string
  receipt_file?: string
  created_at: string
  created_by: string
  synced: boolean
  server_payment_id?: string
  conflict_resolved: boolean
}

class OfflineBookingManager {
  private readonly BOOKINGS_KEY = 'keyman_hotel_offline_bookings'
  private readonly PAYMENTS_KEY = 'keyman_hotel_offline_payments'
  private readonly SYNC_QUEUE_KEY = 'keyman_hotel_sync_queue'

  // Storage operations
  private getFromStorage<T>(key: string): T[] {
    if (typeof window === 'undefined') return []
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error(`Error reading ${key} from storage:`, error)
      return []
    }
  }

  private setToStorage<T>(key: string, data: T[]): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error(`Error writing ${key} to storage:`, error)
    }
  }

  // Booking operations
  createOfflineBooking(
    customerData: OfflineBooking['customerData'],
    roomData: OfflineBooking['roomData'],
    createdBy: string
  ): OfflineBooking {
    const booking: OfflineBooking = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerData,
      roomData,
      status: 'Pending',
      created_at: new Date().toISOString(),
      created_by: createdBy,
      synced: false
    }

    const bookings = this.getFromStorage<OfflineBooking>(this.BOOKINGS_KEY)
    bookings.push(booking)
    this.setToStorage(this.BOOKINGS_KEY, bookings)

    console.log('✅ Offline booking created:', booking.id)
    return booking
  }

  getOfflineBookings(): OfflineBooking[] {
    return this.getFromStorage<OfflineBooking>(this.BOOKINGS_KEY)
  }

  getUnsyncedBookings(): OfflineBooking[] {
    return this.getOfflineBookings().filter(booking => !booking.synced)
  }

  markBookingAsSynced(offlineId: string, serverId: string): void {
    const bookings = this.getFromStorage<OfflineBooking>(this.BOOKINGS_KEY)
    const bookingIndex = bookings.findIndex(b => b.id === offlineId)
    
    if (bookingIndex !== -1) {
      bookings[bookingIndex].synced = true
      bookings[bookingIndex].server_booking_id = serverId
      this.setToStorage(this.BOOKINGS_KEY, bookings)
      console.log('✅ Booking marked as synced:', offlineId, '→', serverId)
    }
  }

  // Payment operations
  createOfflinePayment(
    bookingId: string,
    amountPaid: number,
    method: string,
    createdBy: string,
    receiptFile?: string
  ): OfflinePayment {
    const payment: OfflinePayment = {
      id: `offline_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      booking_id: bookingId,
      amount_paid: amountPaid,
      method,
      receipt_file: receiptFile,
      created_at: new Date().toISOString(),
      created_by: createdBy,
      synced: false,
      conflict_resolved: false
    }

    const payments = this.getFromStorage<OfflinePayment>(this.PAYMENTS_KEY)
    payments.push(payment)
    this.setToStorage(this.PAYMENTS_KEY, payments)

    console.log('✅ Offline payment created:', payment.id)
    return payment
  }

  getOfflinePayments(): OfflinePayment[] {
    return this.getFromStorage<OfflinePayment>(this.PAYMENTS_KEY)
  }

  getUnsyncedPayments(): OfflinePayment[] {
    return this.getOfflinePayments().filter(payment => !payment.synced)
  }

  markPaymentAsSynced(offlineId: string, serverId: string): void {
    const payments = this.getFromStorage<OfflinePayment>(this.PAYMENTS_KEY)
    const paymentIndex = payments.findIndex(p => p.id === offlineId)
    
    if (paymentIndex !== -1) {
      payments[paymentIndex].synced = true
      payments[paymentIndex].server_payment_id = serverId
      this.setToStorage(this.PAYMENTS_KEY, payments)
      console.log('✅ Payment marked as synced:', offlineId, '→', serverId)
    }
  }

  // Sync operations
  async syncWithServer(): Promise<{
    bookingsSynced: number
    paymentsSynced: number
    conflicts: number
    errors: string[]
  }> {
    const results = {
      bookingsSynced: 0,
      paymentsSynced: 0,
      conflicts: 0,
      errors: [] as string[]
    }

    try {
      // Sync bookings first
      const unsyncedBookings = this.getUnsyncedBookings()
      
      for (const booking of unsyncedBookings) {
        try {
          const response = await fetch('/api/bookings/offline-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              offline_booking: booking,
              client_timestamp: new Date().toISOString()
            })
          })

          if (response.ok) {
            const result = await response.json()
            if (result.success) {
              this.markBookingAsSynced(booking.id, result.server_booking_id)
              results.bookingsSynced++
            } else if (result.conflict) {
              results.conflicts++
              console.warn('⚠️ Booking sync conflict:', booking.id, result.conflict)
            } else {
              results.errors.push(`Booking ${booking.id}: ${result.error}`)
            }
          } else {
            results.errors.push(`Booking ${booking.id}: Server error`)
          }
        } catch (error) {
          results.errors.push(`Booking ${booking.id}: ${error}`)
        }
      }

      // Then sync payments
      const unsyncedPayments = this.getUnsyncedPayments()
      
      for (const payment of unsyncedPayments) {
        try {
          const response = await fetch('/api/payments/offline-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              offline_payment: payment,
              client_timestamp: new Date().toISOString()
            })
          })

          if (response.ok) {
            const result = await response.json()
            if (result.success) {
              this.markPaymentAsSynced(payment.id, result.server_payment_id)
              results.paymentsSynced++
            } else if (result.conflict) {
              results.conflicts++
              console.warn('⚠️ Payment sync conflict:', payment.id, result.conflict)
            } else {
              results.errors.push(`Payment ${payment.id}: ${result.error}`)
            }
          } else {
            results.errors.push(`Payment ${payment.id}: Server error`)
          }
        } catch (error) {
          results.errors.push(`Payment ${payment.id}: ${error}`)
        }
      }

    } catch (error) {
      results.errors.push(`Sync process failed: ${error}`)
    }

    console.log('🔄 Sync results:', results)
    return results
  }

  // Conflict resolution
  resolveBookingConflict(offlineId: string, resolution: 'keep_offline' | 'use_server'): void {
    const bookings = this.getFromStorage<OfflineBooking>(this.BOOKINGS_KEY)
    const bookingIndex = bookings.findIndex(b => b.id === offlineId)
    
    if (bookingIndex !== -1) {
      if (resolution === 'use_server' && bookings[bookingIndex].server_booking_id) {
        // Remove offline version, keep server version
        bookings.splice(bookingIndex, 1)
        this.setToStorage(this.BOOKINGS_KEY, bookings)
        console.log('✅ Booking conflict resolved - using server version:', offlineId)
      } else {
        // Mark as resolved but keep offline version
        bookings[bookingIndex].conflict_resolved = true
        this.setToStorage(this.BOOKINGS_KEY, bookings)
        console.log('✅ Booking conflict resolved - keeping offline version:', offlineId)
      }
    }
  }

  resolvePaymentConflict(offlineId: string, resolution: 'keep_offline' | 'use_server'): void {
    const payments = this.getFromStorage<OfflinePayment>(this.PAYMENTS_KEY)
    const paymentIndex = payments.findIndex(p => p.id === offlineId)
    
    if (paymentIndex !== -1) {
      if (resolution === 'use_server' && payments[paymentIndex].server_payment_id) {
        // Remove offline version, keep server version
        payments.splice(paymentIndex, 1)
        this.setToStorage(this.PAYMENTS_KEY, payments)
        console.log('✅ Payment conflict resolved - using server version:', offlineId)
      } else {
        // Mark as resolved but keep offline version
        payments[paymentIndex].conflict_resolved = true
        this.setToStorage(this.PAYMENTS_KEY, payments)
        console.log('✅ Payment conflict resolved - keeping offline version:', offlineId)
      }
    }
  }

  // Cleanup operations
  clearSyncedData(olderThanDays: number = 7): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    // Clean old synced bookings
    const bookings = this.getFromStorage<OfflineBooking>(this.BOOKINGS_KEY)
    const filteredBookings = bookings.filter(booking => 
      !booking.synced || new Date(booking.created_at) > cutoffDate
    )
    this.setToStorage(this.BOOKINGS_KEY, filteredBookings)

    // Clean old synced payments
    const payments = this.getFromStorage<OfflinePayment>(this.PAYMENTS_KEY)
    const filteredPayments = payments.filter(payment => 
      !payment.synced || new Date(payment.created_at) > cutoffDate
    )
    this.setToStorage(this.PAYMENTS_KEY, filteredPayments)

    console.log(`🧹 Cleaned up synced data older than ${olderThanDays} days`)
  }

  // Status reporting
  getOfflineStatus(): {
    totalBookings: number
    unsyncedBookings: number
    totalPayments: number
    unsyncedPayments: number
    lastSync: string | null
  } {
    const bookings = this.getOfflineBookings()
    const payments = this.getOfflinePayments()
    const lastSyncData = localStorage.getItem(this.SYNC_QUEUE_KEY)

    return {
      totalBookings: bookings.length,
      unsyncedBookings: bookings.filter(b => !b.synced).length,
      totalPayments: payments.length,
      unsyncedPayments: payments.filter(p => !p.synced).length,
      lastSync: lastSyncData ? JSON.parse(lastSyncData).lastSync : null
    }
  }

  updateLastSync(): void {
    localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify({
      lastSync: new Date().toISOString()
    }))
  }
}

// Export singleton instance
export const offlineBookingManager = new OfflineBookingManager()

// Export types for use in components
export type { OfflineBooking, OfflinePayment }
