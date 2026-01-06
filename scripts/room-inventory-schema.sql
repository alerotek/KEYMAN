-- Room Inventory & Operations Schema
-- Enforces strict capacity limits and business rules

-- Room Types (Source of Truth)
CREATE TABLE IF NOT EXISTS room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  total_rooms INTEGER NOT NULL CHECK (total_rooms > 0),
  base_price DECIMAL(10,2) NOT NULL CHECK (base_price > 0),
  description TEXT,
  amenities JSONB DEFAULT '{}',
  max_occupancy INTEGER NOT NULL DEFAULT 2,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize official room inventory
INSERT INTO room_types (name, total_rooms, base_price, description, max_occupancy) VALUES
('Single Bed', 17, 3500.00, 'Comfortable single room with one bed', 1),
('Twin Bed', 2, 4500.00, 'Room with two separate beds', 2),
('Studio', 2, 5500.00, 'Studio apartment with kitchenette', 2)
ON CONFLICT (name) DO UPDATE SET
  total_rooms = EXCLUDED.total_rooms,
  base_price = EXCLUDED.base_price,
  description = EXCLUDED.description,
  max_occupancy = EXCLUDED.max_occupancy,
  updated_at = NOW();

-- Physical Rooms (optional but recommended)
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number VARCHAR(10) NOT NULL UNIQUE,
  room_type_id UUID NOT NULL REFERENCES room_types(id),
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'out_of_order')),
  floor INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seasonal Pricing
CREATE TABLE IF NOT EXISTS seasonal_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID NOT NULL REFERENCES room_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  price_override DECIMAL(10,2) NOT NULL CHECK (price_override > 0),
  priority INTEGER NOT NULL DEFAULT 1 CHECK (priority > 0),
  reason TEXT,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_type_id, start_date, end_date)
);

-- Room Blocks (Maintenance/Admin Holds)
CREATE TABLE IF NOT EXISTS room_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID NOT NULL REFERENCES room_types(id),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL, -- Optional specific room
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  reason VARCHAR(100) NOT NULL CHECK (reason IN ('maintenance', 'admin_hold', 'renovation', 'emergency')),
  description TEXT,
  blocked_rooms INTEGER NOT NULL DEFAULT 1 CHECK (blocked_rooms > 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced Bookings Table (add room_type_id if missing)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id);

-- Update existing bookings to have room_type_id based on room relationship
UPDATE bookings b 
SET room_type_id = r.room_type_id
FROM rooms r 
WHERE b.room_id = r.id AND b.room_type_id IS NULL;

-- Overstay & Late Checkout Tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_checkout BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS overstay_detected BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_checkout_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_checkout_fee DECIMAL(10,2) DEFAULT 0.00;

-- Availability Calculation Function
CREATE OR REPLACE FUNCTION calculate_room_availability(
  p_room_type_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  total_rooms INTEGER,
  confirmed_bookings INTEGER,
  blocked_rooms INTEGER,
  overstays INTEGER,
  available_rooms INTEGER,
  available_dates DATE,
  occupancy_rate DECIMAL(5,2)
) AS $$
DECLARE
  v_total_rooms INTEGER;
  v_confirmed_bookings INTEGER;
  v_blocked_rooms INTEGER;
  v_overstays INTEGER;
  v_available_rooms INTEGER;
  v_occupancy_rate DECIMAL(5,2);
