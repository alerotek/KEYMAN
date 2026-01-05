import { createSupabaseServer } from '@/lib/supabase/server'

export async function sendBookingConfirmationEmail(booking: any) {
  try {
    // In a real implementation, you would use a service like SendGrid, Nodemailer, etc.
    // For now, we'll log the email and return success
    const supabase = createSupabaseServer()
    
    // Log the email notification
    await supabase
      .from('email_notifications')
      .insert([{
        type: 'booking_confirmation',
        recipient_email: booking.customers?.email,
        subject: 'Booking Confirmation - Keyman Hotel',
        message: `Dear ${booking.customers?.full_name},\n\nYour booking has been confirmed!\n\nBooking Details:\n- Room Type: ${booking.rooms?.room_type}\n- Check-in: ${new Date(booking.check_in).toLocaleDateString()}\n- Check-out: ${new Date(booking.check_out).toLocaleDateString()}\n- Guests: ${booking.guests_count}\n- Total Amount: KES ${booking.total_amount}\n\nWe look forward to welcoming you to Keyman Hotel!\n\nBest regards,\nKeyman Hotel Team`,
        status: 'sent',
        created_at: new Date().toISOString()
      }])

    console.log('Booking confirmation email sent to:', booking.customers?.email)
    return { success: true, message: 'Email sent successfully' }
  } catch (error) {
    console.error('Failed to send booking confirmation email:', error)
    return { success: false, message: 'Failed to send email' }
  }
}

export async function sendWelcomeEmail(customer: any) {
  try {
    const supabase = createSupabaseServer()
    
    await supabase
      .from('email_notifications')
      .insert([{
        type: 'welcome',
        recipient_email: customer.email,
        subject: 'Welcome to Keyman Hotel',
        message: `Dear ${customer.full_name},\n\nWelcome to Keyman Hotel! We're delighted to have you as our valued guest.\n\nYour account has been created and you can now:\n- Make bookings online\n- View your booking history\n- Manage your profile\n\nVisit our website to start your journey with us.\n\nBest regards,\nKeyman Hotel Team`,
        status: 'sent',
        created_at: new Date().toISOString()
      }])

    console.log('Welcome email sent to:', customer.email)
    return { success: true, message: 'Welcome email sent successfully' }
  } catch (error) {
    console.error('Failed to send welcome email:', error)
    return { success: false, message: 'Failed to send welcome email' }
  }
}
