import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

// Get performance metrics (admin only)
export async function GET(request: Request) {
  try {
    // Require admin role for detailed metrics
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = createSupabaseServer()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'summary'

    switch (type) {
      case 'summary':
        // Get performance summary
        const { data: summary, error: summaryError } = await supabase
          .rpc('get_performance_summary')

        if (summaryError) throw summaryError
        return NextResponse.json({ summary })

      case 'slow-queries':
        // Get slowest queries
        const limit = parseInt(searchParams.get('limit') || '5')
        const { data: slowQueries, error: slowError } = await supabase
          .rpc('get_slowest_queries', { limit_count: limit })

        if (slowError) throw slowError
        return NextResponse.json({ slow_queries: slowQueries })

      case 'heavy-components':
        // Get heaviest components
        const componentLimit = parseInt(searchParams.get('limit') || '5')
        const { data: heavyComponents, error: componentError } = await supabase
          .rpc('get_heaviest_components', { limit_count: componentLimit })

        if (componentError) throw componentError
        return NextResponse.json({ heavy_components: heavyComponents })

      case 'dashboard':
        // Get performance dashboard data
        const { data: dashboard, error: dashboardError } = await supabase
          .from('performance_dashboard')
          .select('*')

        if (dashboardError) throw dashboardError
        return NextResponse.json({ dashboard })

      case 'query-analysis':
        // Get query performance analysis
        const { data: queryAnalysis, error: analysisError } = await supabase
          .rpc('analyze_query_performance')

        if (analysisError) throw analysisError
        return NextResponse.json({ query_analysis: queryAnalysis })

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error fetching performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    )
  }
}

// Log performance metrics (internal use)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { route, method, response_time_ms, status_code, query_count, bundle_size_kb } = body

    if (!route || !method || response_time_ms === undefined || !status_code) {
      return NextResponse.json(
        { error: 'Missing required performance metrics' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Log performance metrics
    const { error } = await supabase.rpc('log_api_performance', {
      p_route: route,
      p_method: method,
      p_response_time_ms: response_time_ms,
      p_status_code: status_code,
      p_query_count: query_count || 0
    })

    if (error) throw error

    // Also log bundle metrics if provided
    if (bundle_size_kb) {
      await supabase
        .from('bundle_metrics')
        .insert([{
          page: route,
          bundle_size_kb,
          js_size_kb: bundle_size_kb * 0.7, // Estimate
          css_size_kb: bundle_size_kb * 0.2, // Estimate
          load_time_ms: response_time_ms,
          created_at: new Date().toISOString()
        }])
    }

    return NextResponse.json({
      success: true,
      message: 'Performance metrics logged'
    })

  } catch (error) {
    console.error('Error logging performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to log performance metrics' },
      { status: 500 }
    )
  }
}

// Log slow query (internal use)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { query_text, execution_time_ms, route, calls = 1 } = body

    if (!query_text || execution_time_ms === undefined) {
      return NextResponse.json(
        { error: 'Missing required query information' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Check if query already exists
    const { data: existingQuery } = await supabase
      .from('slow_queries')
      .select('*')
      .eq('query_text', query_text)
      .single()

    if (existingQuery) {
      // Update existing query
      const { error } = await supabase
        .from('slow_queries')
        .update({
          calls: existingQuery.calls + calls,
          avg_time_ms: ((existingQuery.avg_time_ms * existingQuery.calls) + execution_time_ms) / (existingQuery.calls + calls),
          execution_time_ms: Math.max(existingQuery.execution_time_ms, execution_time_ms),
          created_at: new Date().toISOString()
        })
        .eq('id', existingQuery.id)

      if (error) throw error
    } else {
      // Insert new slow query
      const { error } = await supabase
        .from('slow_queries')
        .insert([{
          query_text,
          execution_time_ms,
          calls,
          avg_time_ms: execution_time_ms,
          route,
          created_at: new Date().toISOString()
        }])

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Slow query logged'
    })

  } catch (error) {
    console.error('Error logging slow query:', error)
    return NextResponse.json(
      { error: 'Failed to log slow query' },
      { status: 500 }
    )
  }
}

// Clean up old performance data (admin only)
export async function DELETE(request: Request) {
  try {
    // Require admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = createSupabaseServer()

    // Run cleanup
    const { error } = await supabase.rpc('cleanup_performance_data')

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Performance data cleanup completed'
    })

  } catch (error) {
    console.error('Error cleaning up performance data:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup performance data' },
      { status: 500 }
    )
  }
}
