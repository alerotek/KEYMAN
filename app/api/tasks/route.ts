import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = await requireRole('manager')
    if (auth instanceof Response) return auth
    
    const supabase = createSupabaseServer()
    const body = await req.json()

    const { 
      booking_id, 
      assigned_to, 
      task_type, 
      title, 
      description, 
      priority = 'medium',
      due_date 
    } = body

    if (!booking_id || !assigned_to || !task_type || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: booking_id, assigned_to, task_type, title' },
        { status: 400 }
      )
    }

    // Create task
    const { data: task, error: taskError } = await supabase
      .from('staff_tasks')
      .insert({
        booking_id,
        assigned_to,
        task_type,
        title,
        description,
        priority,
        due_date: due_date ? new Date(due_date).toISOString() : null
      })
      .select(`
        *,
        profiles!staff_tasks_assigned_to_fkey (
          full_name,
          email,
          role
        ),
        bookings!staff_tasks_booking_id_fkey (
          rooms!bookings_room_id_fkey (
            room_number
          )
        )
      `)
      .single()

    if (taskError) throw taskError

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_entity_type: 'task',
      p_entity_id: task.id,
      p_action: 'assigned',
      p_new_values: { 
        booking_id, 
        assigned_to, 
        task_type, 
        title, 
        priority 
      }
    })

    return NextResponse.json({
      task,
      message: 'Task assigned successfully'
    })

  } catch (err: any) {
    console.error('Task assignment error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireRole('staff')
    if (auth instanceof Response) return auth
    
    const supabase = createSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    const status = searchParams.get('status')
    const task_type = searchParams.get('task_type')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('staff_tasks')
      .select(`
        *,
        profiles!staff_tasks_assigned_to_fkey (
          full_name,
          email,
          role
        ),
        bookings!staff_tasks_booking_id_fkey (
          customers!bookings_customer_id_fkey (
            full_name,
            email
          ),
          rooms!bookings_room_id_fkey (
            room_number,
            room_type
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (task_type) {
      query = query.eq('task_type', task_type)
    }

    // Role-based filtering
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single()

    if (userProfile?.role === 'STAFF') {
      // Staff can only see their own tasks
      query = query.eq('assigned_to', auth.user.id)
    }
    // Admins and Managers can see all tasks (no additional filter needed)

    const { data: tasks, error } = await query

    if (error) throw error

    return NextResponse.json({ tasks })

  } catch (err: any) {
    console.error('Task fetch error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500 }
    )
  }
}
