-- ========================================
-- 2️⃣ AUTO-CONFIRM BOOKING ON PAYMENT
-- ========================================

-- Payments table schema
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'card', 'cash', 'bank_transfer'
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  transaction_id VARCHAR(255) UNIQUE, -- External payment processor ID
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Service role full access (for server operations)
CREATE POLICY "service_role_full_access_payments" ON payments
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to auto-confirm booking on successful payment
CREATE OR REPLACE FUNCTION confirm_booking_on_payment(payment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  payment_record RECORD;
  booking_record RECORD;
BEGIN
  -- Get payment details
  SELECT * INTO payment_record 
  FROM payments 
  WHERE id = payment_id AND payment_status = 'completed';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get booking details
  SELECT * INTO booking_record 
  FROM bookings 
  WHERE id = payment_record.booking_id AND status = 'Pending';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update booking status
  UPDATE bookings 
  SET 
    status = 'Confirmed',
    confirmed_at = now(),
    updated_at = now()
  WHERE id = payment_record.booking_id;
  
  -- Log to audit (will be implemented in feature 4)
  -- INSERT INTO audit_logs (entity_type, entity_id, action, user_id) 
  -- VALUES ('booking', payment_record.booking_id, 'confirmed', NULL);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index for performance
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_date ON payments(payment_date);
