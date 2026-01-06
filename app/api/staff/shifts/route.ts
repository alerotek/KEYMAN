import { createServerClient as createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

// Get current active shifts
export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServer()
    const { searchParams } = new URL(request.url)
    const summary = searchParams.get('summary') === 'true'

    if (summary) {
      // Get daily shift summary with workload
      const { data, error } = await supabase
        .rpc('get_daily_shift_summary')

      if (error) throw error
      return NextResponse.json({ shifts: data })
    } else {
      // Get current active shifts
      const { data, error } = await supabase
        .rpc('get_active_shifts')

      if (error) throw error
      return NextResponse.json({ active_shifts: data })
    }

  } catch (error) {
    console.error('Error fetching shifts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 }
    )
  }
}

// Create new shift (admin/manager only)
export async function POST(request: Request) {
  try {
    // Require manager or admin role
    const authResult = await requireRole('manager')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const body = await request.json()
    const { staff_id, start_time, end_time, role, notes } = body

    if (!staff_id || !start_time || !end_time || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Create shift
    const { data, error } = await supabase
      .from('staff_shifts')
      .insert([{
        staff_id,
        start_time,
        end_time,
        role,
        notes,
        created_by: user.id
      }])
      .select()
      .single()

    if (error) throw error

    // Log shift creation
    await supabase
      .from('audit_log')
      .insert([{
        action: 'shift_created',
        details: {
          shift_id: data.id,
          staff_id,
          start_time,
          end_time,
          role,
          created_by: user.email
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      shift: data,
      message: 'Shift created successfully'
    })

  } catch (error) {
    console.error('Error creating shift:', error)
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    )
  }
}

// Update shift (admin/manager only)
export async function PUT(request: Request) {
  try {
    // Require manager or admin role
    const authResult = await requireRole('manager')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const body = await request.json()
    const { id, end_time, active, notes } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Missing shift ID' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Update shift
    const { data, error } = await supabase
      .from('staff_shifts')
      .update({
        end_time,
        active,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Log shift update
    await supabase
      .from('audit_log')
      .insert([{
        action: 'shift_updated',
        details: {
          shift_id: id,
          end_time,
          active,
          notes,
          updated_by: user.email
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      shift: data,
      message: 'Shift updated successfully'
    })

  } catch (error) {
    console.error('Error updating shift:', error)
    return NextResponse.json(
      { error: 'Failed to update shift' },
      { status: 500 }
    )
  }
}

// Delete shift (admin only)
export async function DELETE(request: Request) {
  try {
    // Require admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing shift ID' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Delete shift
    const { error } = await supabase
      .from('staff_shifts')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Log shift deletion
    await supabase
      .from('audit_log')
      .insert([{
        action: 'shift_deleted',
        details: {
          shift_id: id,
          deleted_by: user.email
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      message: 'Shift deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting shift:', error)
    return NextResponse.json(
      { error: 'Failed to delete shift' },
      { status: 500 }
    )
  }
}
