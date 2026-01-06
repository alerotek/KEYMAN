-- DATABASE ALIGNMENT & MIGRATION
-- Align Supabase backend with frontend requirements

-- 1️⃣ Create room_types table with correct room types and counts
CREATE TABLE IF NOT EXISTS room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL CHECK (name IN ('Single', 'Twin', 'Studio')),
    total_rooms INT NOT NULL CHECK (total_rooms > 0),
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
    description TEXT,
    amenities JSONB DEFAULT '[]',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert room types with correct counts
INSERT INTO room_types (name, total_rooms, base_price, capacity, description)
VALUES 
('Single', 17, 50.00, 1, 'Comfortable single room with basic amenities'),
('Twin', 2, 80.00, 2, 'Spacious twin room with two separate beds'),
('Studio', 2, 120.00, 2, 'Modern studio room with kitchenette')
ON CONFLICT (name) DO UPDATE SET
    total_rooms = EXCLUDED.total_rooms,
    base_price = EXCLUDED.base_price,
    capacity = EXCLUDED.capacity,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 2️⃣ Add room_type_id to rooms and bookings tables
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id);

-- 3️⃣ Populate room_type_id from room_types
UPDATE rooms r
SET room_type_id = rt.id
FROM room_types rt
WHERE r.room_type = rt.name AND r.room_type_id IS NULL;

UPDATE bookings b
SET room_type_id = r.room_type_id
FROM rooms r
WHERE b.room_id = r.id AND b.room_type_id IS NULL;

