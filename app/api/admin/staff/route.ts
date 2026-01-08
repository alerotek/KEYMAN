import { supabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = supabaseServer()
    
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false })

    if (staffError) {
      console.error('Staff API error:', staffError)
      return NextResponse.json(
        { error: 'Failed to fetch staff', details: staffError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ staff: staff || [] })
  } catch (error) {
    console.error('Staff API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      full_name,
      email,
      role
    } = body

    // Validate required fields
    if (!full_name || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = supabaseServer()

    const { data: newStaff, error: staffError } = await supabase
      .from('staff')
      .insert([{
        full_name,
        email,
        role
      }])
      .select()
      .single()

    if (staffError) {
      console.error('Staff creation error:', staffError)
      return NextResponse.json(
        { error: 'Failed to create staff', details: staffError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'Staff created successfully',
      staff: newStaff 
    })
  } catch (error) {
    console.error('Create staff error:', error)
    return NextResponse.json(
      { error: 'Failed to create staff', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
