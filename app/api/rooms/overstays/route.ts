import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { RoomInventoryManager } from '@/lib/inventory/roomInventoryManager'

export const dynamic = 'force-dynamic'

// Detect and report overstays
export async function POST(request: Request) {
  try {
    // Require staff or higher role
    const authResult = await requireRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const inventoryManager = new RoomInventoryManager()
    // Run overstay detection
    const overstays = await inventoryManager.detectOverstays()

    return NextResponse.json({
      success: true,
      overstays_detected: overstays.overstays,
      details: overstays.details,
      message: `Detected ${overstays.overstays} overstays`
    })

  } catch (error) {
    console.error('Error detecting overstays:', error)
    return NextResponse.json(
      { error: 'Failed to detect overstays' },
      { status: 500 }
    )
  }
}

// Get current overstays
export async function GET(request: Request) {
  try {
    // Require staff or higher role
    const authResult = await requireRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const inventoryManager = new RoomInventoryManager()
    // Get current overstays
    const overstays = await inventoryManager.detectOverstays()

    return NextResponse.json({
      overstays: overstays.overstays,
      details: overstays.details
    })

  } catch (error) {
    console.error('Error fetching overstays:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overstays' },
      { status: 500 }
    )
  }
}

// Handle overstay (checkout or extend)
export async function PUT(request: Request) {
  try {
    // Require staff or higher role
    const authResult = await requireRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const body = await request.json()
    const { booking_id, action, new_checkout_date, late_fee } = body

    if (!booking_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    if (action === 'checkout') {
      // Mark as checked out
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'Checked-Out',
          actual_checkout_date: new Date().toISOString().split('T')[0],
          overstay_detected: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking_id)

      if (error) throw error

      // Log the checkout
      await supabase
        .from('audit_log')
        .insert([{
          action: 'overstay_checkout',
          details: {
            booking_id,
            checkout_date: new Date().toISOString().split('T')[0],
            processed_by: user.email
          },
          created_at: new Date().toISOString()
        }])

      return NextResponse.json({
        success: true,
        message: 'Overstay checked out successfully'
      })

    } else if (action === 'extend') {
      if (!new_checkout_date) {
        return NextResponse.json(
          { error: 'New checkout date required for extension' },
          { status: 400 }
        )
      }

      // Extend stay and add late fee if applicable
      const { error } = await supabase
        .from('bookings')
        .update({
          check_out: new_checkout_date,
          late_checkout_fee: late_fee || 0,
          overstay_detected: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking_id)

      if (error) throw error

      // Log the extension
      await supabase
        .from('audit_log')
        .insert([{
          action: 'overstay_extended',
          details: {
            booking_id,
            new_checkout_date,
            late_fee: late_fee || 0,
            processed_by: user.email
          },
          created_at: new Date().toISOString()
        }])

      return NextResponse.json({
        success: true,
        message: 'Overstay extended successfully'
      })

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be checkout or extend' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error handling overstay:', error)
    return NextResponse.json(
      { error: 'Failed to handle overstay' },
      { status: 500 }
    )
  }
}
