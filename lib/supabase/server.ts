import { createClient } from '@supabase/supabase-js'

export const supabaseServer = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SERVICE ROLE KEY MISSING AT RUNTIME')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Export alias for backward compatibility
export { supabaseServer as createSupabaseServer }
