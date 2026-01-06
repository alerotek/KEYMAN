import { createServerClient as createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Master Admin Bootstrap Script
// NON-NEGOTIABLE: kevinalerotek@gmail.com must always exist as admin
const MASTER_ADMIN_EMAIL = 'kevinalerotek@gmail.com'

export async function POST() {
  try {
    const supabase = createSupabaseServer()

    // Check if master admin exists in staff table first
    const { data: staffUser, error: staffCheckError } = await supabase
      .from('staff')
      .select('*')
      .eq('email', MASTER_ADMIN_EMAIL)
      .single()

    if (staffCheckError && staffCheckError.code !== 'PGRST116') {
      console.error('Error checking staff user:', staffCheckError)
      return NextResponse.json(
        { error: 'Failed to check master admin' },
        { status: 500 }
      )
    }

    // If staff record doesn't exist, create it
    if (!staffUser) {
      const { data: newStaffUser, error: createStaffError } = await supabase
        .from('staff')
        .insert({
          email: MASTER_ADMIN_EMAIL,
          full_name: 'Kevin Alerotek',
          role: 'admin',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createStaffError) {
        console.error('Error creating staff record:', createStaffError)
        return NextResponse.json(
          { error: 'Failed to create staff record' },
          { status: 500 }
        )
      }

      console.log('✅ Master admin staff record created:', newStaffUser)
    }

    // Update existing staff record to ensure admin role
    if (staffUser) {
      const { data: updatedStaff, error: updateError } = await supabase
        .from('staff')
        .update({
          role: 'admin',
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('email', MASTER_ADMIN_EMAIL)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating staff record:', updateError)
        return NextResponse.json(
          { error: 'Failed to update staff record' },
          { status: 500 }
        )
      }

      console.log('✅ Master admin staff record updated:', updatedStaff)
    }

    // Log bootstrap action
    await supabase
      .from('audit_log')
      .insert([{
        action: 'master_admin_bootstrap',
        details: {
          email: MASTER_ADMIN_EMAIL,
          role: 'admin',
          timestamp: new Date().toISOString(),
          action: !staffUser ? 'Master admin created' : 'Master admin verified'
        },
        created_at: new Date().toISOString()
      }])

    return NextResponse.json({
      success: true,
      message: 'Master admin bootstrap completed',
      details: {
        email: MASTER_ADMIN_EMAIL,
        role: 'admin',
        status: !staffUser ? 'created' : 'verified',
        action: !staffUser ? 'Staff record created' : 'Staff record updated'
      }
    })

  } catch (error) {
    console.error('Master admin bootstrap error:', error)
    return NextResponse.json(
      { error: 'Master admin bootstrap failed' },
      { status: 500 }
    )
  }
}

// GET endpoint to check master admin status
export async function GET() {
  try {
    const supabase = createSupabaseServer()

    // Check staff record
    const { data: staffUser, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('email', MASTER_ADMIN_EMAIL)
      .single()

    return NextResponse.json({
      master_admin: {
        email: MASTER_ADMIN_EMAIL,
        exists_in_staff: !!staffUser,
        role: staffUser?.role || 'not_found',
        is_active: staffUser?.is_active || false,
        last_verified: new Date().toISOString(),
        note: 'Auth user verification requires Supabase dashboard access'
      }
    })

  } catch (error) {
    console.error('Master admin status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check master admin status' },
      { status: 500 }
    )
  }
}
