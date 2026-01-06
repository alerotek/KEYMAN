import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { RoomInventoryManager } from '@/lib/inventory/roomInventoryManager'

export const dynamic = 'force-dynamic'

// Create booking with inventory validation
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

    // Create booking with availability check
    const result = await inventoryManager.createBooking({
      room_type_id,
      check_in,
      check_out,
      customer_data
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        booking_id: result.booking_id,
        message: 'Booking created successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}

// Get booking availability
export async function GET(request: Request) {
  try {
    const inventoryManager = new RoomInventoryManager()
    const { searchParams } = new URL(request.url)
    const roomTypeId = searchParams.get('room_type_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!roomTypeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Calculate availability
    const availability = await inventoryManager.calculateAvailability(
      roomTypeId,
      startDate,
      endDate
    )

    return NextResponse.json(availability)

  } catch (error) {
    console.error('Error checking availability:', error)
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    )
  }
}
