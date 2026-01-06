-- Secure Master Admin Bootstrap Script
-- Creates master admin user with proper role and permissions
-- Email: kevinalerotek@gmail.com (NON-NEGOTIABLE)

-- First, ensure the auth user exists
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  gen_random_uuid(),
  'kevinalerotek@gmail.com',
  NOW(),
  NOW(),
  NOW(),
  '{"role": "admin", "is_master_admin": true}',
  false
)
ON CONFLICT (email) DO UPDATE SET
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
  raw_user_meta_data = jsonb_set(
    COALESCE(auth.users.raw_user_meta_data, '{}'),
    '{is_master_admin}',
    'true'
  ),
  updated_at = NOW();

-- Create staff record for master admin
INSERT INTO public.staff (
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
)
SELECT 
  u.id,
  u.email,
  'Kevin Alerotek',
  'admin',
  true,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'kevinalerotek@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true,
  updated_at = NOW();

-- Ensure master admin cannot be downgraded
CREATE OR REPLACE FUNCTION prevent_master_admin_downgrade()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent role changes for master admin
  IF OLD.email = 'kevinalerotek@gmail.com' AND NEW.role != 'admin' THEN
    RAISE EXCEPTION 'Cannot change role for master admin';
  END IF;
  
  -- Prevent deactivation of master admin
  IF OLD.email = 'kevinalerotek@gmail.com' AND NEW.is_active = false THEN
    RAISE EXCEPTION 'Cannot deactivate master admin';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger
DROP TRIGGER IF EXISTS master_admin_protection ON public.staff;
CREATE TRIGGER master_admin_protection
BEFORE UPDATE ON public.staff
FOR EACH ROW
EXECUTE FUNCTION prevent_master_admin_downgrade();

-- Create function to verify master admin status
CREATE OR REPLACE FUNCTION is_master_admin(user_email text)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_email = 'kevinalerotek@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_master_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_master_admin TO service_role;

-- Log the bootstrap action
INSERT INTO public.audit_log (
  action,
  details,
  created_at
) VALUES (
  'master_admin_bootstrap',
  json_build_object(
    'email', 'kevinalerotek@gmail.com',
    'role', 'admin',
    'timestamp', NOW(),
    'action', 'Master admin user created/verified'
  ),
  NOW()
) ON CONFLICT DO NOTHING;
