// Test script to verify email configuration
import { sendEmail } from '../lib/email/sendEmail'

async function testEmail() {
  console.log('🧪 Testing email system...')
  
  const testHTML = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>🏨 Keyman Hotel Email Test</h2>
      <p>This is a test email from your Keyman Hotel application.</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Status:</strong> ✅ Email system is working!</p>
    </div>
  `
  
  try {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Keyman Hotel - Email System Test',
      html: testHTML
    })
    
    console.log('📧 Email Test Result:', result)
    
    if (result.success) {
      console.log('✅ Email system is configured correctly!')
      console.log('📊 Check your console logs for email details')
    } else {
      console.log('❌ Email test failed:', result.error)
    }
  } catch (error) {
    console.error('💥 Email test error:', error)
  }
}

// Run the test
testEmail()
