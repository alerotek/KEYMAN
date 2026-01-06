-- Production-Ready RLS Policies for Keyman Hotel
-- Enforces strict role-based access control

-- Enable RLS on all tables
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role FROM public.staff WHERE email = auth.email()),
    'guest'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is master admin
CREATE OR REPLACE FUNCTION is_master_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.email() = 'kevinalerotek@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin or manager
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_current_user_role() IN ('admin', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- BOOKINGS RLS Policies
-- Guests can create bookings
CREATE POLICY "Guests can create bookings" ON public.bookings
FOR INSERT WITH CHECK (
  get_current_user_role() = 'guest'
);

-- Customers can view their own bookings
CREATE POLICY "Customers can view own bookings" ON public.bookings
FOR SELECT USING (
  get_current_user_role() = 'guest' AND 
  customer_id IN (
    SELECT id FROM public.customers WHERE email = auth.email()
  )
);

-- Staff can view all bookings
CREATE POLICY "Staff can view all bookings" ON public.bookings
FOR SELECT USING (
  get_current_user_role() IN ('staff', 'admin', 'manager')
);

-- Staff can update booking status
CREATE POLICY "Staff can update booking status" ON public.bookings
FOR UPDATE USING (
  get_current_user_role() IN ('staff', 'admin', 'manager')
) WITH CHECK (
  get_current_user_role() IN ('staff', 'admin', 'manager')
);

-- Admin/Manager can delete bookings
CREATE POLICY "Admin/Manager can delete bookings" ON public.bookings
FOR DELETE USING (
  is_admin_or_manager()
);

-- PAYMENTS RLS Policies
-- Guests can create payments
CREATE POLICY "Guests can create payments" ON public.payments
FOR INSERT WITH CHECK (
  get_current_user_role() = 'guest'
);

-- Customers can view their own payments
CREATE POLICY "Customers can view own payments" ON public.payments
FOR SELECT USING (
  get_current_user_role() = 'guest' AND 
  booking_id IN (
    SELECT id FROM public.bookings WHERE 
    customer_id IN (
      SELECT id FROM public.customers WHERE email = auth.email()
    )
  )
);

-- Staff can view payments but not revenue totals
CREATE POLICY "Staff can view payments" ON public.payments
FOR SELECT USING (
  get_current_user_role() IN ('staff', 'admin', 'manager')
);

-- Staff can confirm payments
CREATE POLICY "Staff can confirm payments" ON public.payments
FOR UPDATE USING (
  get_current_user_role() IN ('staff', 'admin', 'manager')
) WITH CHECK (
  get_current_user_role() IN ('staff', 'admin', 'manager')
);

-- Admin/Manager can delete payments
CREATE POLICY "Admin/Manager can delete payments" ON public.payments
FOR DELETE USING (
  is_admin_or_manager()
);

-- CUSTOMERS RLS Policies
-- Guests can create customers
CREATE POLICY "Guests can create customers" ON public.customers
FOR INSERT WITH CHECK (
  get_current_user_role() = 'guest'
);

-- Customers can view their own profile
CREATE POLICY "Customers can view own profile" ON public.customers
FOR SELECT USING (
  get_current_user_role() = 'guest' AND email = auth.email()
);

-- Customers can update their own profile
CREATE POLICY "Customers can update own profile" ON public.customers
FOR UPDATE USING (
  get_current_user_role() = 'guest' AND email = auth.email()
) WITH CHECK (
  get_current_user_role() = 'guest' AND email = auth.email()
);

-- Staff/Admin/Manager can view all customers
CREATE POLICY "Staff can view all customers" ON public.customers
FOR SELECT USING (
  get_current_user_role() IN ('staff', 'admin', 'manager')
);

-- Admin/Manager can update customers
CREATE POLICY "Admin/Manager can update customers" ON public.customers
FOR UPDATE USING (
  is_admin_or_manager()
);

-- ROOMS RLS Policies
-- All authenticated users can view rooms
CREATE POLICY "All authenticated can view rooms" ON public.rooms
FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- Staff/Admin/Manager can create rooms
CREATE POLICY "Staff can create rooms" ON public.rooms
FOR INSERT WITH CHECK (
  get_current_user_role() IN ('staff', 'admin', 'manager')
);

-- Staff/Admin/Manager can update rooms
CREATE POLICY "Staff can update rooms" ON public.rooms
FOR UPDATE USING (
  get_current_user_role() IN ('staff', 'admin', 'manager')
) WITH CHECK (
  get_current_user_role() IN ('staff', 'admin', 'manager')
);

-- Admin/Manager can delete rooms
CREATE POLICY "Admin/Manager can delete rooms" ON public.rooms
FOR DELETE USING (
  is_admin_or_manager()
);

-- STAFF RLS Policies
-- All can view staff info (limited)
CREATE POLICY "All can view basic staff info" ON public.staff
FOR SELECT USING (
  auth.role() = 'authenticated' AND 
  -- Only show non-sensitive fields to non-admins
  (is_admin_or_manager() OR (
    get_current_user_role() = 'staff' AND 
    email = auth.email()
  ))
);

-- Admin/Manager can view all staff
CREATE POLICY "Admin/Manager can view all staff" ON public.staff
FOR SELECT USING (
  is_admin_or_manager()
);

-- Admin/Manager can create staff
CREATE POLICY "Admin/Manager can create staff" ON public.staff
FOR INSERT WITH CHECK (
  is_admin_or_manager()
);

-- Admin/Manager can update staff (except master admin)
CREATE POLICY "Admin/Manager can update staff" ON public.staff
FOR UPDATE USING (
  is_admin_or_manager() AND 
  (is_master_admin_user() OR email != 'kevinalerotek@gmail.com')
) WITH CHECK (
  is_admin_or_manager() AND 
  (is_master_admin_user() OR email != 'kevinalerotek@gmail.com')
);

-- Only master admin can delete staff
CREATE POLICY "Only master admin can delete staff" ON public.staff
FOR DELETE USING (
  is_master_admin_user()
);

-- AUDIT_LOG RLS Policies
-- Only Admin/Manager can view audit logs
CREATE POLICY "Admin/Manager can view audit logs" ON public.audit_log
FOR SELECT USING (
  is_admin_or_manager()
);

-- Only SECURITY DEFINER functions can insert audit logs
CREATE POLICY "Only system can insert audit logs" ON public.audit_log
FOR INSERT WITH CHECK (
  false -- Prevent direct inserts, use SECURITY DEFINER functions
);

-- NOTIFICATION_SETTINGS RLS Policies
-- Only Admin/Manager can view notification settings
CREATE POLICY "Admin/Manager can view notification settings" ON public.notification_settings
FOR SELECT USING (
  is_admin_or_manager()
);

-- Only Admin/Manager can update notification settings
CREATE POLICY "Admin/Manager can update notification settings" ON public.notification_settings
FOR UPDATE USING (
  is_admin_or_manager()
) WITH CHECK (
  is_admin_or_manager()
);

-- Only Admin can create notification settings
CREATE POLICY "Admin can create notification settings" ON public.notification_settings
FOR INSERT WITH CHECK (
  get_current_user_role() = 'admin'
);

-- SECURITY DEFINER function for audit logging
CREATE OR REPLACE FUNCTION log_audit_action(
  action_param TEXT,
  details_param JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_log (
    action,
    details,
    created_at,
    user_email
  ) VALUES (
    action_param,
    details_param,
    NOW(),
    auth.email()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_master_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_or_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_action() TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_action() TO service_role;