-- 4️⃣ Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_room_type_id ON rooms(room_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_type_id ON bookings(room_type_id);
CREATE INDEX IF NOT EXISTS idx_room_types_active ON room_types(active);
CREATE INDEX IF NOT EXISTS idx_room_types_name ON room_types(name);

-- 5️⃣ Update existing rooms to ensure they have room_type_id
UPDATE rooms r
SET room_type_id = (
    SELECT rt.id FROM room_types rt 
    WHERE rt.name = r.room_type 
    LIMIT 1
)
WHERE r.room_type_id IS NULL AND r.room_type IS NOT NULL;

-- 6️⃣ Create view for room availability
CREATE OR REPLACE VIEW room_availability AS
SELECT 
    rt.id as room_type_id,
    rt.name as room_type_name,
    rt.total_rooms,
    rt.base_price,
    rt.capacity,
    rt.active,
    COUNT(r.id) as available_rooms,
    rt.total_rooms - COUNT(r.id) as booked_rooms,
    ROUND(
        (rt.total_rooms - COUNT(r.id))::DECIMAL / rt.total_rooms * 100, 
        2
    ) as occupancy_rate
FROM room_types rt
LEFT JOIN rooms r ON rt.id = r.room_type_id AND r.is_active = true
GROUP BY rt.id, rt.name, rt.total_rooms, rt.base_price, rt.capacity, rt.active
ORDER BY rt.name;

-- 7️⃣ Create trigger to update room availability
CREATE OR REPLACE FUNCTION update_room_availability()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY room_availability;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    -- View doesn't exist or other error, log it
    INSERT INTO audit_log (action, entity, details, created_at)
    VALUES ('trigger_error', 'room_availability', 
            json_build_object('error', SQLERRM, 'operation', TG_OP), NOW());
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8️⃣ Add triggers for room changes
DROP TRIGGER IF EXISTS trigger_update_room_availability ON rooms;
DROP TRIGGER IF EXISTS trigger_update_room_availability ON bookings;
DROP TRIGGER IF EXISTS trigger_update_room_availability ON room_types;

CREATE TRIGGER trigger_update_room_availability
    AFTER INSERT OR UPDATE OR DELETE ON rooms
    FOR EACH STATEMENT EXECUTE FUNCTION update_room_availability();

CREATE TRIGGER trigger_update_room_availability
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH STATEMENT EXECUTE FUNCTION update_room_availability();

CREATE TRIGGER trigger_update_room_availability
    AFTER UPDATE ON room_types
    FOR EACH STATEMENT EXECUTE FUNCTION update_room_availability();

-- 9️⃣ Create function to get available rooms for booking
CREATE OR REPLACE FUNCTION get_available_rooms(
    p_room_type_name TEXT,
    p_check_in DATE,
    p_check_out DATE
)
RETURNS TABLE (
    room_id UUID,
    room_number TEXT,
    room_type_id UUID,
    room_type_name TEXT,
    base_price DECIMAL(10,2),
    is_available BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id as room_id,
        r.room_number,
        r.room_type_id,
        rt.name as room_type_name,
        rt.base_price,
        NOT EXISTS (
            SELECT 1 FROM bookings b 
            WHERE b.room_id = r.id 
            AND b.status NOT IN ('Cancelled', 'Closed')
            AND (
                (b.check_in <= p_check_in AND b.check_out > p_check_in) OR
                (b.check_in < p_check_out AND b.check_out >= p_check_out) OR
                (b.check_in >= p_check_in AND b.check_out <= p_check_out)
            )
        ) as is_available
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.id
    WHERE rt.name = p_room_type_name
    AND rt.active = true
    AND r.is_active = true
    ORDER BY r.room_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10️⃣ Create function to validate booking capacity
CREATE OR REPLACE FUNCTION validate_booking_capacity(
    p_room_type_id UUID,
    p_guests_count INT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_capacity INT;
BEGIN
    SELECT capacity INTO v_capacity
    FROM room_types
    WHERE id = p_room_type_id AND active = true;
    
    IF v_capacity IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN p_guests_count <= v_capacity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11️⃣ Update booking validation trigger
CREATE OR REPLACE FUNCTION validate_booking_constraints()
RETURNS TRIGGER AS $$
DECLARE
    v_is_valid BOOLEAN;
    v_room_type_name TEXT;
BEGIN
    -- Validate room type exists and is active
    SELECT active INTO v_is_valid
    FROM room_types
    WHERE id = NEW.room_type_id;
    
    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Room type is not active or does not exist';
    END IF;
    
    -- Validate guest capacity
    v_is_valid := validate_booking_capacity(NEW.room_type_id, NEW.guests_count);
    
    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Guest count exceeds room capacity';
    END IF;
    
    -- Get room type name for logging
    SELECT name INTO v_room_type_name
    FROM room_types
    WHERE id = NEW.room_type_id;
    
    -- Log booking validation
    INSERT INTO audit_log (
        action,
        entity,
        entity_id,
        details,
        created_at
    ) VALUES (
        'booking_validated',
        'bookings',
        NEW.id,
        json_build_object(
            'room_type', v_room_type_name,
            'guests_count', NEW.guests_count,
            'check_in', NEW.check_in,
            'check_out', NEW.check_out,
            'validated_at', NOW()
        ),
        NOW()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log validation error
        INSERT INTO audit_log (
            action,
            entity,
            details,
            created_at
        ) VALUES (
            'booking_validation_error',
            'bookings',
            json_build_object(
                'error', SQLERRM,
                'room_type_id', NEW.room_type_id,
                'guests_count', NEW.guests_count
            ),
            NOW()
        );
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12️⃣ Add booking validation trigger
DROP TRIGGER IF EXISTS trigger_validate_booking ON bookings;
CREATE TRIGGER trigger_validate_booking
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION validate_booking_constraints();

-- 13️⃣ Create room inventory summary view
CREATE OR REPLACE VIEW room_inventory_summary AS
SELECT 
    rt.id as room_type_id,
    rt.name as room_type_name,
    rt.total_rooms,
    rt.base_price,
    rt.capacity,
    COUNT(r.id) as total_physical_rooms,
    COUNT(CASE WHEN r.is_active = true THEN 1 END) as active_rooms,
    COUNT(CASE WHEN r.is_active = true AND 
        NOT EXISTS (
            SELECT 1 FROM bookings b 
            WHERE b.room_id = r.id 
            AND b.status NOT IN ('Cancelled', 'Closed')
            AND b.check_in <= CURRENT_DATE 
            AND b.check_out > CURRENT_DATE
        ) THEN 1 END) as available_today,
    COUNT(CASE WHEN r.is_active = true AND 
        EXISTS (
            SELECT 1 FROM bookings b 
            WHERE b.room_id = r.id 
            AND b.status = 'Checked-In'
        ) THEN 1 END) as occupied_today,
    ROUND(
        COUNT(CASE WHEN r.is_active = true AND 
            EXISTS (
                SELECT 1 FROM bookings b 
                WHERE b.room_id = r.id 
                AND b.status = 'Checked-In'
            ) THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN r.is_active = true THEN 1 END), 0) * 100, 
        2
    ) as occupancy_rate_today
FROM room_types rt
LEFT JOIN rooms r ON rt.id = r.room_type_id
WHERE rt.active = true
GROUP BY rt.id, rt.name, rt.total_rooms, rt.base_price, rt.capacity
ORDER BY rt.name;

-- 14️⃣ Grant necessary permissions
GRANT SELECT ON room_types TO authenticated;
GRANT SELECT ON room_availability TO authenticated;
GRANT SELECT ON room_inventory_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_rooms TO authenticated;
GRANT EXECUTE ON FUNCTION validate_booking_capacity TO authenticated;

-- 15️⃣ Log migration completion
INSERT INTO audit_log (
    action,
    entity,
    details,
    created_at
) VALUES (
    'database_migration',
    'room_types_alignment',
    json_build_object(
        'migration', 'room_types_alignment',
        'room_types_created', 3,
        'room_types', ARRAY['Single', 'Twin', 'Studio'],
        'total_rooms', 21,
        'completed_at', NOW()
    ),
    NOW()
);
