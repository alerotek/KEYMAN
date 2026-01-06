-- Schema Alignment & Critical Fixes
-- Align all APIs with actual database schema

-- Fix 1: Update audit_log to use performed_by (matches original schema)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES profiles(id);

-- Fix 2: Ensure bookings table has all required columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Fix 3: Update missing columns in payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES profiles(id);

-- Fix 4: Add missing columns to audit_log for new schema
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_role VARCHAR(20);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS before_state JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS after_state JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details JSONB;

-- Fix 5: Create staff table if missing
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix 6: Update profiles table to match expected structure
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Fix 7: Create customers table if missing
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix 8: Update bookings to reference customers instead of profiles directly
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES customers(id);

-- Data migration: Link existing bookings to customers
UPDATE bookings b 
SET guest_id = p.id
FROM profiles p 
WHERE b.guest_id = p.id AND b.guest_id IS NOT NULL;

-- Insert missing staff records from profiles
INSERT INTO staff (user_id, full_name, role, active)
SELECT id, full_name, role, true
FROM profiles p
WHERE p.role IN ('ADMIN', 'MANAGER', 'STAFF') 
AND NOT EXISTS (SELECT 1 FROM staff s WHERE s.user_id = p.id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_type_id ON bookings(room_type_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by);
