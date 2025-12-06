-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT := 'user';
  user_org TEXT := 'proper.am';
BEGIN
  -- Check if user is admin
  IF NEW.email = 'peno@proper.am' THEN
    user_role := 'admin';
  END IF;
  
  -- Check if user is from proper.am domain
  IF NEW.email NOT LIKE '%@proper.am' THEN
    user_role := 'guest';
    user_org := 'external';
  END IF;

  -- Insert user profile
  INSERT INTO public.users (id, email, full_name, role, organization)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    user_role,
    user_org
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
