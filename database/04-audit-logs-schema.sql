-- ========================================
-- 4️⃣ AUDIT LOGS (SYSTEM-WIDE)
-- ========================================

-- Audit logs table (append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL, -- 'booking', 'payment', 'task', 'profile'
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'confirmed', 'paid', 'assigned', 'completed'
  user_id UUID REFERENCES profiles(id), -- nullable for public actions
  old_values JSONB, -- previous state (for updates)
  new_values JSONB, -- new state
  metadata JSONB, -- additional context
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "admins_read_audit_logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- Service role full access (for server operations)
CREATE POLICY "service_role_full_access_audit" ON audit_logs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to log audit events safely
CREATE OR REPLACE FUNCTION log_audit_event(
  p_entity_type VARCHAR(50),
  p_entity_id UUID,
  p_action VARCHAR(50),
  p_user_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_logs (
    entity_type,
    entity_id,
    action,
    user_id,
    old_values,
    new_values,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_action,
    p_user_id,
    p_old_values,
    p_new_values,
    p_metadata,
    p_ip_address,
    p_user_agent
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user IP from request context
-- (This would be called from API routes with actual request data)
CREATE OR REPLACE FUNCTION extract_client_ip(headers JSONB)
RETURNS INET AS $$
BEGIN
  -- Try to extract from common header patterns
  RETURN CASE 
    WHEN headers ? 'x-forwarded-for' THEN 
      (split_part(headers->>'x-forwarded-for', ',', 1))::INET
    WHEN headers ? 'x-real-ip' THEN 
      (headers->>'x-real-ip')::INET
    ELSE NULL::INET
  END;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL::INET;
END;
$$ LANGUAGE plpgsql;

-- Views for common audit queries
CREATE OR REPLACE VIEW booking_audit_trail AS
SELECT 
  al.*,
  b.room_number,
  c.full_name as customer_name,
  c.email as customer_email
FROM audit_logs al
LEFT JOIN bookings b ON al.entity_id = b.id
LEFT JOIN customers c ON b.customer_id = c.id
WHERE al.entity_type = 'booking'
ORDER BY al.created_at DESC;

CREATE OR REPLACE VIEW payment_audit_trail AS
SELECT 
  al.*,
  p.amount,
  p.payment_method,
  p.payment_status,
  b.room_number
FROM audit_logs al
LEFT JOIN payments p ON al.entity_id = p.id
LEFT JOIN bookings b ON p.booking_id = b.id
WHERE al.entity_type = 'payment'
ORDER BY al.created_at DESC;

-- Indexes for performance
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Ensure append-only nature (no direct updates/deletes)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only - modifications not allowed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_modify ON audit_logs;
CREATE TRIGGER audit_logs_no_modify
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
