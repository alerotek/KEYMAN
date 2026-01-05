import { createSupabaseServer } from '@/lib/supabase/server'

export async function sendBookingConfirmationEmail(booking: any) {
  try {
    const supabase = createSupabaseServer()
    
    // HTML email template for customer
    const customerEmailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - Keyman Hotel</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #d97706, #f59e0b); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #6b7280; }
    .value { font-weight: 500; color: #111827; }
    .status { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #10b981; color: white; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
    .cta-button { display: inline-block; background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏨 Keyman Hotel</div>
    <h1>Booking Confirmed!</h1>
  </div>
  
  <div class="content">
    <h2>Hello ${booking.customers?.full_name || 'Valued Guest'},</h2>
    <p>Your booking has been confirmed and we're excited to welcome you to Keyman Hotel!</p>
    
    <div class="booking-details">
      <h3>📋 Booking Details</h3>
      <div class="detail-row">
        <span class="label">Booking ID:</span>
        <span class="value">#${booking.id}</span>
      </div>
      <div class="detail-row">
        <span class="label">Room Type:</span>
        <span class="value">${(booking.rooms as any)?.room_type || 'Standard Room'}</span>
      </div>
      <div class="detail-row">
        <span class="label">Check-in:</span>
        <span class="value">${new Date(booking.check_in).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="detail-row">
        <span class="label">Check-out:</span>
        <span class="value">${new Date(booking.check_out).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="detail-row">
        <span class="label">Guests:</span>
        <span class="value">${booking.guests_count} ${booking.guests_count === 1 ? 'Guest' : 'Guests'}</span>
      </div>
      <div class="detail-row">
        <span class="label">Total Amount:</span>
        <span class="value">KES ${booking.total_amount?.toLocaleString()}</span>
      </div>
      <div class="detail-row">
        <span class="label">Status:</span>
        <span class="status">${booking.status}</span>
      </div>
    </div>
    
    ${booking.breakfast ? '<p>✅ Breakfast included</p>' : ''}
    ${booking.vehicle ? '<p>🚗 Vehicle booking included</p>' : ''}
    
    <a href="https://keymanhotel.vercel.app/customer/dashboard" class="cta-button">View Your Booking</a>
    
    <p>If you have any questions or need to make changes to your booking, please don't hesitate to contact our reception team.</p>
    
    <p>We look forward to providing you with an exceptional stay at Keyman Hotel!</p>
  </div>
  
  <div class="footer">
    <p><strong>Keyman Hotel</strong></p>
    <p>📍 Nairobi, Kenya</p>
    <p>📞 +254 123 456 789</p>
    <p>📧 info@keymanhotel.com</p>
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</body>
</html>
`

    // Log the customer email notification
    await supabase
      .from('email_notifications')
      .insert([{
        type: 'booking_confirmation',
        recipient_email: booking.customers?.email,
        subject: 'Your Booking at Keyman Hotel is Confirmed',
        message: customerEmailHTML,
        status: 'sent',
        created_at: new Date().toISOString()
      }])

    // Send to admin and manager
    await sendEmailToAdmins('booking_confirmation', {
      subject: 'New Booking Created – Action Required',
      message: `
A new booking has been created and requires your attention.

📋 Booking Details:
• Customer: ${booking.customers?.full_name}
• Email: ${booking.customers?.email}
• Room: ${(booking.rooms as any)?.room_type}
• Dates: ${new Date(booking.check_in).toLocaleDateString()} → ${new Date(booking.check_out).toLocaleDateString()}
• Amount: KES ${booking.total_amount?.toLocaleString()}
• Status: ${booking.status}

Please review and prepare accordingly.
      `
    })

    // Send to staff if assigned
    if (booking.staff_id) {
      await sendEmailToStaff(booking.staff_id, 'booking_confirmation', {
        subject: 'New Booking Assignment - Keyman Hotel',
        message: `
You have been assigned a new booking:

📋 Booking Details:
• Customer: ${booking.customers?.full_name}
• Room: ${(booking.rooms as any)?.room_type}
• Check-in: ${new Date(booking.check_in).toLocaleDateString()}
• Check-out: ${new Date(booking.check_out).toLocaleDateString()}
• Amount: KES ${booking.total_amount?.toLocaleString()}

Please prepare for the guest's arrival.
        `
      })
    }

    console.log('Booking confirmation email sent to:', booking.customers?.email)
    return { success: true, message: 'Email sent successfully' }
  } catch (error) {
    console.error('Failed to send booking confirmation email:', error)
    return { success: false, message: 'Failed to send email' }
  }
}

export async function sendPaymentConfirmationEmail(payment: any, booking: any) {
  try {
    const supabase = createSupabaseServer()
    
    // HTML email template for customer
    const customerEmailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Received - Keyman Hotel</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #6b7280; }
    .value { font-weight: 500; color: #111827; }
    .status { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #10b981; color: white; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
    .cta-button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .payment-badge { background: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 6px; font-weight: 600; text-align: center; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏨 Keyman Hotel</div>
    <h1>💰 Payment Received!</h1>
  </div>
  
  <div class="content">
    <h2>Hello ${booking.customers?.full_name || 'Valued Guest'},</h2>
    <p>Thank you for your payment! We have successfully received and confirmed your payment for your booking at Keyman Hotel.</p>
    
    <div class="payment-badge">
      Payment Confirmed ✅
    </div>
    
    <div class="payment-details">
      <h3>💳 Payment Details</h3>
      <div class="detail-row">
        <span class="label">Payment ID:</span>
        <span class="value">#${payment.id}</span>
      </div>
      <div class="detail-row">
        <span class="label">Amount Paid:</span>
        <span class="value">KES ${payment.amount_paid.toLocaleString()}</span>
      </div>
      <div class="detail-row">
        <span class="label">Payment Method:</span>
        <span class="value">${payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Payment Date:</span>
        <span class="value">${new Date(payment.paid_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
    </div>
    
    <div class="payment-details">
      <h3>📋 Booking Details</h3>
      <div class="detail-row">
        <span class="label">Booking ID:</span>
        <span class="value">#${booking.id}</span>
      </div>
      <div class="detail-row">
        <span class="label">Room Type:</span>
        <span class="value">${(booking.rooms as any)?.room_type || 'Standard Room'}</span>
      </div>
      <div class="detail-row">
        <span class="label">Check-in:</span>
        <span class="value">${new Date(booking.check_in).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="detail-row">
        <span class="label">Check-out:</span>
        <span class="value">${new Date(booking.check_out).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="detail-row">
        <span class="label">Status:</span>
        <span class="status">${booking.status}</span>
      </div>
    </div>
    
    <a href="https://keymanhotel.vercel.app/customer/dashboard" class="cta-button">View Your Booking</a>
    
    <p>Your booking is now fully confirmed. We look forward to welcoming you to Keyman Hotel!</p>
    
    <p>If you have any questions about your payment or booking, please don't hesitate to contact our reception team.</p>
  </div>
  
  <div class="footer">
    <p><strong>Keyman Hotel</strong></p>
    <p>📍 Nairobi, Kenya</p>
    <p>📞 +254 123 456 789</p>
    <p>📧 info@keymanhotel.com</p>
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</body>
</html>
`

    // Log the customer email notification
    await supabase
      .from('email_notifications')
      .insert([{
        type: 'payment_confirmation',
        recipient_email: booking.customers?.email,
        subject: 'Payment Received - Thank You',
        message: customerEmailHTML,
        status: 'sent',
        created_at: new Date().toISOString()
      }])

    // Send to admin and manager
    await sendEmailToAdmins('payment_confirmation', {
      subject: `Payment Confirmed – Booking #${booking.id}`,
      message: `
Payment has been confirmed for a booking:

💳 Payment Details:
• Customer: ${booking.customers?.full_name}
• Booking ID: #${booking.id}
• Amount: KES ${payment.amount_paid.toLocaleString()}
• Method: ${payment.method}
• Date: ${new Date(payment.paid_at).toLocaleDateString()}

The booking status has been updated to Confirmed.
      `
    })

    console.log('Payment confirmation email sent to:', booking.customers?.email)
    return { success: true, message: 'Email sent successfully' }
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error)
    return { success: false, message: 'Failed to send email' }
  }
}

export async function sendBookingStatusChangeEmail(booking: any, oldStatus: string, newStatus: string) {
  try {
    const supabase = createSupabaseServer()
    
    const statusColors = {
      'Pending': '#f59e0b',
      'Confirmed': '#10b981',
      'Checked-In': '#3b82f6',
      'Checked-Out': '#6b7280',
      'Cancelled': '#ef4444'
    }
    
    const statusColor = statusColors[newStatus as keyof typeof statusColors] || '#6b7280'
    
    // HTML email template for customer
    const customerEmailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Status Updated - Keyman Hotel</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, ${statusColor}, ${statusColor}dd); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .status-update { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor}; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #6b7280; }
    .value { font-weight: 500; color: #111827; }
    .status { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${statusColor}; color: white; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
    .cta-button { display: inline-block; background: ${statusColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .status-change { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏨 Keyman Hotel</div>
    <h1>📋 Booking Status Updated</h1>
  </div>
  
  <div class="content">
    <h2>Hello ${booking.customers?.full_name || 'Valued Guest'},</h2>
    <p>Your booking status has been updated. Here are the details:</p>
    
    <div class="status-change">
      <strong>Status Change:</strong><br>
      <span style="text-decoration: line-through; color: #6b7280;">${oldStatus}</span> → <span style="color: ${statusColor}; font-weight: bold;">${newStatus}</span>
    </div>
    
    <div class="status-update">
      <h3>📋 Current Booking Details</h3>
      <div class="detail-row">
        <span class="label">Booking ID:</span>
        <span class="value">#${booking.id}</span>
      </div>
      <div class="detail-row">
        <span class="label">Room Type:</span>
        <span class="value">${(booking.rooms as any)?.room_type || 'Standard Room'}</span>
      </div>
      <div class="detail-row">
        <span class="label">Check-in:</span>
        <span class="value">${new Date(booking.check_in).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="detail-row">
        <span class="label">Check-out:</span>
        <span class="value">${new Date(booking.check_out).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="detail-row">
        <span class="label">Current Status:</span>
        <span class="status">${newStatus}</span>
      </div>
    </div>
    
    <a href="https://keymanhotel.vercel.app/customer/dashboard" class="cta-button">View Your Booking</a>
    
    <p>If you have any questions about your booking status, please don't hesitate to contact our reception team.</p>
  </div>
  
  <div class="footer">
    <p><strong>Keyman Hotel</strong></p>
    <p>📍 Nairobi, Kenya</p>
    <p>📞 +254 123 456 789</p>
    <p>📧 info@keymanhotel.com</p>
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</body>
</html>
`

    // Log the customer email notification
    await supabase
      .from('email_notifications')
      .insert([{
        type: 'status_change',
        recipient_email: booking.customers?.email,
        subject: `Booking Status Updated - Keyman Hotel`,
        message: customerEmailHTML,
        status: 'sent',
        created_at: new Date().toISOString()
      }])

    // Send to admin and manager
    await sendEmailToAdmins('status_change', {
      subject: `Booking Status Changed - #${booking.id}`,
      message: `
Booking status has been updated:

📋 Status Change:
• Customer: ${booking.customers?.full_name}
• Booking ID: #${booking.id}
• Status: ${oldStatus} → ${newStatus}
• Updated: ${new Date().toLocaleDateString()}

Please review the booking details if needed.
      `
    })

    console.log('Status change email sent for booking:', booking.id)
    return { success: true, message: 'Email sent successfully' }
  } catch (error) {
    console.error('Failed to send status change email:', error)
    return { success: false, message: 'Failed to send email' }
  }
}

export async function sendWelcomeEmail(customer: any) {
  try {
    const supabase = createSupabaseServer()
    
    // HTML email template for welcome
    const welcomeEmailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Keyman Hotel</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #d97706, #f59e0b); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .welcome-message { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706; }
    .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .feature { background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
    .feature-icon { font-size: 24px; margin-bottom: 10px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
    .cta-button { display: inline-block; background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏨 Keyman Hotel</div>
    <h1>Welcome to Keyman Hotel!</h1>
  </div>
  
  <div class="content">
    <h2>Hello ${customer.full_name},</h2>
    <p>We're delighted to welcome you to Keyman Hotel! Your account has been created and you're now part of our valued guest community.</p>
    
    <div class="welcome-message">
      <h3>🎉 What You Can Do Now</h3>
      <p>With your new account, you have access to exclusive features that make your stay with us even better:</p>
      
      <div class="feature-grid">
        <div class="feature">
          <div class="feature-icon">📋</div>
          <h4>Make Bookings</h4>
          <p>Book rooms online anytime</p>
        </div>
        <div class="feature">
          <div class="feature-icon">📊</div>
          <h4>View History</h4>
          <p>Track all your past bookings</p>
        </div>
        <div class="feature">
          <div class="feature-icon">👤</div>
          <h4>Manage Profile</h4>
          <p>Update your personal details</p>
        </div>
        <div class="feature">
          <div class="feature-icon">🏨</div>
          <h4>Exclusive Offers</h4>
          <p>Get special member benefits</p>
        </div>
      </div>
    </div>
    
    <a href="https://keymanhotel.vercel.app/home" class="cta-button">Start Your Journey</a>
    
    <p>Whether you're planning your first stay or returning as a valued guest, we're committed to making your experience at Keyman Hotel exceptional.</p>
    
    <p>If you have any questions or need assistance, our team is always here to help you.</p>
  </div>
  
  <div class="footer">
    <p><strong>Keyman Hotel</strong></p>
    <p>📍 Nairobi, Kenya</p>
    <p>📞 +254 123 456 789</p>
    <p>📧 info@keymanhotel.com</p>
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</body>
</html>
`

    await supabase
      .from('email_notifications')
      .insert([{
        type: 'welcome',
        recipient_email: customer.email,
        subject: 'Welcome to Keyman Hotel',
        message: welcomeEmailHTML,
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

async function sendEmailToAdmins(type: string, data: any) {
  const supabase = createSupabaseServer()
  
  // Get admin and manager emails
  const { data: staff } = await supabase
    .from('staff')
    .select('email, role')
    .in('role', ['admin', 'manager'])

  if (staff && staff.length > 0) {
    for (const staffMember of staff) {
      await supabase
        .from('email_notifications')
        .insert([{
          type: type,
          recipient_email: staffMember.email,
          subject: data.subject,
          message: data.message,
          status: 'sent',
          created_at: new Date().toISOString()
        }])
    }
  }
}

async function sendEmailToStaff(staffId: string, type: string, data: any) {
  const supabase = createSupabaseServer()
  
  // Get staff member email
  const { data: staff } = await supabase
    .from('staff')
    .select('email')
    .eq('id', staffId)
    .single()

  if (staff) {
    await supabase
      .from('email_notifications')
      .insert([{
        type: type,
        recipient_email: staff.email,
        subject: data.subject,
        message: data.message,
        status: 'sent',
        created_at: new Date().toISOString()
      }])
  }
}
