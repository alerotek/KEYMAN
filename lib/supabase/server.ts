import { createClient } from '@supabase/supabase-js'

export const supabaseServer = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase environment variables:', {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey
    })
    throw new Error('SUPABASE SERVICE ROLE KEY MISSING AT RUNTIME')
  }

  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

export { supabaseServer as createSupabaseServer }
