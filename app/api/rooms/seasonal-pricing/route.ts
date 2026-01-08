import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { RoomInventoryManager } from '@/lib/inventory/roomInventoryManager'

export const dynamic = 'force-dynamic'

// Get seasonal pricing
export async function GET(request: Request) {
  try {
    const inventoryManager = new RoomInventoryManager()
    const { searchParams } = new URL(request.url)
    const roomTypeId = searchParams.get('room_type_id')

    if (roomTypeId) {
      // Get pricing for specific room type
      const pricing = await inventoryManager.getSeasonalPricing(roomTypeId)
      return NextResponse.json({ seasonal_pricing: pricing })
    } else {
      // Get all seasonal pricing
      const pricing = await inventoryManager.getDashboardData('admin')
      return NextResponse.json({ seasonal_pricing: pricing.seasonal_pricing })
    }

  } catch (error) {
    console.error('Error fetching seasonal pricing:', error)
    return NextResponse.json(
      { error: 'Failed to fetch seasonal pricing' },
      { status: 500 }
    )
  }
}

// Add seasonal pricing (admin/manager only)
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
    const { room_type_id, start_date, end_date, price_override, reason } = body

    if (!room_type_id || !start_date || !end_date || !price_override) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Add seasonal pricing
    const result = await inventoryManager.addSeasonalPricing(
      room_type_id,
      start_date,
      end_date,
      price_override,
      reason || 'Seasonal adjustment',
      user.email || 'unknown'
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Seasonal pricing added successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error adding seasonal pricing:', error)
    return NextResponse.json(
      { error: 'Failed to add seasonal pricing' },
      { status: 500 }
    )
  }
}

// Update seasonal pricing (admin/manager only)
export async function PUT(request: Request) {
  try {
    // Require admin or manager role
    const authResult = await requireRole('manager')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const body = await request.json()
    const { id, price_override, reason, active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Missing pricing ID' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    // Update seasonal pricing
    const { data, error } = await supabase
      .from('seasonal_pricing')
      .update({
        price_override,
        reason,
        active,
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
        action: 'seasonal_pricing_updated',
        details: {
          pricing_id: id,
          price_override,
          reason,
          active,
          updated_by: user.email
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      data,
      message: 'Seasonal pricing updated successfully'
    })

  } catch (error) {
    console.error('Error updating seasonal pricing:', error)
    return NextResponse.json(
      { error: 'Failed to update seasonal pricing' },
      { status: 500 }
    )
  }
}

// Delete seasonal pricing (admin only)
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
        { error: 'Missing pricing ID' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    // Soft delete by setting active to false
    const { error } = await supabase
      .from('seasonal_pricing')
      .update({
        active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error

    // Log the deletion
    await supabase
      .from('audit_log')
      .insert([{
        action: 'seasonal_pricing_deleted',
        details: {
          pricing_id: id,
          deleted_by: user.email
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      message: 'Seasonal pricing deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting seasonal pricing:', error)
    return NextResponse.json(
      { error: 'Failed to delete seasonal pricing' },
      { status: 500 }
    )
  }
}
