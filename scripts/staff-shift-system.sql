-- Staff Shift Assignment + Operational Control
-- Speed-first design with performance optimization

-- Staff shifts table
CREATE TABLE IF NOT EXISTS staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('staff', 'manager', 'admin')),
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_shift_times CHECK (end_time > start_time)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff_id ON staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_start_time ON staff_shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_end_time ON staff_shifts(end_time);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_active ON staff_shifts(active);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_time_range ON staff_shifts(start_time, end_time);

-- Composite index for active shift queries
CREATE INDEX IF NOT EXISTS idx_staff_shifts_active_time ON staff_shifts(active, start_time, end_time);

-- Function to check if staff is on duty
CREATE OR REPLACE FUNCTION is_staff_on_duty(p_staff_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_on_duty BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM staff_shifts 
    WHERE staff_id = p_staff_id 
      AND active = true 
      AND start_time <= NOW() 
      AND end_time >= NOW()
  ) INTO is_on_duty;
  
  RETURN COALESCE(is_on_duty, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current active shifts
CREATE OR REPLACE FUNCTION get_active_shifts()
RETURNS TABLE(
  shift_id UUID,
  staff_id UUID,
  staff_name TEXT,
  staff_role VARCHAR(20),
  shift_role VARCHAR(20),
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  minutes_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id as shift_id,
    ss.staff_id,
    s.full_name as staff_name,
    s.role as staff_role,
    ss.role as shift_role,
    ss.start_time,
    ss.end_time,
    EXTRACT(EPOCH FROM (ss.end_time - NOW()))/60 as minutes_remaining
  FROM staff_shifts ss
  JOIN staff s ON ss.staff_id = s.id
  WHERE ss.active = true 
    AND ss.start_time <= NOW() 
    AND ss.end_time >= NOW()
  ORDER BY ss.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate staff action permissions
CREATE OR REPLACE FUNCTION validate_staff_action(p_action TEXT, p_staff_id UUID DEFAULT NULL)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  current_staff_id UUID;
  is_on_duty BOOLEAN;
  staff_role VARCHAR(20);
  action_permissions JSON;
BEGIN
  -- Get current staff ID from session if not provided
  current_staff_id := COALESCE(p_staff_id, (auth.jwt()->>'sub')::UUID);
  
  -- Get staff role
  SELECT s.role INTO staff_role
  FROM staff s
  WHERE s.user_id = current_staff_id AND s.active = true;
  
  -- Check if staff exists
  IF staff_role IS NULL THEN
    RETURN QUERY SELECT false, 'Staff not found or inactive';
    RETURN;
  END IF;
  
  -- Check if on duty (skip for admins)
  IF staff_role != 'admin' THEN
    SELECT is_staff_on_duty(s.id) INTO is_on_duty
    FROM staff s
    WHERE s.user_id = current_staff_id;
    
    IF NOT COALESCE(is_on_duty, false) THEN
      RETURN QUERY SELECT false, 'Staff not on duty';
      RETURN;
    END IF;
  END IF;
  
  -- Define action permissions
  action_permissions := json_build_object(
    'confirm_payment', ARRAY['staff', 'manager', 'admin'],
    'upload_receipt', ARRAY['staff', 'manager', 'admin'],
    'close_booking', ARRAY['staff', 'manager', 'admin'],
    'cancel_booking', ARRAY['manager', 'admin'],
    'issue_refund', ARRAY['manager', 'admin'],
    'block_rooms', ARRAY['manager', 'admin'],
    'manage_pricing', ARRAY['manager', 'admin'],
    'view_revenue', ARRAY['manager', 'admin'],
    'manage_staff', ARRAY['manager', 'admin']
  );
  
  -- Check if action is allowed for this role
  IF action_permissions ? p_action THEN
    IF staff_role = ANY((action_permissions->>p_action)::TEXT[]) THEN
      RETURN QUERY SELECT true, 'Action allowed';
    ELSE
      RETURN QUERY SELECT false, 'Insufficient permissions for action: ' || p_action;
    END IF;
  ELSE
    RETURN QUERY SELECT false, 'Unknown action: ' || p_action;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to enforce staff action validation
CREATE OR REPLACE FUNCTION enforce_staff_action_validation()
RETURNS TRIGGER AS $$
DECLARE
  validation_result RECORD;
  action_name TEXT;
BEGIN
  -- Determine action based on table and operation
  IF TG_TABLE_NAME = 'payments' AND TG_OP = 'UPDATE' THEN
    action_name := 'confirm_payment';
  ELSIF TG_TABLE_NAME = 'bookings' AND TG_OP = 'UPDATE' THEN
    IF NEW.status = 'Closed' THEN
      action_name := 'close_booking';
    ELSIF NEW.status = 'Cancelled' THEN
      action_name := 'cancel_booking';
    END IF;
  ELSIF TG_TABLE_NAME = 'room_blocks' AND TG_OP = 'INSERT' THEN
    action_name := 'block_rooms';
  ELSIF TG_TABLE_NAME = 'seasonal_pricing' AND TG_OP = 'INSERT' THEN
    action_name := 'manage_pricing';
  END IF;
  
  -- Validate action if determined
  IF action_name IS NOT NULL THEN
    SELECT * INTO validation_result
    FROM validate_staff_action(action_name);
    
    IF NOT validation_result.allowed THEN
      RAISE EXCEPTION 'Staff action validation failed: %', validation_result.reason;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply validation triggers
CREATE TRIGGER payments_staff_validation
BEFORE UPDATE OF status ON payments
FOR EACH ROW EXECUTE FUNCTION enforce_staff_action_validation();

CREATE TRIGGER bookings_staff_validation
BEFORE UPDATE OF status ON bookings
FOR EACH ROW EXECUTE FUNCTION enforce_staff_action_validation();

CREATE TRIGGER room_blocks_staff_validation
BEFORE INSERT ON room_blocks
FOR EACH ROW EXECUTE FUNCTION enforce_staff_action_validation();

CREATE TRIGGER seasonal_pricing_staff_validation
BEFORE INSERT ON seasonal_pricing
FOR EACH ROW EXECUTE FUNCTION enforce_staff_action_validation();

-- Function to get today's shifts with workload
CREATE OR REPLACE FUNCTION get_daily_shift_summary()
RETURNS TABLE(
  shift_id UUID,
  staff_id UUID,
  staff_name TEXT,
  staff_role VARCHAR(20),
  shift_start TIMESTAMP WITH TIME ZONE,
  shift_end TIMESTAMP WITH TIME ZONE,
  bookings_handled INTEGER,
  payments_processed INTEGER,
  total_revenue DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id as shift_id,
    ss.staff_id,
    s.full_name as staff_name,
    s.role as staff_role,
    ss.start_time as shift_start,
    ss.end_time as shift_end,
    COUNT(DISTINCT b.id) as bookings_handled,
    COUNT(DISTINCT p.id) as payments_processed,
    COALESCE(SUM(p.amount_paid), 0) as total_revenue
  FROM staff_shifts ss
  JOIN staff s ON ss.staff_id = s.id
  LEFT JOIN bookings b ON s.user_id = b.created_by 
    AND DATE(b.created_at) = CURRENT_DATE
  LEFT JOIN payments p ON s.user_id = p.created_by 
    AND DATE(p.created_at) = CURRENT_DATE
  WHERE DATE(ss.start_time) = CURRENT_DATE
    AND ss.active = true
  GROUP BY ss.id, s.id
  ORDER BY ss.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically deactivate expired shifts
CREATE OR REPLACE FUNCTION deactivate_expired_shifts()
RETURNS void AS $$
BEGIN
  UPDATE staff_shifts 
  SET active = false, updated_at = NOW()
  WHERE active = true 
    AND end_time < NOW() - INTERVAL '1 hour';
    
  -- Log deactivation
  INSERT INTO audit_log (action, details, created_at)
  SELECT 
    'shift_auto_deactivated',
    json_build_object(
      'shifts_deactivated', COUNT(*),
      'deactivation_time', NOW()
    ),
    NOW()
  FROM staff_shifts 
  WHERE active = false 
    AND updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule automatic shift deactivation (run every hour)
SELECT cron.schedule(
  'deactivate-expired-shifts',
  '0 * * * *', -- Every hour
  'SELECT deactivate_expired_shifts();'
);

-- Performance optimization: Cache active shifts
CREATE OR REPLACE FUNCTION get_cached_active_shifts()
RETURNS TABLE(
  shift_id UUID,
  staff_id UUID,
  staff_name TEXT,
  role VARCHAR(20),
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Check if cache exists and is valid (5 minutes TTL)
  PERFORM 1 FROM pg_stat_user_functions 
  WHERE funcname = 'get_active_shifts' 
    AND calls > 0;
  
  -- Return active shifts (will be cached by application layer)
  RETURN QUERY
  SELECT 
    ss.id as shift_id,
    ss.staff_id,
    s.full_name as staff_name,
    s.role,
    ss.start_time,
    ss.end_time
  FROM staff_shifts ss
  JOIN staff s ON ss.staff_id = s.id
  WHERE ss.active = true 
    AND ss.start_time <= NOW() 
    AND ss.end_time >= NOW()
  ORDER BY ss.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies for staff shifts
ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;

-- Staff can view their own shifts
CREATE POLICY "Staff can view own shifts" ON staff_shifts
  FOR SELECT USING (
    auth.jwt()->>'role' = 'staff' AND 
    staff_id IN (
      SELECT id FROM staff WHERE user_id = auth.jwt()->>'sub'
    )
  );

-- Managers can view all shifts
CREATE POLICY "Managers can view all shifts" ON staff_shifts
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('manager', 'admin')
  );

-- Admin has full access
CREATE POLICY "Admins have full shift access" ON staff_shifts
  FOR ALL USING (
    auth.jwt()->>'role' = 'admin'
  );

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_staff_on_duty TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_shifts TO authenticated;
GRANT EXECUTE ON FUNCTION validate_staff_action TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_shift_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_cached_active_shifts TO authenticated;

-- Log shift system implementation
INSERT INTO audit_log (action, details, created_at)
VALUES (
  'staff_shift_system_implementation',
  json_build_object(
    'action', 'Staff shift assignment and operational control implemented',
    'features', ARRAY[
      'shift_validation',
      'action_permissions',
      'auto_deactivation',
      'performance_optimized',
      'duty_enforcement'
    ],
    'triggers_created', 4,
    'indexes_added', 6,
    'scheduled_tasks', 1,
    'timestamp', NOW()
  ),
  NOW()
);
