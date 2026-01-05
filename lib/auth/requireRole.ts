import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Role hierarchy for production-grade RBAC
export const ROLE_HIERARCHY = {
  'guest': 0,
  'customer': 1,
  'staff': 2,
  'manager': 3,
  'admin': 4
}

// Valid roles for validation
export const VALID_ROLES = ['guest', 'customer', 'staff', 'manager', 'admin']

export async function requireRole(requiredRole: string) {
  const supabase = createSupabaseServer()
  
  // Validate required role
  if (!VALID_ROLES.includes(requiredRole)) {
    return NextResponse.json(
      { error: 'Invalid role specification' },
      { status: 500 }
    )
  }
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Get user profile with role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 401 }
    )
  }

  // Validate role exists in profile
  if (!profile.role || !VALID_ROLES.includes(profile.role)) {
    return NextResponse.json(
      { error: 'Invalid user role' },
      { status: 401 }
    )
  }

  // Check exact role match
  if (profile.role !== requiredRole) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  // Return user info for use in API routes
  return { user, profile }
}

export async function requireMinimumRole(minimumRole: string) {
  const supabase = createSupabaseServer()
  
  // Validate minimum role
  if (!VALID_ROLES.includes(minimumRole)) {
    return NextResponse.json(
      { error: 'Invalid role specification' },
      { status: 500 }
    )
  }
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Get user profile with role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 401 }
    )
  }

  // Validate role exists in profile
  if (!profile.role || !VALID_ROLES.includes(profile.role)) {
    return NextResponse.json(
      { error: 'Invalid user role' },
      { status: 401 }
    )
  }

  const userLevel = ROLE_HIERARCHY[profile.role as keyof typeof ROLE_HIERARCHY] || 0
  const requiredLevel = ROLE_HIERARCHY[minimumRole as keyof typeof ROLE_HIERARCHY] || 0

  if (userLevel < requiredLevel) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  // Return user info for use in API routes
  return { user, profile }
}

// Helper function to check if user has specific permission
export function hasPermission(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY] || 0
  return userLevel >= requiredLevel
}
