import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { sendEmail, logEmailToAudit } from '@/lib/email/sendEmail'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Require admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = createSupabaseServer()

    // Get notification settings for test email
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('*')
      .single()

    const adminEmail = settings?.default_admin_email || 'admin@keymanhotel.com'

    // Create test email HTML
    const testEmailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Email - Keyman Hotel</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #d97706, #f59e0b); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .test-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏨 Keyman Hotel</div>
    <h1>Test Email</h1>
  </div>
  
  <div class="content">
    <h2>Hello Admin,</h2>
    <p>This is a test email to verify that your email configuration is working correctly.</p>
    
    <div class="test-info">
      <h3>✅ Email System Test</h3>
      <p><strong>Test Date:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>System Status:</strong> Operational</p>
      <p><strong>Email Provider:</strong> Resend (Configured)</p>
      <p><strong>From Address:</strong> onboarding@resend.dev</p>
    </div>
    
    <p>If you received this email, your notification system is working properly!</p>
    
    <p>Best regards,<br/>Keyman Hotel System</p>
  </div>
  
  <div class="footer">
    <p><strong>Keyman Hotel</strong></p>
    <p>📍 Nairobi, Kenya</p>
    <p>📞 +254 123 456 789</p>
    <p>📧 info@keymanhotel.com</p>
    <p>This is an automated test message.</p>
  </div>
</body>
</html>
`

    // Send test email
    const result = await sendEmail({
      to: adminEmail,
      subject: 'Keyman Hotel - Email System Test',
      html: testEmailHTML
    })

    // Log the test email
    await logEmailToAudit(
      'test_email',
      adminEmail,
      'Keyman Hotel - Email System Test',
      testEmailHTML,
      result.success ? 'sent' : 'failed',
      result.error
    )

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send test email', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      details: {
        to: adminEmail,
        from: 'onboarding@resend.dev',
        provider: 'Resend'
      }
    })

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}
