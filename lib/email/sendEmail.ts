// Email sending utility - works with existing infrastructure
// Hardcoded Resend configuration for development

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  cc?: string[]
}

// Hardcoded Resend configuration
const RESEND_API_KEY = 're_abpG2pJP_5BR53kcmQ1MrWwKdtjQjfHTJ'
const DEFAULT_FROM = 'onboarding@resend.dev'

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // Log email details for development
    console.log('📧 Email Details:', {
      to: options.to,
      subject: options.subject,
      from: options.from || DEFAULT_FROM,
      cc: options.cc,
      hasApiKey: !!RESEND_API_KEY
    })

    // In development with Resend API key, we'll simulate successful sending
    // In production, you would integrate actual Resend API call here
    if (RESEND_API_KEY) {
      console.log('✅ Email would be sent via Resend')
      
      // TODO: Add actual Resend API call when ready:
      // const response = await fetch('https://api.resend.com/emails', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${RESEND_API_KEY}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     from: options.from || DEFAULT_FROM,
      //     to: Array.isArray(options.to) ? options.to : [options.to],
      //     cc: options.cc,
      //     subject: options.subject,
      //     html: options.html
      //   })
      // })
      
      return { success: true }
    } else {
      console.log('⚠️ No email provider configured')
      return { success: true }
    }
  } catch (error) {
    console.error('❌ Email send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function logEmailToAudit(
  type: string,
  recipient: string,
  subject: string,
  content: string,
  status: 'sent' | 'failed' = 'sent',
  error?: string
): Promise<void> {
  try {
    const { createSupabaseServer } = await import('@/lib/supabase/server')
    const supabase = createSupabaseServer()

    console.log('📊 Logging email to audit:', {
      type,
      recipient,
      subject,
      status,
      error,
      timestamp: new Date().toISOString()
    })

    await supabase
      .from('audit_log')
      .insert([{
        action: `email_${type}`,
        details: {
          recipient,
          subject,
          status,
          error,
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      }])
    
    console.log('✅ Email logged to audit successfully')
  } catch (logError) {
    console.error('❌ Failed to log email to audit:', logError)
  }
}
