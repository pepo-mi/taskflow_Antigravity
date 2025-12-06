-- Fix foreign key constraint issue for guest users
-- Drop the existing foreign key constraint and recreate the users table structure
-- to allow guest users without auth.users references

-- First, drop the existing foreign key constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Add a new constraint that allows guest users to have any UUID
-- but non-guest users must reference auth.users
ALTER TABLE public.users ADD CONSTRAINT users_id_auth_check 
CHECK (
  (role = 'guest') OR 
  (role != 'guest' AND id IN (SELECT id FROM auth.users))
);

-- Create a function to validate non-guest users have auth records
CREATE OR REPLACE FUNCTION validate_user_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate non-guest users
  IF NEW.role != 'guest' THEN
    -- Check if the user exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
      RAISE EXCEPTION 'Non-guest users must have a corresponding auth.users record';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate user auth on insert/update
DROP TRIGGER IF EXISTS validate_user_auth_trigger ON public.users;
CREATE TRIGGER validate_user_auth_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_auth();

-- Update RLS policies to handle guest users properly
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (
    (auth.uid() = id) OR 
    (role = 'guest' AND EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    ))
  );

-- Allow admins to insert guest users
DROP POLICY IF EXISTS "Admin can create users" ON public.users;
CREATE POLICY "Admin can create users" ON public.users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Allow admins to update any user
DROP POLICY IF EXISTS "Admin can update users" ON public.users;
CREATE POLICY "Admin can update users" ON public.users
  FOR UPDATE USING (
    (auth.uid() = id) OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Allow admins to delete users
DROP POLICY IF EXISTS "Admin can delete users" ON public.users;
CREATE POLICY "Admin can delete users" ON public.users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