BEGIN
  -- Get total rooms for this type
  SELECT rt.total_rooms INTO v_total_rooms
  FROM room_types rt
  WHERE rt.id = p_room_type_id AND rt.active = true;
  
  IF v_total_rooms IS NULL THEN
    RETURN;
  END IF;

  -- Count confirmed bookings for the date range
  SELECT COUNT(DISTINCT b.id) INTO v_confirmed_bookings
  FROM bookings b
  WHERE b.room_type_id = p_room_type_id
    AND b.status IN ('Confirmed', 'Checked-In')
    AND (
      (b.check_in <= p_start_date AND b.check_out > p_start_date) OR
      (b.check_in < p_end_date AND b.check_out >= p_end_date) OR
      (b.check_in >= p_start_date AND b.check_out <= p_end_date)
    );

  -- Count blocked rooms for the date range
  SELECT COALESCE(SUM(rb.blocked_rooms), 0) INTO v_blocked_rooms
  FROM room_blocks rb
  WHERE rb.room_type_id = p_room_type_id
    AND rb.start_date <= p_end_date
    AND rb.end_date >= p_start_date;

  -- Count overstays (people who haven't checked out)
  SELECT COUNT(DISTINCT b.id) INTO v_overstays
  FROM bookings b
  WHERE b.room_type_id = p_room_type_id
    AND b.status = 'Checked-In'
    AND b.check_out < CURRENT_DATE
    AND b.actual_checkout_date IS NULL;

  -- Calculate available rooms
  v_available_rooms := v_total_rooms - v_confirmed_bookings - v_blocked_rooms - v_overstays;
  v_available_rooms := GREATEST(v_available_rooms, 0); -- Never negative

  -- Calculate occupancy rate
  v_occupancy_rate := CASE 
    WHEN v_total_rooms > 0 THEN 
      ROUND(((v_confirmed_bookings + v_overstays)::DECIMAL / v_total_rooms) * 100, 2)
    ELSE 0 
  END;

  -- Return the result
  RETURN QUERY SELECT 
    v_total_rooms,
    v_confirmed_bookings,
    v_blocked_rooms,
    v_overstays,
    v_available_rooms,
    generate_series(p_start_date, p_end_date, '1 day'::interval)::DATE,
    v_occupancy_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Current Room Price (with seasonal overrides)
CREATE OR REPLACE FUNCTION get_room_price(
  p_room_type_id UUID,
  p_check_in DATE,
  p_check_out DATE
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_base_price DECIMAL(10,2);
  v_seasonal_price DECIMAL(10,2);
  v_final_price DECIMAL(10,2);
  v_nights INTEGER;
BEGIN
  -- Get base price
  SELECT rt.base_price INTO v_base_price
  FROM room_types rt
  WHERE rt.id = p_room_type_id AND rt.active = true;
  
  IF v_base_price IS NULL THEN
    RAISE EXCEPTION 'Room type not found or inactive';
  END IF;

  -- Check for seasonal pricing override
  SELECT sp.price_override INTO v_seasonal_price
  FROM seasonal_pricing sp
  WHERE sp.room_type_id = p_room_type_id
    AND sp.active = true
    AND sp.start_date <= p_check_in
    AND sp.end_date >= p_check_out
  ORDER BY sp.priority DESC, sp.start_date ASC
  LIMIT 1;

  -- Use seasonal price if available, otherwise base price
  v_final_price := COALESCE(v_seasonal_price, v_base_price);
  
  RETURN v_final_price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent Overbooking Trigger
CREATE OR REPLACE FUNCTION prevent_overbooking()
RETURNS TRIGGER AS $$
DECLARE
  v_available_rooms INTEGER;
  v_room_type_name VARCHAR(50);
BEGIN
  -- Only check for new bookings or updates that affect room allocation
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (NEW.room_type_id IS DISTINCT FROM OLD.room_type_id OR NEW.check_in IS DISTINCT FROM OLD.check_in OR NEW.check_out IS DISTINCT FROM OLD.check_out)) THEN
    
    -- Calculate availability for the requested dates
    SELECT available_rooms INTO v_available_rooms
    FROM calculate_room_availability(NEW.room_type_id, NEW.check_in::DATE, NEW.check_out::DATE)
    LIMIT 1;

    -- Get room type name for error message
    SELECT rt.name INTO v_room_type_name
    FROM room_types rt
    WHERE rt.id = NEW.room_type_id;

    -- Reject if no rooms available
    IF v_available_rooms <= 0 THEN
      RAISE EXCEPTION 'No rooms available for % from % to %. All rooms are booked or blocked.', 
        v_room_type_name, NEW.check_in::DATE, NEW.check_out::DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the overbooking prevention trigger
DROP TRIGGER IF EXISTS booking_overbooking_prevention ON bookings;
CREATE TRIGGER booking_overbooking_prevention
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION prevent_overbooking();

-- Detect Overstays (run daily)
CREATE OR REPLACE FUNCTION detect_overstays()
RETURNS VOID AS $$
BEGIN
  -- Mark bookings as overstays if they should have checked out
  UPDATE bookings 
  SET overstay_detected = true,
    updated_at = NOW()
  WHERE status = 'Checked-In'
    AND check_out < CURRENT_DATE
    AND actual_checkout_date IS NULL
    AND overstay_detected = false;

  -- Log overstays to audit
  INSERT INTO audit_log (action, details, created_at)
  SELECT 
    'overstay_detected',
    json_build_object(
      'booking_id', b.id,
      'room_type_id', b.room_type_id,
      'guest_name', c.full_name,
      'expected_checkout', b.check_out,
      'days_overstay', CURRENT_DATE - b.check_out,
      'detected_at', NOW()
    ),
    NOW()
  FROM bookings b
  JOIN customers c ON b.customer_id = c.id
  WHERE b.overstay_detected = true
    AND b.check_out < CURRENT_DATE
    AND b.actual_checkout_date IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_room_availability TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_room_availability TO service_role;
GRANT EXECUTE ON FUNCTION get_room_price TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_price TO service_role;
GRANT EXECUTE ON FUNCTION detect_overstays TO service_role;

-- Enable RLS on new tables
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for room_types (read-only for authenticated)
CREATE POLICY "Anyone can view active room types" ON room_types
  FOR SELECT USING (active = true);

-- RLS Policies for rooms (staff and above)
CREATE POLICY "Staff can view rooms" ON rooms
  FOR SELECT USING (auth.jwt()->>'role' IN ('admin', 'manager', 'staff'));

-- RLS Policies for seasonal pricing (admin and manager)
CREATE POLICY "Admin and manager can manage seasonal pricing" ON seasonal_pricing
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'manager'));

-- RLS Policies for room blocks (admin and manager)
CREATE POLICY "Admin and manager can manage room blocks" ON room_blocks
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'manager'));

-- Create indexes for performance
CREATE INDEX idx_bookings_room_type_dates ON bookings(room_type_id, check_in, check_out);
CREATE INDEX idx_seasonal_pricing_dates ON seasonal_pricing(room_type_id, start_date, end_date);
CREATE INDEX idx_room_blocks_dates ON room_blocks(room_type_id, start_date, end_date);
CREATE INDEX idx_room_types_active ON room_types(active);

-- Log schema changes
INSERT INTO audit_log (action, details, created_at)
VALUES (
  'room_inventory_schema_update',
  json_build_object(
    'action', 'Room inventory and operations schema implemented',
    'room_types', ARRAY['Single Bed: 17', 'Twin Bed: 2', 'Studio: 2'],
    'features', ARRAY['seasonal_pricing', 'room_blocks', 'overstay_detection', 'availability_calculation'],
    'timestamp', NOW()
  ),
  NOW()
);
