-- Fix the handle_new_user trigger to properly route guest users to guest_users table
-- This prevents duplicate entries when admins create guest users

-- Drop the old trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update the trigger function to route users to the correct table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT := 'user';
  user_org TEXT := 'proper.am';
  is_guest BOOLEAN := FALSE;
BEGIN
  -- Check if user is admin
  IF NEW.email = 'peno@proper.am' THEN
    user_role := 'admin';
  END IF;
  
  -- Check if user is from proper.am domain
  IF NEW.email NOT LIKE '%@proper.am' THEN
    user_role := 'guest';
    user_org := 'external';
    is_guest := TRUE;
  END IF;

  -- Route users to correct table based on domain
  IF is_guest THEN
    -- Insert guest users into guest_users table
    INSERT INTO public.guest_users (id, email, full_name, role, organization)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
      user_role,
      user_org
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- Insert regular users into users table
    INSERT INTO public.users (id, email, full_name, role, organization)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
      user_role,
      user_org
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Clean up any existing duplicate entries
-- Keep the guest_users entry and remove from users table for non-@proper.am emails
DELETE FROM public.users
WHERE email NOT LIKE '%@proper.am'
  AND id IN (SELECT id FROM public.guest_users);

-- Verify the fix
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM public.users u
  INNER JOIN public.guest_users g ON u.id = g.id;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING 'Still found % duplicate user(s) after cleanup', duplicate_count;
  ELSE
    RAISE NOTICE '✓ No duplicate users found - trigger fix successful';
  END IF;
END $$;
