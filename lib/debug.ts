// Debug utility for environment variables
export function debugEnvironment() {
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV
  }
  
  console.log('=== ENVIRONMENT DEBUG ===')
  console.log(JSON.stringify(envVars, null, 2))
  console.log('=== END DEBUG ===')
  
  return envVars
}
