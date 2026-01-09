import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createSupabaseServer()

  const { error } = await supabase.from('rooms').select('id').limit(1)

  if (error) {
    return NextResponse.json({ status: 'unhealthy' }, { status: 500 })
  }

  return NextResponse.json({ status: 'ok' })
}
