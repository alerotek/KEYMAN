-- ========================================
-- 1️⃣ ROOM AVAILABILITY VIEW (DATABASE LEVEL)
-- ========================================

-- Room Availability View
-- Shows room availability per date range without breaking immutability rules
CREATE OR REPLACE VIEW room_availability AS
SELECT 
  r.id as room_id,
  r.room_number,
  r.room_type,
  r.base_price,
  r.breakfast_price,
  -- Room is available if no active bookings overlap with the date range
  CASE WHEN EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.room_id = r.id 
    AND b.status IN ('Pending', 'Confirmed')
    AND (
      (b.check_in <= CURRENT_DATE AND b.check_out > CURRENT_DATE) OR
      (b.check_in > CURRENT_DATE)
    )
  ) THEN false ELSE true END as is_available,
  -- Next available date (if currently booked)
  CASE WHEN EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.room_id = r.id 
    AND b.status IN ('Pending', 'Confirmed')
    AND b.check_in <= CURRENT_DATE AND b.check_out > CURRENT_DATE
  ) THEN (
    SELECT MIN(b.check_out) 
    FROM bookings b 
    WHERE b.room_id = r.id 
    AND b.status IN ('Pending', 'Confirmed')
    AND b.check_in <= CURRENT_DATE AND b.check_out > CURRENT_DATE
  ) ELSE NULL END as next_available_date
FROM rooms r
WHERE r.is_active = true;

-- RLS Policy for room_availability view
-- Everyone can read availability, but no one can modify the view
DROP POLICY IF EXISTS "room_availability_read_policy" ON room_availability;
CREATE POLICY "room_availability_read_policy" ON room_availability
  FOR SELECT USING (true);

-- Sample query usage:
-- Check availability for specific date range
/*
SELECT * FROM room_availability 
WHERE room_id = 1 
AND is_available = true;

-- Check all available rooms for a specific date
SELECT * FROM room_availability 
WHERE is_available = true 
ORDER BY room_number;
*/
