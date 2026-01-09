import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/secureAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  t    awaitrequireRole(rust NR)
    constsupabase= supabaseServe()
    
    cnst { data: roms, error: msError } = await supabase
    .fm('roms')
    .select('*')
      .e('i_at', e)

    if(roomsError)troroomsError

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
   .order('created_at',{ascending:false})

    if (bookingsError) hro bookingsError
    return NextResponse.json({     oos: roms  
      oons: oois  
    )
   cah err: ) {
    return NextResponse.json(
      error: err.message }, status err.messge === 'nathoied' ? 1 : err.msag  oridden  0 : 00 }
    )
  }

