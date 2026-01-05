import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireMinimumRole } from '@/lib/auth/requireRole'
import { sendBookingStatusChangeEmail } from '@/lib/email/service'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verify staff role or higher
    const authResult = await requireMinimumRole('staff')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const supabase = createSupabaseServer()
    const bookingId = params.id

    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['Pending', 'Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Check if booking exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Validate status transitions
    const currentStatus = booking.status
    const validTransitions: Record<string, string[]> = {
      'Pending': ['Confirmed', 'Cancelled'],
      'Confirmed': ['Checked-In', 'Cancelled'],
      'Checked-In': ['Checked-Out'],
      'Checked-Out': [],
      'Cancelled': []
    }

    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${currentStatus} to ${status}` },
        { status: 400 }
      )
    }

    // Update booking status
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    // Assign staff member if not already assigned
    if (!booking.staff_id && status === 'Confirmed') {
      updateData.staff_id = user.id
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select(`
        *,
        customers(full_name, email),
        rooms(room_type),
        staff(full_name, role)
      `)
      .single()

    if (updateError) {
      console.error('Booking status update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update booking status' },
        { status: 500 }
      )
    }

    // Log status change for audit
    try {
      await supabase
        .from('booking_logs')
        .insert([{
          booking_id: bookingId,
          old_status: currentStatus,
          new_status: status,
          changed_by: user.id,
          changed_at: new Date().toISOString()
        }])
    } catch (logError) {
      console.error('Failed to log status change:', logError)
      // Don't fail the update if logging fails
    }

    // Send email notification (in production)
    try {
      await sendBookingStatusChangeEmail(updatedBooking, currentStatus, status)
      console.log(`Booking ${bookingId} status changed from ${currentStatus} to ${status}`)
      // This would trigger email notifications
    } catch (emailError) {
      console.error('Email notification error:', emailError)
      // Don't fail the update if email fails
    }

    return NextResponse.json({
      success: true,
      message: `Booking status updated to ${status}`,
      booking: updatedBooking
    })

  } catch (error) {
    console.error('Booking status update error:', error)
    return NextResponse.json(
      { error: 'Failed to update booking status' },
      { status: 500 }
    )
  }
}
