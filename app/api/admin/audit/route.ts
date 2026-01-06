import { createServerClient as createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

// Get audit logs (admin only)
export async function GET(request: Request) {
  try {
    // Require admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = createSupabaseServer()
    const { searchParams } = new URL(request.url)
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Filter parameters
    const action = searchParams.get('action')
    const entity = searchParams.get('entity')
    const actorId = searchParams.get('actor_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Build query
    let query = supabase
      .from('audit_log')
      .select(`
        id,
        action,
        entity,
        entity_id,
        actor_id,
        actor_role,
        before_state,
        after_state,
        session_id,
        details,
        created_at
      `, { count: 'exact' })

    // Apply filters
    if (action) {
      query = query.eq('action', action)
    }
    if (entity) {
      query = query.eq('entity', entity)
    }
    if (actorId) {
      query = query.eq('actor_id', actorId)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Apply pagination and ordering
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Get performance stats
    const { data: stats, error: statsError } = await supabase
      .rpc('get_audit_performance_stats')

    if (statsError) throw statsError

    return NextResponse.json({
      audit_logs: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      },
      performance_stats: stats?.[0] || null
    })

  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

// Get audit log details (admin only)
export async function POST(request: Request) {
  try {
    // Require admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { audit_log_id } = body

    if (!audit_log_id) {
      return NextResponse.json(
        { error: 'Missing audit log ID' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Get detailed audit log
    const { data, error } = await supabase
      .from('audit_log')
      .select(`
        *,
        staff:actor_id(full_name, email, role)
      `)
      .eq('id', audit_log_id)
      .single()

    if (error) throw error

    if (!data) {
      return NextResponse.json(
        { error: 'Audit log not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      audit_log: data
    })

  } catch (error) {
    console.error('Error fetching audit log details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit log details' },
      { status: 500 }
    )
  }
}

// Export audit logs (admin only)
export async function PUT(request: Request) {
  try {
    // Require admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { format = 'json', filters = {} } = body

    const supabase = createSupabaseServer()

    // Build query with filters
    let query = supabase
      .from('audit_log')
      .select(`
        id,
        action,
        entity,
        entity_id,
        actor_id,
        actor_role,
        before_state,
        after_state,
        session_id,
        details,
        created_at
      `)

    // Apply filters
    if (filters.action) {
      query = query.eq('action', filters.action)
    }
    if (filters.entity) {
      query = query.eq('entity', filters.entity)
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    // Get data (limited to prevent memory issues)
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(10000) // Limit export size

    if (error) throw error

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'ID', 'Action', 'Entity', 'Entity ID', 'Actor ID', 'Actor Role',
        'Before State', 'After State', 'Session ID', 'Details', 'Created At'
      ]
      
      const csvRows = data.map((log: any) => [
        log.id,
        log.action,
        log.entity,
        log.entity_id,
        log.actor_id,
        log.actor_role,
        JSON.stringify(log.before_state),
        JSON.stringify(log.after_state),
        log.session_id,
        JSON.stringify(log.details),
        log.created_at
      ])
      
      const csvContent = [
        headers.join(','),
        ...csvRows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(','))
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    } else {
      // Return JSON
      return NextResponse.json({
        audit_logs: data,
        exported_at: new Date().toISOString(),
        total_records: data.length
      })
    }

  } catch (error) {
    console.error('Error exporting audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    )
  }
}
