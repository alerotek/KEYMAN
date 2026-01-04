-- Keyman Hotel Supabase Schema
-- All roles live in profiles table, never touch auth.users

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (Role Authority)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_number TEXT UNIQUE NOT NULL,
    room_type TEXT NOT NULL CHECK (room_type IN ('SINGLE', 'DOUBLE', 'TWIN')),
    capacity INTEGER NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID REFERENCES profiles(id),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests_count INTEGER NOT NULL,
    breakfast BOOLEAN DEFAULT FALSE,
    vehicle BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'CLOSED')),
    total_amount DECIMAL(10,2) NOT NULL,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table (append-only)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('MPESA', 'CASH')),
    receipt_url TEXT,
    recorded_by UUID REFERENCES profiles(id) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    recorded_by UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID NOT NULL,
    performed_by UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SQL Views for Reporting

-- Daily revenue view
CREATE VIEW daily_revenue AS
SELECT
    DATE(check_in) as date,
    SUM(total_amount) as revenue,
    COUNT(*) as bookings_count
FROM bookings
WHERE status NOT IN ('CANCELLED')
GROUP BY DATE(check_in);

-- Monthly revenue view
CREATE VIEW monthly_revenue AS
SELECT
    EXTRACT(YEAR FROM check_in) as year,
    EXTRACT(MONTH FROM check_in) as month,
    SUM(total_amount) as revenue,
    COUNT(*) as bookings_count
FROM bookings
WHERE status NOT IN ('CANCELLED')
GROUP BY EXTRACT(YEAR FROM check_in), EXTRACT(MONTH FROM check_in);

-- Occupancy rate view
CREATE VIEW occupancy_rate AS
SELECT
    DATE(check_in) as date,
    COUNT(*) as occupied_rooms,
    (SELECT COUNT(*) FROM rooms WHERE is_active = true) as total_rooms,
    ROUND(COUNT(*)::decimal / (SELECT COUNT(*) FROM rooms WHERE is_active = true) * 100, 2) as occupancy_rate
FROM bookings
WHERE status IN ('CONFIRMED', 'CHECKED_IN')
GROUP BY DATE(check_in);

-- Outstanding balances view
CREATE VIEW outstanding_balances AS
SELECT
    b.id,
    b.guest_id,
    b.total_amount,
    COALESCE(SUM(p.amount_paid), 0) as total_paid,
    b.total_amount - COALESCE(SUM(p.amount_paid), 0) as balance
FROM bookings b
LEFT JOIN payments p ON b.id = p.booking_id
WHERE b.status NOT IN ('CANCELLED', 'CLOSED')
GROUP BY b.id, b.guest_id, b.total_amount
HAVING b.total_amount - COALESCE(SUM(p.amount_paid), 0) > 0;

-- Expenses summary view
CREATE VIEW expenses_summary AS
SELECT
    category,
    SUM(amount) as total_amount,
    COUNT(*) as count
FROM expenses
GROUP BY category;

-- RLS Policies

-- Profiles: User can read own profile, ADMIN can manage all
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Rooms: All authenticated users can read active rooms, STAFF+ can manage
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active rooms" ON rooms
    FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Staff can manage rooms" ON rooms
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'STAFF')
        )
    );

-- Bookings: CUSTOMER sees own, STAFF+ see all
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own bookings" ON bookings
    FOR SELECT USING (
        auth.uid() = guest_id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'STAFF')
        )
    );

CREATE POLICY "Staff can manage bookings" ON bookings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'STAFF')
        )
    );

-- Payments: CUSTOMER sees payments for own bookings, STAFF+ see all
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view payments for own bookings" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = payments.booking_id AND b.guest_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'STAFF')
        )
    );

CREATE POLICY "Staff can insert payments" ON payments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'STAFF')
        )
    );

-- Expenses: MANAGER+ can see, ADMIN can manage
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view expenses" ON expenses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
        )
    );

CREATE POLICY "Admins can manage expenses" ON expenses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Audit log: ADMIN only
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log" ON audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "System can insert audit log" ON audit_log
    FOR INSERT WITH CHECK (true);

-- Functions for pricing validation

CREATE OR REPLACE FUNCTION calculate_booking_price(
    p_room_type TEXT,
    p_guests_count INTEGER,
    p_breakfast BOOLEAN,
    p_nights INTEGER
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    base_price DECIMAL(10,2);
    extra_guests INTEGER;
    breakfast_cost DECIMAL(10,2) := 0;
    total DECIMAL(10,2);
BEGIN
    -- Base pricing logic
    CASE p_room_type
        WHEN 'SINGLE' THEN
            base_price := CASE WHEN p_breakfast THEN 1500 ELSE 1200 END;
        WHEN 'DOUBLE' THEN
            base_price := CASE WHEN p_breakfast THEN 1800 ELSE 1500 END;
            extra_guests := GREATEST(p_guests_count - 2, 0);
            base_price := base_price + (extra_guests * 500);
        WHEN 'TWIN' THEN
            base_price := CASE WHEN p_breakfast THEN 2500 ELSE 2000 END;
        ELSE
            RAISE EXCEPTION 'Invalid room type';
    END CASE;

    -- Breakfast addon
    IF p_breakfast THEN
        breakfast_cost := p_guests_count * 300;
    END IF;

    total := (base_price + breakfast_cost) * p_nights;
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Trigger for audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (action, entity, entity_id, performed_by)
    VALUES (
        CASE
            WHEN TG_OP = 'INSERT' THEN 'CREATE'
            WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
            WHEN TG_OP = 'DELETE' THEN 'DELETE'
        END,
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        auth.uid()
    );
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to key tables
CREATE TRIGGER audit_bookings AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
