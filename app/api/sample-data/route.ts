import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createSupabaseServer()
    
    // Sample rooms
    const rooms = [
      { room_type: 'SINGLE', max_guests: 1, base_price: 2500, breakfast_price: 500, is_active: true },
      { room_type: 'DOUBLE', max_guests: 2, base_price: 4000, breakfast_price: 800, is_active: true },
      { room_type: 'SUITE', max_guests: 4, base_price: 8000, breakfast_price: 1200, is_active: true },
      { room_type: 'DELUXE', max_guests: 3, base_price: 6000, breakfast_price: 1000, is_active: true }
    ]

    // Insert rooms if they don't exist
    for (const room of rooms) {
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_type', room.room_type)
        .single()
      
      if (!existingRoom) {
        await supabase.from('rooms').insert([room])
        console.log(`Created room: ${room.room_type}`)
      }
    }

    // Sample customers
    const customers = [
      { full_name: 'John Kamau', email: 'john.kamau@example.com' },
      { full_name: 'Mary Wanjiku', email: 'mary.wanjiku@example.com' },
      { full_name: 'David Ochieng', email: 'david.ochieng@example.com' },
      { full_name: 'Grace Achieng', email: 'grace.achieng@example.com' },
      { full_name: 'Peter Muriuki', email: 'peter.muriuki@example.com' }
    ]

    // Insert customers if they don't exist
    const customerIds: Record<string, string> = {}
    for (const customer of customers) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customer.email)
        .single()
      
      if (!existingCustomer) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert([customer])
          .select('id')
          .single()
        if (newCustomer) {
          customerIds[customer.email] = newCustomer.id
          console.log(`Created customer: ${customer.full_name}`)
        }
      } else {
        customerIds[customer.email] = existingCustomer.id
      }
    }

    // Sample staff
    const staff = [
      { full_name: 'Alice Mwangi', email: 'alice.mwangi@keymanhotel.com', role: 'admin' },
      { full_name: 'James Njoroge', email: 'james.njoroge@keymanhotel.com', role: 'manager' },
      { full_name: 'Sarah Kamau', email: 'sarah.kamau@keymanhotel.com', role: 'staff' },
      { full_name: 'Michael Otieno', email: 'michael.otieno@keymanhotel.com', role: 'staff' }
    ]

    // Insert staff if they don't exist
    const staffIds: Record<string, string> = {}
    for (const staffMember of staff) {
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('email', staffMember.email)
        .single()
      
      if (!existingStaff) {
        const { data: newStaff } = await supabase
          .from('staff')
          .insert([staffMember])
          .select('id')
          .single()
        if (newStaff) {
          staffIds[staffMember.email] = newStaff.id
          console.log(`Created staff: ${staffMember.full_name}`)
        }
      } else {
        staffIds[staffMember.email] = existingStaff.id
      }
    }

    // Get room IDs for bookings
    const { data: roomData } = await supabase
      .from('rooms')
      .select('id, room_type')

    const roomMap: Record<string, string> = {}
    roomData?.forEach(room => {
      roomMap[room.room_type] = room.id
    })

    // Sample bookings
    const bookings = [
      {
        room_id: roomMap['DOUBLE'],
        customer_id: customerIds['john.kamau@example.com'],
        staff_id: staffIds['sarah.kamau@keymanhotel.com'],
        check_in: '2026-01-15',
        check_out: '2026-01-17',
        guests_count: 2,
        breakfast: true,
        vehicle: false,
        base_price: 4000,
        extras_price: 1600,
        total_amount: 9600,
        status: 'Confirmed'
      },
      {
        room_id: roomMap['SUITE'],
        customer_id: customerIds['mary.wanjiku@example.com'],
        staff_id: staffIds['michael.otieno@keymanhotel.com'],
        check_in: '2026-01-10',
        check_out: '2026-01-14',
        guests_count: 4,
        breakfast: true,
        vehicle: true,
        base_price: 8000,
        extras_price: 8800,
        total_amount: 40800,
        status: 'Checked-In'
      },
      {
        room_id: roomMap['SINGLE'],
        customer_id: customerIds['david.ochieng@example.com'],
        staff_id: staffIds['sarah.kamau@keymanhotel.com'],
        check_in: '2026-01-08',
        check_out: '2026-01-09',
        guests_count: 1,
        breakfast: false,
        vehicle: false,
        base_price: 2500,
        extras_price: 0,
        total_amount: 2500,
        status: 'Checked-Out'
      },
      {
        room_id: roomMap['DELUXE'],
        customer_id: customerIds['grace.achieng@example.com'],
        staff_id: staffIds['james.njoroge@keymanhotel.com'],
        check_in: '2026-01-20',
        check_out: '2026-01-22',
        guests_count: 3,
        breakfast: true,
        vehicle: false,
        base_price: 6000,
        extras_price: 2000,
        total_amount: 14000,
        status: 'Pending'
      }
    ]

    // Insert bookings
    for (const booking of bookings) {
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('customer_id', booking.customer_id)
        .eq('check_in', booking.check_in)
        .single()
      
      if (!existingBooking) {
        await supabase.from('bookings').insert([booking])
        console.log(`Created booking for: ${booking.check_in}`)
      }
    }

    // Sample payments
    const payments = [
      { booking_id: 1, amount_paid: 9600, method: 'M-Pesa', paid_at: new Date().toISOString() },
      { booking_id: 2, amount_paid: 40800, method: 'Card', paid_at: new Date().toISOString() },
      { booking_id: 3, amount_paid: 2500, method: 'Cash', paid_at: new Date().toISOString() }
    ]

    // Insert payments
    for (const payment of payments) {
      await supabase.from('payments').insert([payment])
      console.log(`Created payment: KES ${payment.amount_paid}`)
    }

    console.log('Sample data population completed successfully!')
    return NextResponse.json({ 
      success: true, 
      message: 'Sample data populated successfully',
      summary: {
        rooms: rooms.length,
        customers: customers.length,
        staff: staff.length,
        bookings: bookings.length,
        payments: payments.length
      }
    })

  } catch (error) {
    console.error('Error populating sample data:', error)
    return NextResponse.json(
      { error: 'Failed to populate sample data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
