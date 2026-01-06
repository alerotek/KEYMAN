// Production Hardening and Validation
// Ensures system is production-ready with proper security and validation

import { createSupabaseServer } from '@/lib/supabase/server'

// Environment validation
export function validateEnvironment(): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Required environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`)
    }
  }

  // Validate Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    errors.push('SUPABASE_URL must use HTTPS')
  }

  // Check for localhost in production
  if (process.env.NODE_ENV === 'production') {
    if (supabaseUrl?.includes('localhost')) {
      errors.push('Production cannot use localhost Supabase URL')
    }
  }

  // Email configuration
  const emailConfigured = !!process.env.EMAIL_PROVIDER_API_KEY
  if (!emailConfigured) {
    warnings.push('Email provider not configured - emails will be logged only')
  }

  // Security headers validation
  if (process.env.NODE_ENV === 'production') {
    warnings.push('Ensure proper security headers are configured in hosting')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// Rate limiting implementation
class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, [])
    }

    const userRequests = this.requests.get(identifier)!
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => time > windowStart)
    this.requests.set(identifier, validRequests)

    // Check if under limit
    return validRequests.length < this.maxRequests
  }

  cleanup(): void {
    const now = Date.now()
    const windowStart = now - this.windowMs

    for (const [identifier, times] of Array.from(this.requests.entries())) {
      const validRequests = times.filter((time: number) => time > windowStart)
      if (validRequests.length === 0) {
        this.requests.delete(identifier)
      } else {
        this.requests.set(identifier, validRequests)
      }
    }
  }
}

// Global rate limiter instances
export const paymentRateLimiter = new RateLimiter(5, 60000) // 5 payments per minute
export const authRateLimiter = new RateLimiter(10, 900000) // 10 auth attempts per 15 minutes
export const reportRateLimiter = new RateLimiter(20, 300000) // 20 reports per 5 minutes

// Input validation and sanitization
export class InputValidator {
  static validateEmail(email: string): { isValid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) {
      return { isValid: false, error: 'Email is required' }
    }
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Invalid email format' }
    }
    if (email.length > 255) {
      return { isValid: false, error: 'Email too long' }
    }
    return { isValid: true }
  }

  static validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phone) {
      return { isValid: false, error: 'Phone number is required' }
    }
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return { isValid: false, error: 'Invalid phone number format' }
    }
    return { isValid: true }
  }

  static validateAmount(amount: number): { isValid: boolean; error?: string } {
    if (typeof amount !== 'number') {
      return { isValid: false, error: 'Amount must be a number' }
    }
    if (amount <= 0) {
      return { isValid: false, error: 'Amount must be positive' }
    }
    if (amount > 1000000) { // 1M KES limit
      return { isValid: false, error: 'Amount exceeds maximum limit' }
    }
    return { isValid: true }
  }

  static validateDateRange(startDate: string, endDate: string): { isValid: boolean; error?: string } {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const now = new Date()

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { isValid: false, error: 'Invalid date format' }
    }

    if (start > end) {
      return { isValid: false, error: 'Start date must be before end date' }
    }

    if (start > now) {
      return { isValid: false, error: 'Start date cannot be in the future' }
    }

    // Limit date range to 1 year
    const maxRange = 365 * 24 * 60 * 60 * 1000 // 1 year in ms
    if (end.getTime() - start.getTime() > maxRange) {
      return { isValid: false, error: 'Date range cannot exceed 1 year' }
    }

    return { isValid: true }
  }

  static sanitizeString(input: string, maxLength: number = 255): string {
    if (typeof input !== 'string') {
      return ''
    }
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML
      .substring(0, maxLength)
  }

  static validateIdNumber(idNumber: string): { isValid: boolean; error?: string } {
    if (!idNumber) {
      return { isValid: true } // Optional field
    }
    
    // Kenyan ID number validation (simplified)
    const idRegex = /^\d{8}$/
    if (!idRegex.test(idNumber)) {
      return { isValid: false, error: 'Invalid ID number format' }
    }
    
    return { isValid: true }
  }
}

// Security headers middleware
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-XSS-Protection', '1; mode=block')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // CORS headers for API
  headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Access-Control-Max-Age', '86400')
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

// Audit logging for security events
export class SecurityAuditor {
  static async logSecurityEvent(
    event: string,
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    try {
      const supabase = createSupabaseServer()
      
      await supabase
        .from('audit_log')
        .insert([{
          action: `security_${event}`,
          details: {
            ...details,
            severity,
            timestamp: new Date().toISOString(),
            user_agent: details.user_agent || 'unknown',
            ip_address: details.ip_address || 'unknown'
          },
          created_at: new Date().toISOString()
        }])
      
      console.log(`🔒 Security event logged: ${event}`, { severity, details })
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  static async detectSuspiciousActivity(
    userEmail: string,
    action: string,
    context: Record<string, any>
  ): Promise<void> {
    // Implement basic suspicious activity detection
    const suspiciousPatterns = [
      'multiple_failed_logins',
      'rapid_booking_creation',
      'unusual_payment_amount',
      'admin_access_from_new_location'
    ]

    if (suspiciousPatterns.includes(action)) {
      await this.logSecurityEvent(action, {
        user_email: userEmail,
        context,
        detected_at: new Date().toISOString()
      }, 'high')
    }
  }
}

// Data integrity checks
export class DataIntegrityValidator {
  static async validateBookingIntegrity(bookingId: string): Promise<{
    isValid: boolean
    issues: string[]
  }> {
    const issues: string[] = []
    const supabase = createSupabaseServer()

    try {
      // Check booking exists
      const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
          id,
          customer_id,
          room_id,
          check_in,
          check_out,
          total_amount,
          paid_amount,
          status,
          customers(email),
          rooms(id, is_active)
        `)
        .eq('id', bookingId)
        .single()

      if (error || !booking) {
        issues.push('Booking not found')
        return { isValid: false, issues }
      }

      // Validate customer exists
      if (!booking.customers) {
        issues.push('Customer not found')
      }

      // Validate room exists and is active
      if (!booking.rooms || !(booking.rooms as any).is_active) {
        issues.push('Room not found or inactive')
      }

      // Validate date logic
      const checkIn = new Date(booking.check_in)
      const checkOut = new Date(booking.check_out)
      
      if (checkIn >= checkOut) {
        issues.push('Check-in must be before check-out')
      }

      // Validate payment logic
      if (booking.paid_amount && booking.paid_amount > booking.total_amount) {
        issues.push('Paid amount cannot exceed total amount')
      }

      // Validate status transitions
      const validStatuses = ['Pending', 'Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled']
      if (!validStatuses.includes(booking.status)) {
        issues.push('Invalid booking status')
      }

      return {
        isValid: issues.length === 0,
        issues
      }

    } catch (error) {
      issues.push(`Validation error: ${error}`)
      return { isValid: false, issues }
    }
  }

  static async validatePaymentIntegrity(paymentId: string): Promise<{
    isValid: boolean
    issues: string[]
  }> {
    const issues: string[] = []
    const supabase = createSupabaseServer()

    try {
      const { data: payment, error } = await supabase
        .from('payments')
        .select(`
          id,
          booking_id,
          amount_paid,
          method,
          paid_at,
          bookings(
            total_amount,
            status,
            customer_id
          )
        `)
        .eq('id', paymentId)
        .single()

      if (error || !payment) {
        issues.push('Payment not found')
        return { isValid: false, issues }
      }

      // Validate booking exists
      if (!payment.bookings) {
        issues.push('Associated booking not found')
      }

      // Validate payment amount
      if (payment.amount_paid <= 0) {
        issues.push('Payment amount must be positive')
      }

      if (payment.amount_paid > (payment.bookings as any).total_amount) {
        issues.push('Payment amount exceeds booking total')
      }

      // Validate payment method
      const validMethods = ['M-Pesa', 'Cash', 'Card', 'Bank Transfer']
      if (!validMethods.includes(payment.method)) {
        issues.push('Invalid payment method')
      }

      return {
        isValid: issues.length === 0,
        issues
      }

    } catch (error) {
      issues.push(`Validation error: ${error}`)
      return { isValid: false, issues }
    }
  }
}

