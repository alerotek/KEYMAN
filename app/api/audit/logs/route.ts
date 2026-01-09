import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const auth = await requireRole('admin')
    if (auth instanceof Response) return auth
    
    const supabase = createSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    const entity_type = searchParams.get('entity_type')
    const entity_id = searchParams.get('entity_id')
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        profiles!audit_logs_user_id_fkey (
          full_name,
          email,
          role
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply filters
    if (entity_type) {
      query = query.eq('entity_type', entity_type)
    }
    if (entity_id) {
      query = query.eq('entity_id', entity_id)
    }
    if (action) {
      query = query.eq('action', action)
    }

    const { data: logs, error } = await query

    if (error) throw error

    return NextResponse.json({ logs })

  } catch (err: any) {
    console.error('Audit logs fetch error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole('manager')
    if (auth instanceof Response) return auth
    
    const supabase = createSupabaseServer()
    const body = await req.json()

    const { 
      entity_type, 
      entity_id, 
      action, 
      user_id, 
      old_values, 
      new_values, 
      metadata 
    } = body

    if (!entity_type || !entity_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_type, entity_id, action' },
        { status: 400 }
      )
    }

    // Get client IP from headers
    const headers = Object.fromEntries(req.headers.entries())
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Log audit event
    const { data: log, error } = await supabase.rpc('log_audit_event', {
      p_entity_type: entity_type,
      p_entity_id: entity_id,
      p_action: action,
      p_user_id: user_id,
      p_old_values: old_values,
      p_new_values: new_values,
      p_metadata: metadata,
      p_ip_address: clientIP,
      p_user_agent: userAgent
    })

    if (error) throw error

    return NextResponse.json({
      message: 'Audit event logged successfully',
      log_id: log
    })

  } catch (err: any) {
    console.error('Audit log creation error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500 }
    )
  }
}
