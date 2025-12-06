DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the trigger function to ONLY handle regular @proper.am users
-- Guest users are handled by the API to include workspace assignments
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_email TEXT;
  user_role TEXT;
BEGIN
  user_email := NEW.email;
  
  -- Only process @proper.am domain users
  -- Guest users (non-@proper.am) are handled by the API
  IF user_email LIKE '%@proper.am' THEN
    user_role := 'user';
    
    -- Insert into users table for regular domain users
    INSERT INTO public.users (id, email, full_name, role, organization, created_at, updated_at)
    VALUES (
      NEW.id,
      user_email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(user_email, '@', 1)),
      user_role,
      'PROPER Studios',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  -- For guest users, do nothing - the API will handle the insert
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