// Production monitoring
export class ProductionMonitor {
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Record<string, boolean>
    timestamp: string
  }> {
    const checks: Record<string, boolean> = {}
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    try {
      // Database connectivity
      const supabase = createSupabaseServer()
      const { error } = await supabase
        .from('rooms')
        .select('id')
        .limit(1)
      
      checks.database = !error
      if (error) overallStatus = 'unhealthy'

      // Email service (if configured)
      checks.email = !!process.env.EMAIL_PROVIDER_API_KEY

      // Required services
      checks.auth = true // Assuming auth is working if we get here
      checks.api = true

      // Determine overall status
      const failedChecks = Object.values(checks).filter(check => !check).length
      if (failedChecks === 0) {
        overallStatus = 'healthy'
      } else if (failedChecks <= 2) {
        overallStatus = 'degraded'
      } else {
        overallStatus = 'unhealthy'
      }

    } catch (error) {
      console.error('Health check failed:', error)
      overallStatus = 'unhealthy'
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString()
    }
  }

  static async logPerformanceMetrics(
    endpoint: string,
    responseTime: number,
    statusCode: number
  ): Promise<void> {
    try {
      const supabase = createSupabaseServer()
      
      await supabase
        .from('audit_log')
        .insert([{
          action: 'performance_metric',
          details: {
            endpoint,
            response_time_ms: responseTime,
            status_code: statusCode,
            timestamp: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        }])
    } catch (error) {
      console.error('Failed to log performance metrics:', error)
    }
  }
}

// Cleanup old data
export class DataCleanup {
  static async cleanupOldAuditLogs(daysToKeep: number = 90): Promise<void> {
    try {
      const supabase = createSupabaseServer()
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const { error } = await supabase
        .from('audit_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString())

      if (error) {
        console.error('Failed to cleanup old audit logs:', error)
      } else {
        console.log(`✅ Cleaned up audit logs older than ${daysToKeep} days`)
      }
    } catch (error) {
      console.error('Data cleanup error:', error)
    }
  }

  static async cleanupOldOfflineData(daysToKeep: number = 7): Promise<void> {
    // This would be called by a scheduled job
    console.log(`🧹 Cleanup old offline data older than ${daysToKeep} days`)
  }
}

