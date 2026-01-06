import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { RoomInventoryManager } from '@/lib/inventory/roomInventoryManager'

export const dynamic = 'force-dynamic'

// Get room types and availability
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomTypeId = searchParams.get('room_type_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const userRole = searchParams.get('role') || 'customer'

    const inventoryManager = new RoomInventoryManager()
    // Get room types
    const roomTypes = await inventoryManager.getRoomTypes()

    // If specific room type and dates requested, calculate availability
    if (roomTypeId && startDate && endDate) {
      const availability = await inventoryManager.calculateAvailability(
        roomTypeId,
        startDate,
        endDate
      )
      
      return NextResponse.json({
        room_types: roomTypes,
        availability
      })
    }

    // Get dashboard data based on role
    const dashboardData = await inventoryManager.getDashboardData(userRole)

    return NextResponse.json({
      room_types: roomTypes,
      dashboard: dashboardData
    })

  } catch (error) {
    console.error('Error fetching room inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch room inventory' },
      { status: 500 }
    )
  }
}

// Validate booking request
export async function POST(request: Request) {
  try {
    const inventoryManager = new RoomInventoryManager()
    const body = await request.json()
    const { room_type_id, check_in, check_out, customer_data } = body

    if (!room_type_id || !check_in || !check_out || !customer_data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate booking request
    const validation = await inventoryManager.validateBookingRequest({
      room_type_id,
      check_in,
      check_out,
      customer_data
    })

    return NextResponse.json(validation)

  } catch (error) {
    console.error('Error validating booking request:', error)
    return NextResponse.json(
      { error: 'Failed to validate booking request' },
      { status: 500 }
    )
  }
}
