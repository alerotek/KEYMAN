-- REQUIRED SUPABASE RLS POLICIES (CRITICAL)

-- Rooms RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read rooms"
ON rooms FOR SELECT
USING (is_active = true);

-- Bookings RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access"
ON bookings
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Customers RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access customers"
ON customers
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access profiles"
ON profiles
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
