import { supabaseServer } from '@/lib/supabase/server'

export async function requireRole(
  request: Request,
  allowedRoles: Array<'ADMIN' | 'MANAGER' | 'STAFF'>
) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) throw new Error('Unauthorized')

  const token = authHeader.replace('Bearer ', '')
  const supabase = supabaseServer()

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new Error('Forbidden')
  }

  return data.user
}
