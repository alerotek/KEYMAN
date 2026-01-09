import { createSupabaseServer } from './supabase/server'

export async function getUser() {
  const supabase = createSupabaseServer()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

export async function getUserRole(userId: string) {
  const supabase = createSupabaseServer()
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data?.role || 'CUSTOMER'
  } catch (error) {
    console.error('Error getting user role:', error)
    return 'CUSTOMER'
  }
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

export async function requireRole(requiredRole: string) {
  const user = await requireAuth()
  const userRole = await getUserRole(user.id)
  
  const roleHierarchy = {
    'CUSTOMER': 0,
    'STAFF': 1,
    'MANAGER': 2,
    'ADMIN': 3
  }
  
  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0
  
  if (userLevel < requiredLevel) {
    throw new Error(`Insufficient permissions. Required: ${requiredRole}`)
  }
  
  return user
}
