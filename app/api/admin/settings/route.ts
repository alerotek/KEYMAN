import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Verify admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = supabaseServer()

    // Get current settings from database or return defaults
    const { data: settings } = await supabase
      .from('email_settings')
      .select('*')
      .single()

    const defaultSettings = {
      enableBookingEmails: true,
      enablePaymentEmails: true,
      enableStatusChangeEmails: true,
      enableWelcomeEmails: true,
      defaultAdminEmail: 'admin@keymanhotel.com',
      defaultManagerEmail: 'manager@keymanhotel.com',
      emailProvider: 'smtp',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpFrom: 'noreply@keymanhotel.com',
      sendgridApiKey: '',
      sesAccessKey: '',
      sesSecretKey: '',
      sesRegion: 'us-east-1'
    }

    return NextResponse.json({
      settings: settings || defaultSettings
    })
  } catch (error) {
    console.error('Settings fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Verify admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = supabaseServer()
    const settings = await request.json()

    // Validate settings
    const validProviders = ['smtp', 'sendgrid', 'ses']
    if (settings.emailProvider && !validProviders.includes(settings.emailProvider)) {
      return NextResponse.json(
        { error: 'Invalid email provider' },
        { status: 400 }
      )
    }

    // Update or create settings
    const { data, error } = await supabase
      .from('email_settings')
      .upsert({
        id: 'default',
        ...settings,
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (error) {
      console.error('Settings save error:', error)
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: data
    })
  } catch (error) {
    console.error('Settings save error:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
