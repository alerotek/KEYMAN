import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AuditLog } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServer()
    
    const { data: auditLogs, error } = await supabase
      .from('audit_log')
      .select(`
        *,
        performed_by:profiles(full_name, role)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      if (error.code === 'PGRST200') {
        throw new Error('Invalid Supabase relationship used in query')
      }
      console.error('Audit log fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: auditLogs as AuditLog[],
      count: auditLogs?.length || 0
    })
  } catch (error) {
    console.error('Audit log route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer()
    const body = await request.json()
    
    const { action, entity, entity_id, performed_by } = body

    // Validate required fields
    if (!action || !entity || !entity_id || !performed_by) {
      return NextResponse.json(
        { error: 'Missing required fields: action, entity, entity_id, performed_by' },
        { status: 400 }
      )
    }

    // Validate action type
    const validActions = ['CREATE', 'UPDATE', 'DELETE']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: CREATE, UPDATE, DELETE' },
        { status: 400 }
      )
    }

    const { data: auditLog, error } = await supabase
      .from('audit_log')
      .insert({
        action,
        entity,
        entity_id,
        performed_by
      })
      .select()
      .single()

    if (error) {
      console.error('Audit log insert error:', error)
      return NextResponse.json(
        { error: 'Failed to create audit log entry' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: auditLog as AuditLog,
      message: 'Audit log entry created successfully'
    })
  } catch (error) {
    console.error('Audit log POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
