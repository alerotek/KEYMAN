import { createSupabaseServer } from '@/lib/supabase/server'
import { createBrowserClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  throw new Error('Missing Supabase environment variables')
}

// Browser client for client-side use
export const browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Strict role hierarchy for production-grade RBAC
export const ROLE_HIERARCHY = {
  'guest': 0,
  'customer': 1,
  'staff': 2,
  'manager': 3,
  'admin': 4
} as const

export const VALID_ROLES = ['guest', 'customer', 'staff', 'manager', 'admin'] as const

// Server-side only Supabase client
export function createServerClient() {
  return createSupabaseServer()
}

// Client-side only Supabase client
export function createClient() {
  return browserClient
}

// Secure session management
export async function getSecureSession() {
  const supabase = createServerClient()
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Session error:', error)
      return null
    }
    
    if (!session) {
      return null
    }
    
    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', session.user.id)
      .single()
    
    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return null
    }
    
    return {
      session,
      profile: {
        id: profile.id,
        role: profile.role?.toLowerCase() || 'customer',
        full_name: profile.full_name,
        email: profile.email,
        user_id: session.user.id
      }
    }
  } catch (error) {
    console.error('Secure session error:', error)
    return null
  }
}

// Role-based access control
export async function requireRole(requiredRole: string) {
  const secureSession = await getSecureSession()
  
  if (!secureSession) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }
  
  const userRole = secureSession.profile.role
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY] || 0
  
  if (userLevel < requiredLevel) {
    return NextResponse.json(
      { error: `Insufficient permissions. Required: ${requiredRole}, Current: ${userRole}` },
      { status: 403 }
    )
  }
  
  return {
    user: secureSession.session.user,
    profile: secureSession.profile
  }
}

// Minimum role requirement
export async function requireMinimumRole(minimumRole: string) {
  const secureSession = await getSecureSession()
  
  if (!secureSession) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }
  
  const userRole = secureSession.profile.role
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0
  const requiredLevel = ROLE_HIERARCHY[minimumRole as keyof typeof ROLE_HIERARCHY] || 0
  
  if (userLevel < requiredLevel) {
    return NextResponse.json(
      { error: `Insufficient permissions. Required minimum: ${minimumRole}, Current: ${userRole}` },
      { status: 403 }
    )
  }
  
  return {
    user: secureSession.session.user,
    profile: secureSession.profile
  }
}

// Permission checking helper
export function hasPermission(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY] || 0
  return userLevel >= requiredLevel
}

// Role-based redirect logic
export function getRoleRedirect(userRole: string): string {
  const redirects = {
    'admin': '/admin/dashboard',
    'manager': '/manager/dashboard',
    'staff': '/staff/dashboard',
    'customer': '/customer/dashboard',
    'guest': '/book'
  }
  
  return redirects[userRole as keyof typeof redirects] || '/book'
}

// Safe data fetching with role validation
export async function fetchDataWithRole<T>(
  queryFn: (user: any, profile: any) => Promise<T>,
  requiredRole: string = 'staff'
): Promise<T> {
  const authResult = await requireRole(requiredRole)
  
  if (authResult instanceof NextResponse) {
    throw new Error('Authentication failed')
  }
  
  const { user, profile } = authResult
  return await queryFn(user, profile)
}

// Server-side auth state validation
export async function validateAuthState() {
  const session = await getSecureSession()
  
  if (!session) {
    return {
      authenticated: false,
      user: null,
      profile: null,
      error: 'No session found'
    }
  }
  
  if (!VALID_ROLES.includes(session.profile.role)) {
    return {
      authenticated: false,
      user: session.session.user,
      profile: session.profile,
      error: 'Invalid user role'
    }
  }
  
  return {
    authenticated: true,
    user: session.session.user,
    profile: session.profile,
    error: null
  }
}
