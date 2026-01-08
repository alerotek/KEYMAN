import { createSupabaseServer } from '@/lib/supabase/server'
import { createBrowserClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase env variables')

export const browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

export const ROLE_HIERARCHY = { guest:0, customer:1, staff:2, manager:3, admin:4 } as const
export const VALID_ROLES = ['guest','customer','staff','manager','admin'] as const

export function createServerClient() { return createSupabaseServer() }
export function createClient() { return browserClient }

export async function getSecureSession() {
  const supabase = createServerClient()
  try {
    const { data:{ session }, error } = await supabase.auth.getSession()
    if (error || !session) return null
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', session.user.id)
      .single()
    if (profileError || !profile) return null
    return { session, profile:{ id: profile.id, role: profile.role?.toLowerCase()||'customer', full_name: profile.full_name, email: profile.email, user_id: session.user.id } }
  } catch { return null }
}

export async function requireRole(requiredRole: string) {
  const secureSession = await getSecureSession()
  if (!secureSession) return NextResponse.json({ error:'Authentication required' }, { status:401 })
  const userLevel = ROLE_HIERARCHY[secureSession.profile.role as keyof typeof ROLE_HIERARCHY]||0
  const requiredLevel = ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY]||0
  if (userLevel<requiredLevel) return NextResponse.json({ error:`Insufficient permissions. Required: ${requiredRole}, Current: ${secureSession.profile.role}` }, { status:403 })
  return { user: secureSession.session.user, profile: secureSession.profile }
}
