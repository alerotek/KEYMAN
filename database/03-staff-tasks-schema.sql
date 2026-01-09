-- ========================================
-- 3️⃣ STAFF TASK ASSIGNMENTS
-- ========================================

-- Staff tasks table
CREATE TABLE IF NOT EXISTS staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  task_type VARCHAR(50) NOT NULL, -- 'cleaning', 'check_in_prep', 'maintenance', 'guest_request'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Pending', 'In Progress', 'Done'
  priority VARCHAR(10) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for staff_tasks table
ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;

-- Staff can only see their own assigned tasks
CREATE POLICY "staff_own_tasks" ON staff_tasks
  FOR SELECT USING (
    auth.uid() = assigned_to AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('STAFF', 'MANAGER', 'ADMIN')
    )
  );

-- Managers/Admins can see all tasks
CREATE POLICY "managers_admins_all_tasks" ON staff_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('MANAGER', 'ADMIN')
    )
  );

-- Service role full access (for server operations)
CREATE POLICY "service_role_full_access_tasks" ON staff_tasks
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to create task automatically on booking confirmation
CREATE OR REPLACE FUNCTION create_booking_tasks(booking_id UUID)
RETURNS VOID AS $$
DECLARE
  booking_record RECORD;
  staff_member RECORD;
BEGIN
  -- Get booking details
  SELECT * INTO booking_record 
  FROM bookings 
  WHERE id = booking_id AND status = 'Confirmed';
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Assign cleaning task to available staff
  -- (Simplified: assign to first staff member, in production use rotation logic)
  SELECT id INTO staff_member
  FROM profiles 
  WHERE role = 'STAFF' 
  LIMIT 1;
  
  IF staff_member.id IS NOT NULL THEN
    INSERT INTO staff_tasks (
      booking_id,
      assigned_to,
      task_type,
      title,
      description,
      priority,
      due_date
    ) VALUES (
      booking_id,
      staff_member.id,
      'cleaning',
      'Room Cleaning - ' || TO_CHAR(booking_record.check_in, 'YYYY-MM-DD'),
      'Prepare room ' || (
        SELECT room_number FROM rooms WHERE id = booking_record.room_id
      ) || ' for guest check-in',
      'high',
      booking_record.check_in - INTERVAL '2 hours'
    );
  END IF;
  
  -- Assign check-in preparation task
  INSERT INTO staff_tasks (
    booking_id,
    assigned_to,
    task_type,
    title,
    description,
    priority,
    due_date
  ) VALUES (
    booking_id,
    COALESCE(staff_member.id, (SELECT id FROM profiles WHERE role = 'MANAGER' LIMIT 1)),
    'check_in_prep',
    'Guest Check-in Preparation',
    'Prepare check-in documents and room keys for booking ' || booking_id,
    'medium',
    booking_record.check_in - INTERVAL '1 hour'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX idx_staff_tasks_assigned_to ON staff_tasks(assigned_to);
CREATE INDEX idx_staff_tasks_booking_id ON staff_tasks(booking_id);
CREATE INDEX idx_staff_tasks_status ON staff_tasks(status);
CREATE INDEX idx_staff_tasks_due_date ON staff_tasks(due_date);
