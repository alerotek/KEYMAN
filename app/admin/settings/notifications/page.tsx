'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface EmailSettings {
  enableBookingEmails: boolean
  enablePaymentEmails: boolean
  enableStatusChangeEmails: boolean
  enableWelcomeEmails: boolean
  defaultAdminEmail: string
  defaultManagerEmail: string
  emailProvider: 'smtp' | 'sendgrid' | 'ses'
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpFrom: string
  sendgridApiKey: string
  sesAccessKey: string
  sesSecretKey: string
  sesRegion: string
}

export default function AdminNotificationSettingsPage() {
  const [settings, setSettings] = useState<EmailSettings>({
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
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('notifications')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (!response.ok) {
        throw new Error('Failed to fetch settings')
      }
      const data = await response.json()
      setSettings(data.settings || {})
    } catch (err) {
      console.error('Failed to fetch settings:', err)
      setMessage('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      setMessage('Settings saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setMessage('Failed to save settings')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const testEmailSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Email test failed')
      }

      setMessage('Test email sent successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error('Email test failed:', err)
      setMessage('Email test failed. Check your configuration.')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notification Settings</h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure email notifications and templates
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/admin/settings"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
              >
                General Settings
              </Link>
              <Link 
                href="/admin/dashboard"
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert Message */}
        {message && (
          <div className="mb-6 p-4 rounded-md bg-blue-50 border border-blue-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 8a6 6 0 100-12 6 6 0 000 12zm1-5a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1H10a1 1 0 01-1-1V9a1 1 0 011-1zm0 0a8 8 0 100-16 8 8 0 000-16z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">{message}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setMessage('')}
                  className="text-blue-400 hover:text-blue-600"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'notifications'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Email Notifications
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'templates'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Email Templates
              </button>
              <button
                onClick={() => setActiveTab('providers')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'providers'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Email Providers
              </button>
            </nav>
          </div>

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Email Notification Settings</h2>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">📋 Booking Confirmations</h3>
                      <p className="text-sm text-gray-500">Send emails when new bookings are created</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enableBookingEmails}
                        onChange={(e) => setSettings({ ...settings, enableBookingEmails: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-amber-500 peer-checked:bg-amber-600 peer-checked:ring-amber-600 peer-checked:hover:bg-amber-700 peer-checked:ring-offset-0 peer-checked:ring-offset-2 peer-checked:ring-offset-2 peer-checked:ring-offset-2 relative inline-flex h-6 w-11 rounded-full transition-colors ease-in-out duration-200">
                        <span className="translate-x-1 inline-flex h-full w-6 rounded-full bg-white shadow transform ring-0 ring-transparent transition duration-200 ease-in-out"></span>
                        <span className="translate-x-1 inline-flex h-full w-6 rounded-full bg-white shadow transform ring-0 ring-transparent transition duration-200 ease-in-out"></span>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">💳 Payment Confirmations</h3>
                      <p className="text-sm text-gray-500">Send emails when payments are confirmed</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enablePaymentEmails}
                        onChange={(e) => setSettings({ ...settings, enablePaymentEmails: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-amber-500 peer-checked:bg-amber-600 peer-checked:ring-amber-600 peer-checked:hover:bg-amber-700 peer-checked:ring-offset-0 peer-checked:ring-offset-2 peer-checked:ring-offset-2 peer-checked:ring-offset-2 relative inline-flex h-6 w-11 rounded-full transition-colors ease-in-out duration-200">
                        <span className="translate-x-1 inline-flex h-full w-6 rounded-full bg-white shadow transform ring-0 ring-transparent transition duration-200 ease-in-out"></span>
                        <span className="translate-x-1 inline-flex h-full w-6 rounded-full bg-white shadow transform ring-0 ring-transparent transition duration-200 ease-in-out"></span>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">📊 Status Changes</h3>
                      <p className="text-sm text-gray-500">Notify when booking status changes</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enableStatusChangeEmails}
                        onChange={(e) => setSettings({ ...settings, enableStatusChangeEmails: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-amber-500 peer-checked:bg-amber-600 peer-checked:ring-amber-600 peer-checked:hover:bg-amber-700 peer-checked:ring-offset-0 peer-checked:ring-offset-2 peer-checked:ring-offset-2 peer-checked:ring-offset-2 relative inline-flex h-6 w-11 rounded-full transition-colors ease-in-out duration-200">
                        <span className="translate-x-1 inline-flex h-full w-6 rounded-full bg-white shadow transform ring-0 ring-transparent transition duration-200 ease-in-out"></span>
                        <span className="translate-x-1 inline-flex h-full w-6 rounded-full bg-white shadow transform ring-0 ring-transparent transition duration-200 ease-in-out"></span>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">🎉 Welcome Emails</h3>
                      <p className="text-sm text-gray-500">Send welcome emails to new customers</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enableWelcomeEmails}
                        onChange={(e) => setSettings({ ...settings, enableWelcomeEmails: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-amber-500 peer-checked:bg-amber-600 peer-checked:ring-amber-600 peer-checked:hover:bg-amber-700 peer-checked:ring-offset-0 peer-checked:ring-offset-2 peer-checked:ring-offset-2 peer-checked:ring-offset-2 relative inline-flex h-6 w-11 rounded-full transition-colors ease-in-out duration-200">
                        <span className="translate-x-1 inline-flex h-full w-6 rounded-full bg-white shadow transform ring-0 ring-transparent transition duration-200 ease-in-out"></span>
                        <span className="translate-x-1 inline-flex h-full w-6 rounded-full bg-white shadow transform ring-0 ring-transparent transition duration-200 ease-in-out"></span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Default Recipients */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Default Email Recipients</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Admin Email</label>
                      <input
                        type="email"
                        value={settings.defaultAdminEmail}
                        onChange={(e) => setSettings({ ...settings, defaultAdminEmail: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="admin@keymanhotel.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Manager Email</label>
                      <input
                        type="email"
                        value={settings.defaultManagerEmail}
                        onChange={(e) => setSettings({ ...settings, defaultManagerEmail: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="manager@keymanhotel.com"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Email Templates</h2>
              
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">📋 Booking Confirmation Template</h3>
                  <p className="text-sm text-gray-600 mb-3">Sent to customers when their booking is confirmed</p>
                  <div className="bg-white rounded border border-gray-200 p-3">
                    <code className="text-xs text-gray-700">
                      Subject: Your Booking at Keyman Hotel is Confirmed<br/>
                      Recipients: Customer, Admin, Manager, Assigned Staff<br/>
                      Content: HTML template with booking details, status, and CTA
                    </code>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">💳 Payment Confirmation Template</h3>
                  <p className="text-sm text-gray-600 mb-3">Sent to customers when payment is received</p>
                  <div className="bg-white rounded border border-gray-200 p-3">
                    <code className="text-xs text-gray-700">
                      Subject: Payment Received - Thank You<br/>
                      Recipients: Customer, Admin, Manager<br/>
                      Content: HTML template with payment details and booking confirmation
                    </code>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">📊 Status Change Template</h3>
                  <p className="text-sm text-gray-600 mb-3">Sent when booking status changes</p>
                  <div className="bg-white rounded border border-gray-200 p-3">
                    <code className="text-xs text-gray-700">
                      Subject: Booking Status Updated - Keyman Hotel<br/>
                      Recipients: Customer, Admin, Manager<br/>
                      Content: HTML template with status change and current details
                    </code>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">🎉 Welcome Template</h3>
                  <p className="text-sm text-gray-600 mb-3">Sent to new customers when they register</p>
                  <div className="bg-white rounded border border-gray-200 p-3">
                    <code className="text-xs text-gray-700">
                      Subject: Welcome to Keyman Hotel<br/>
                      Recipients: New Customer<br/>
                      Content: HTML template with welcome message and features
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Providers Tab */}
          {activeTab === 'providers' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Email Provider Configuration</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Provider</label>
                    <select
                      value={settings.emailProvider}
                      onChange={(e) => setSettings({ ...settings, emailProvider: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="smtp">SMTP</option>
                      <option value="sendgrid">SendGrid</option>
                      <option value="ses">Amazon SES</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From Email</label>
                    <input
                      type="email"
                      value={settings.smtpFrom}
                      onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="noreply@keymanhotel.com"
                    />
                  </div>
                </div>

                {/* SMTP Configuration */}
                {settings.emailProvider === 'smtp' && (
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h3 className="text-sm font-medium text-gray-900">SMTP Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Host</label>
                        <input
                          type="text"
                          value={settings.smtpHost}
                          onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="smtp.gmail.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Port</label>
                        <input
                          type="number"
                          value={settings.smtpPort}
                          onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="587"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                        <input
                          type="text"
                          value={settings.smtpUser}
                          onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="your-email@gmail.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input
                          type="password"
                          value={settings.smtpPassword}
                          onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="••••••••••••"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SendGrid Configuration */}
                {settings.emailProvider === 'sendgrid' && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">SendGrid Configuration</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">SendGrid API Key</label>
                      <input
                        type="password"
                        value={settings.sendgridApiKey}
                        onChange={(e) => setSettings({ ...settings, sendgridApiKey: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      />
                    </div>
                  </div>
                )}

                {/* SES Configuration */}
                {settings.emailProvider === 'ses' && (
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h3 className="text-sm font-medium text-gray-900">Amazon SES Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Access Key ID</label>
                        <input
                          type="text"
                          value={settings.sesAccessKey}
                          onChange={(e) => setSettings({ ...settings, sesAccessKey: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="AKIAIOSFODNN7EXAMPLE"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
                        <input
                          type="password"
                          value={settings.sesSecretKey}
                          onChange={(e) => setSettings({ ...settings, sesSecretKey: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="••••••••••••"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">AWS Region</label>
                        <select
                          value={settings.sesRegion}
                          onChange={(e) => setSettings({ ...settings, sesRegion: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="us-east-1">US East (N. Virginia)</option>
                          <option value="us-west-2">US West (Oregon)</option>
                          <option value="eu-west-1">Europe (Ireland)</option>
                          <option value="ap-south-1">Asia Pacific (Singapore)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Test Email */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Test Email Configuration</h3>
                      <p className="text-sm text-gray-500">Send a test email to verify your settings</p>
                    </div>
                    <button
                      onClick={testEmailSettings}
                      className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium"
                    >
                      Send Test Email
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Email System Information</h2>
          <div className="space-y-4 text-sm text-gray-600">
            <p>
              <strong>📧 Email Queue:</strong> All emails are queued and sent via the configured provider.
            </p>
            <p>
              <strong>📊 Logging:</strong> Email notifications are logged in the database for audit purposes.
            </p>
            <p>
              <strong>🔒 Security:</strong> Email credentials are encrypted and stored securely.
            </p>
            <p>
              <strong>⚡ Rate Limits:</strong> Be mindful of your email provider's rate limits.
            </p>
            <p>
              <strong>🎨 Templates:</strong> All emails use professional HTML templates with luxury hotel branding.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
