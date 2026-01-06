import { createSupabaseServer } from '@/lib/supabase/server'
import { AuditLog } from '@/lib/types'
import AuditLogClient from './client'

export const dynamic = 'force-dynamic'

async function getAuditLogs(): Promise<AuditLog[]> {
  const supabase = createSupabaseServer()
  
  const { data, error } = await supabase
    .from('audit_log')
    .select(`
      id,
        action,
        entity,
        entity_id,
        actor_id,
        actor_role,
        before_state,
        after_state,
        session_id,
        details,
        created_at
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    if (error.code === 'PGRST200') {
      throw new Error('Invalid Supabase relationship used in query')
    }
    console.error('Audit logs fetch error:', error)
    return []
  }

  return data || []
}

export default async function AuditLogPage() {
  const auditLogs = await getAuditLogs()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-2 text-gray-600">
            System activity and audit trail for all operations
          </p>
        </div>

        <AuditLogClient initialLogs={auditLogs} />
      </div>
    </div>
  )
}
