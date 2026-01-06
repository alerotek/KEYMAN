import { createClient } from '@supabase/supabase-js'

export const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  console.log('Supabase Environment Check:', {
    NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!supabaseKey,
    NODE_ENV: process.env.NODE_ENV
  })
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables:', {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: !!supabaseKey
    })
    throw new Error(`Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`)
  }

  try {
    return createClient(supabaseUrl, supabaseKey)
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    throw new Error(`Supabase client initialization failed: ${error.message}`)
  }
}

// Export alias for backward compatibility
export { createServerClient as createSupabaseServer }
