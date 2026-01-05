import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function requireRole(requiredRole: string) {
  const supabase = createSupabaseServer()
  
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 401 }
    )
  }

  // Check role
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 401 }
    )
  }

  // Role hierarchy
  const roleHierarchy = {
    'guest': 0,
    'customer': 1,
    'staff': 2,
    'manager': 3,
    'admin': 4
  }

  const userLevel = roleHierarchy[profile.role as keyof typeof roleHierarchy] || 0
  const requiredLevel = roleHierarchy[minimumRole as keyof typeof roleHierarchy] || 0

  if (userLevel < requiredLevel) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  // Return user info for use in API routes
  return { user, profile }
}
