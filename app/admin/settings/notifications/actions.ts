'use client'

import { useState } from 'react'

interface NotificationSettings {
  enableBookingEmails: boolean
  enablePaymentEmails: boolean
  enableStatusChangeEmails: boolean
  enableWelcomeEmails: boolean
  defaultAdminEmail: string
  defaultManagerEmail: string
  ccEmails: string[]
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const response = await fetch('/api/admin/settings/notifications')
    if (!response.ok) {
      throw new Error('Failed to fetch settings')
    }
    const data = await response.json()
    return data.settings || {
      enableBookingEmails: true,
      enablePaymentEmails: true,
      enableStatusChangeEmails: true,
      enableWelcomeEmails: true,
      defaultAdminEmail: 'admin@keymanhotel.com',
      defaultManagerEmail: 'manager@keymanhotel.com',
      ccEmails: []
    }
  } catch (error) {
    console.error('Failed to fetch notification settings:', error)
    throw error
  }
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/admin/settings/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    })

    if (!response.ok) {
      throw new Error('Failed to update settings')
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to update notification settings:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export async function testEmailConfiguration(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/admin/settings/notifications/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to send test email')
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to send test email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getNotificationSettings()
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      setError(null)
      if (!settings) return
      
      const updatedSettings = { ...settings, ...newSettings }
      const result = await updateNotificationSettings(updatedSettings)
      
      if (result.success) {
        setSettings(updatedSettings)
      } else {
        setError(result.error || 'Failed to update settings')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
    }
  }

  const testEmail = async () => {
    try {
      setError(null)
      const result = await testEmailConfiguration()
      
      if (!result.success) {
        setError(result.error || 'Failed to send test email')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test email')
    }
  }

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
    testEmail
  }
}
