-- Restore peno@proper.am admin account
-- This script will help identify if the user exists and needs restoration

DO $$
DECLARE
  peno_user_id UUID;
  peno_email TEXT := 'peno@proper.am';
  auth_user_exists BOOLEAN;
BEGIN
  -- Check if user exists in auth.users first
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = peno_email) INTO auth_user_exists;
  
  IF auth_user_exists THEN
    RAISE NOTICE 'User % exists in auth.users', peno_email;
    
    -- Get the auth user ID
    SELECT id INTO peno_user_id FROM auth.users WHERE email = peno_email;
    RAISE NOTICE 'Auth user ID: %', peno_user_id;
    
    -- Check if user exists in public.users table
    IF EXISTS(SELECT 1 FROM public.users WHERE id = peno_user_id) THEN
      RAISE NOTICE 'User % exists in public.users table', peno_email;
      
      -- Update to admin role and ensure proper organization
      UPDATE public.users 
      SET role = 'admin',
          organization = 'proper.am'
      WHERE id = peno_user_id;
      
      RAISE NOTICE 'Updated % to admin role in proper.am organization', peno_email;
    ELSE
      RAISE NOTICE 'User % NOT FOUND in public.users table, creating entry...', peno_email;
      
      -- Insert user into public.users with admin role
      INSERT INTO public.users (id, email, full_name, role, organization)
      VALUES (peno_user_id, peno_email, 'Peno', 'admin', 'proper.am');
      
      RAISE NOTICE 'Created user % in public.users with admin role', peno_email;
    END IF;
  ELSE
    RAISE NOTICE 'User % NOT FOUND in auth.users', peno_email;
    RAISE NOTICE 'The user needs to be recreated through Supabase Auth first';
    RAISE NOTICE 'Steps to restore:';
    RAISE NOTICE '1. Go to Supabase Dashboard > Authentication > Users';
    RAISE NOTICE '2. Click "Add User" and create user with email: %', peno_email;
    RAISE NOTICE '3. After creating, run this script again to grant admin role';
  END IF;
  
END $$;

-- Show all current admins in proper.am organization
SELECT u.id, u.email, u.full_name, u.role, u.organization
FROM public.users u
WHERE u.organization = 'proper.am' AND u.role = 'admin';
