// Performance Monitoring Middleware
// Tracks API response times, bundle sizes, and slow queries

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

interface PerformanceMetric {
  route: string
  method: string
  response_time_ms: number
  status_code: number
  query_count: number
  bundle_size_kb?: number
}

class PerformanceTracker {
  private static instance: PerformanceTracker
  private metrics: PerformanceMetric[] = []
  private readonly MAX_METRICS = 1000 // Keep last 1000 metrics in memory

  static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker()
    }
    return PerformanceTracker.instance
  }

  addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)
    
    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS)
    }

    // Log slow requests (>500ms)
    if (metric.response_time_ms > 500) {
      this.logSlowRequest(metric)
    }

    // Log to database asynchronously (non-blocking)
    recordPerformanceMetric(metric).catch(console.error)
  }

  private async logSlowRequest(metric: PerformanceMetric): Promise<void> {
    try {
      const supabase = supabaseServer()
      await supabase
        .from('performance_metrics')
        .insert([{
          route: metric.route,
          method: metric.method,
          response_time_ms: metric.response_time_ms,
          status_code: metric.status_code,
          query_count: metric.query_count,
          created_at: new Date().toISOString()
        }])
    } catch (error) {
      console.error('Failed to log slow request:', error)
    }
  }

  private async logToDatabase(metric: PerformanceMetric): Promise<void> {
    // Only log every 10th request to avoid database overload
    if (Math.random() > 0.1) return

    try {
      const supabase = supabaseServer()
      await supabase.rpc('log_api_performance', {
        p_route: metric.route,
        p_method: metric.method,
        p_response_time_ms: metric.response_time_ms,
        p_status_code: metric.status_code,
        p_query_count: metric.query_count
      })
    } catch (error) {
      // Silently fail to avoid affecting main request
      console.error('Performance logging failed:', error)
    }
  }

  getAverageResponseTime(): number {
    if (this.metrics.length === 0) return 0
    const sum = this.metrics.reduce((acc, m) => acc + m.response_time_ms, 0)
    return sum / this.metrics.length
  }

  getSlowRequestCount(): number {
    return this.metrics.filter(m => m.response_time_ms > 500).length
  }

  getErrorRate(): number {
    if (this.metrics.length === 0) return 0
    const errors = this.metrics.filter(m => m.status_code >= 400).length
    return (errors / this.metrics.length) * 100
  }
}

// Performance monitoring middleware
export function withPerformanceMonitoring(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    const method = req.method
    const route = req.nextUrl.pathname

    // Track query count (simplified)
    let queryCount = 0
    const originalFetch = global.fetch
    global.fetch = (...args: any[]) => {
      queryCount++
      return originalFetch(...(args as [any, ...any[]]))
    }

    try {
      // Execute the original handler
      const response = await handler(req)

      // Calculate response time
      const responseTime = Date.now() - startTime

      // Get bundle size for pages (approximate)
      let bundleSize: number | undefined
      if (response.headers.get('content-type')?.includes('text/html')) {
        const contentLength = response.headers.get('content-length')
        if (contentLength) {
          bundleSize = Math.ceil(parseInt(contentLength) / 1024) // Convert to KB
        }
      }

      // Add performance metric
      const tracker = PerformanceTracker.getInstance()
      tracker.addMetric({
        route,
        method,
        response_time_ms: responseTime,
        status_code: response.status,
        query_count: queryCount,
        bundle_size_kb: bundleSize
      })

      // Add performance headers (for debugging)
      response.headers.set('X-Response-Time', `${responseTime}ms`)
      response.headers.set('X-Query-Count', queryCount.toString())
      response.headers.set('X-Performance-Grade', getPerformanceGrade(responseTime))

      return response

    } finally {
      // Restore original fetch
      global.fetch = originalFetch
    }
  }

  function getPerformanceGrade(responseTime: number): string {
    if (responseTime <= 100) return 'A'
    if (responseTime <= 200) return 'B'
    if (responseTime <= 500) return 'C'
    if (responseTime <= 1000) return 'D'
    return 'F'
  }
}

// Bundle size analyzer for client-side
export class BundleAnalyzer {
  private static measurements: Array<{
    page: string
    bundleSize: number
    loadTime: number
    timestamp: number
  }> = []

  static recordMeasurement(page: string, bundleSize: number, loadTime: number): void {
    this.measurements.push({
      page,
      bundleSize,
      loadTime,
      timestamp: Date.now()
    })

    // Keep only last 50 measurements
    if (this.measurements.length > 50) {
      this.measurements = this.measurements.slice(-50)
    }

    // Log to database if bundle is large (>200KB)
    if (bundleSize > 200) {
      this.logLargeBundle(page, bundleSize, loadTime)
    }
  }

  private static async logLargeBundle(page: string, bundleSize: number, loadTime: number): Promise<void> {
    try {
      const response = await fetch('/api/admin/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: page,
          method: 'GET',
          response_time_ms: loadTime,
          status_code: 200,
          bundle_size_kb: bundleSize
        })
      })
      
      if (!response.ok) {
        console.error('Failed to log large bundle:', await response.text())
      }
    } catch (error) {
      console.error('Bundle logging error:', error)
    }
  }

  static getAverageBundleSize(): number {
    if (this.measurements.length === 0) return 0
    const sum = this.measurements.reduce((acc, m) => acc + m.bundleSize, 0)
    return sum / this.measurements.length
  }

  static getHeaviestPages(limit: number = 5): Array<{page: string, bundleSize: number}> {
    return this.measurements
      .sort((a, b) => b.bundleSize - a.bundleSize)
      .slice(0, limit)
      .map(m => ({ page: m.page, bundleSize: m.bundleSize }))
  }
}

// Slow query detector
export class SlowQueryDetector {
  private static queryTimes: Map<string, number[]> = new Map()

  static recordQuery(query: string, executionTime: number): void {
    const signature = this.getQuerySignature(query)
    
    if (!this.queryTimes.has(signature)) {
      this.queryTimes.set(signature, [])
    }
    
    const times = this.queryTimes.get(signature)!
    times.push(executionTime)
    
    // Keep only last 10 executions
    if (times.length > 10) {
      times.shift()
    }

    // Log slow queries (>100ms average)
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
    if (avgTime > 100) {
      this.logSlowQuery(signature, avgTime, times.length)
    }
  }

  private static getQuerySignature(query: string): string {
    // Simple query signature (remove specific values)
    return query
      .replace(/\$\d+/g, '$N') // Replace parameter placeholders
      .replace(/\b\d+\b/g, 'N') // Replace numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 100) // Limit length
  }

  private static async logSlowQuery(signature: string, avgTime: number, calls: number): Promise<void> {
    try {
      const response = await fetch('/api/admin/performance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_text: signature,
          execution_time_ms: Math.round(avgTime),
          calls,
          route: 'database'
        })
      })
      
      if (!response.ok) {
        console.error('Failed to log slow query:', await response.text())
      }
    } catch (error) {
      console.error('Slow query logging error:', error)
    }
  }
}

// Performance monitoring hook for React components
export function usePerformanceMonitoring(pageName: string) {
  if (typeof window === 'undefined') return

  const startTime = Date.now()
  
  // Monitor bundle load
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const loadTime = Date.now() - startTime
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      if (navigation) {
        const bundleSize = Math.round(
          (navigation.transferSize || navigation.encodedBodySize || 0) / 1024
        )
        
        BundleAnalyzer.recordMeasurement(pageName, bundleSize, loadTime)
      }
    })
  }
}
