import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Require admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = createSupabaseServer()

    // Get notification settings
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to fetch notification settings' },
        { status: 500 }
      )
    }

    // Return settings or defaults
    const settings = data || {
      enableBookingEmails: true,
      enablePaymentEmails: true,
      enableStatusChangeEmails: true,
      enableWelcomeEmails: true,
      defaultAdminEmail: 'admin@keymanhotel.com',
      defaultManagerEmail: 'manager@keymanhotel.com',
      ccEmails: []
    }

    return NextResponse.json({ settings })

  } catch (error) {
    console.error('Notification settings GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Require admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const {
      enableBookingEmails,
      enablePaymentEmails,
      enableStatusChangeEmails,
      enableWelcomeEmails,
      defaultAdminEmail,
      defaultManagerEmail,
      ccEmails
    } = body

    const supabase = createSupabaseServer()

    // Update or insert notification settings
    const { data, error } = await supabase
      .from('notification_settings')
      .upsert({
        enable_booking_emails: enableBookingEmails,
        enable_payment_emails: enablePaymentEmails,
        enable_status_change_emails: enableStatusChangeEmails,
        enable_welcome_emails: enableWelcomeEmails,
        default_admin_email: defaultAdminEmail,
        default_manager_email: defaultManagerEmail,
        cc_emails: ccEmails,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Notification settings update error:', error)
      return NextResponse.json(
        { error: 'Failed to update notification settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Notification settings updated successfully',
      settings: data
    })

  } catch (error) {
    console.error('Notification settings POST error:', error)
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    )
  }
}
