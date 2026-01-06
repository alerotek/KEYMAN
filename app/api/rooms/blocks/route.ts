import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { RoomInventoryManager } from '@/lib/inventory/roomInventoryManager'

export const dynamic = 'force-dynamic'

// Get room blocks
export async function GET(request: Request) {
  try {
    const inventoryManager = new RoomInventoryManager()
    const { searchParams } = new URL(request.url)
    const roomTypeId = searchParams.get('room_type_id')

    const blocks = await inventoryManager.getRoomBlocks(roomTypeId || undefined)
    return NextResponse.json({ room_blocks: blocks })

  } catch (error) {
    console.error('Error fetching room blocks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch room blocks' },
      { status: 500 }
    )
  }
}

// Block rooms (admin/manager only)
export async function POST(request: Request) {
  try {
    // Require admin or manager role
    const authResult = await requireRole('manager')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const inventoryManager = new RoomInventoryManager()
    const body = await request.json()
    const { 
      room_type_id, 
      start_date, 
      end_date, 
      reason, 
      description, 
      blocked_rooms 
    } = body

    if (!room_type_id || !start_date || !end_date || !reason || !blocked_rooms) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate reason
    const validReasons = ['maintenance', 'admin_hold', 'renovation', 'emergency']
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid reason. Must be one of: ' + validReasons.join(', ') },
        { status: 400 }
      )
    }

    // Block rooms
    const result = await inventoryManager.blockRooms(
      room_type_id,
      start_date,
      end_date,
      reason,
      description || '',
      blocked_rooms,
      user.email || 'unknown'
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Rooms blocked successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error blocking rooms:', error)
    return NextResponse.json(
      { error: 'Failed to block rooms' },
      { status: 500 }
    )
  }
}

// Update room block (admin/manager only)
export async function PUT(request: Request) {
  try {
    // Require admin or manager role
    const authResult = await requireRole('manager')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const body = await request.json()
    const { id, end_date, description, blocked_rooms } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Missing block ID' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Update room block
    const { data, error } = await supabase
      .from('room_blocks')
      .update({
        end_date,
        description,
        blocked_rooms,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Log the update
    await supabase
      .from('audit_log')
      .insert([{
        action: 'room_block_updated',
        details: {
          block_id: id,
          end_date,
          description,
          blocked_rooms,
          updated_by: user.email
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      data,
      message: 'Room block updated successfully'
    })

  } catch (error) {
    console.error('Error updating room block:', error)
    return NextResponse.json(
      { error: 'Failed to update room block' },
      { status: 500 }
    )
  }
}

// Remove room block (admin/manager only)
export async function DELETE(request: Request) {
  try {
    // Require admin or manager role
    const authResult = await requireRole('manager')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing block ID' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    // Delete room block
    const { error } = await supabase
      .from('room_blocks')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Log the deletion
    await supabase
      .from('audit_log')
      .insert([{
        action: 'room_block_deleted',
        details: {
          block_id: id,
          deleted_by: user.email
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      message: 'Room block removed successfully'
    })

  } catch (error) {
    console.error('Error removing room block:', error)
    return NextResponse.json(
      { error: 'Failed to remove room block' },
      { status: 500 }
    )
  }
}
