import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(req, ['ADMIN', 'MANAGER', 'STAFF'])
    const supabase = supabaseServer()
    const body = await req.json()
    const taskId = params.id

    const { status } = body

    if (!status || !['Pending', 'In Progress', 'Done'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: Pending, In Progress, or Done' },
        { status: 400 }
      )
    }

    // Get current task for audit
    const { data: currentTask } = await supabase
      .from('staff_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (!currentTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (user.role === 'STAFF' && currentTask.assigned_to !== user.id) {
      return NextResponse.json(
        { error: 'You can only update your own tasks' },
        { status: 403 }
      )
    }

    // Update task
    const updateData: any = { status, updated_at: new Date().toISOString() }
    if (status === 'Done') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data: task, error: updateError } = await supabase
      .from('staff_tasks')
      .update(updateData)
      .eq('id', taskId)
      .select(`
        *,
        profiles!staff_tasks_assigned_to_fkey (
          full_name,
          email
        )
      `)
      .single()

    if (updateError) throw updateError

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_entity_type: 'task',
      p_entity_id: taskId,
      p_action: 'updated',
      p_user_id: user.id,
      p_old_values: { status: currentTask.status },
      p_new_values: { status },
      p_metadata: { completed_at: updateData.completed_at }
    })

    return NextResponse.json({
      task,
      message: 'Task updated successfully'
    })

  } catch (err: any) {
    console.error('Task update error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500 }
    )
  }
}
