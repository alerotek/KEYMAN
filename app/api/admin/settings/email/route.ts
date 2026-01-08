import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

// Email configuration interface
interface EmailConfig {
  id: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_secure: boolean
  from_email: string
  from_name: string
  reply_to: string
  admin_emails: string[]
  manager_emails: string[]
  staff_emails: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// Get email configuration
export async function GET(request: Request) {
  try {
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = supabaseServer()

    const { data, error } = await supabase
      .from('email_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1) // Get most recent config

    if (error) {
      console.error('Email config fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch email configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      config: data || null
    })

  } catch (error) {
    console.error('Email config API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email configuration' },
      { status: 500 }
    )
  }
}

// Update email configuration
export async function POST(request: Request) {
  try {
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, profile } = authResult
    const body = await request.json()
    const {
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      smtp_secure,
      from_email,
      from_name,
      reply_to,
      admin_emails,
      manager_emails,
      staff_emails,
      is_active = true
    } = body

    if (!smtp_host || !smtp_port || !smtp_user || !smtp_password || !from_email) {
      return NextResponse.json(
        { error: 'Missing required SMTP configuration fields' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from('email_config')
      .select('id')
      .eq('is_active', true)
      .single()

    const configData = {
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      smtp_secure,
      from_email,
      from_name,
      reply_to,
      admin_emails,
      manager_emails,
      staff_emails,
      is_active,
      updated_at: new Date().toISOString()
    }

    let result
    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabase
        .from('email_config')
        .update(configData)
        .eq('id', existingConfig.id)
        .select()
        .single()

      if (error) {
        console.error('Email config update error:', error)
        return NextResponse.json(
          { error: 'Failed to update email configuration' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Create new config
      const { data, error } = await supabase
        .from('email_config')
        .insert([configData])
        .select()
        .single()

      if (error) {
        console.error('Email config creation error:', error)
        return NextResponse.json(
          { error: 'Failed to create email configuration' },
          { status: 500 }
        )
      }

      result = data
    }

    // Log audit entry
    await supabase
      .from('audit_log')
      .insert({
        action: 'email_config_updated',
        entity: 'email_config',
        entity_id: result?.id,
        actor_id: user.id,
        actor_role: profile.role,
        before_state: existingConfig ? { config: existingConfig } : null,
        after_state: { config: configData },
        details: {
          updated_by: profile.full_name,
          config_id: result?.id,
          fields_updated: Object.keys(configData)
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: 'Email configuration saved successfully',
      config: result
    })

  } catch (error) {
    console.error('Email config error:', error)
    return NextResponse.json(
      { error: 'Failed to save email configuration' },
      { status: 500 }
    )
  }
}

// Test email configuration
export async function PUT(request: Request) {
  try {
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, profile } = authResult
    const body = await request.json()
    const { test_email } = body

    if (!test_email) {
      return NextResponse.json(
        { error: 'Test email is required' },
        { status: 400 }
      )
    }

    // This would integrate with your email service
    const testResult = await sendTestEmail(test_email, profile.full_name)
    
    // Log audit entry
    const supabase = supabaseServer()
    await supabase
      .from('audit_log')
      .insert({
        action: 'email_test_sent',
        entity: 'email_config',
        actor_id: user.id,
        actor_role: profile.role,
        details: {
          test_email,
          test_result: testResult.success,
          sent_by: profile.full_name
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: testResult.success,
      message: testResult.success ? 'Test email sent successfully' : 'Failed to send test email',
      test_result: testResult
    })

  } catch (error) {
    console.error('Email test error:', error)
    return NextResponse.json(
      { error: 'Failed to test email configuration' },
      { status: 500 }
    )
  }
}

// Helper function to send test email
async function sendTestEmail(email: string, adminName: string): Promise<{success: boolean, message: string}> {
  try {
    // This would integrate with your email service (SendGrid, AWS SES, etc.)
    console.log(`Test email sent to ${email} from ${adminName}`)
    
    // Simulate email sending for demo
    await new Promise(resolve => setTimeout(() => {
      resolve({ success: true, message: 'Test email sent successfully' })
    }, 1000))
    
    return { success: true, message: 'Test email sent successfully' }
  } catch (error) {
    console.error('Test email error:', error)
    return { success: false, message: 'Failed to send test email' }
  }
}
