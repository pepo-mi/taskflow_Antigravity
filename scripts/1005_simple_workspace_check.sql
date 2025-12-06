-- Simple check: Do workspaces exist in the database?
-- This script handles missing columns gracefully

-- Add organization column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workspaces' 
    AND column_name = 'organization'
  ) THEN
    -- Workspaces table doesn't have organization column, that's fine
    NULL;
  END IF;
END $$;

-- 1. Count total workspaces
SELECT 
  'Total workspaces in database:' as info,
  COUNT(*) as count
FROM public.workspaces;

-- 2. Show all workspaces (if any exist)
-- Remove organization column reference since it doesn't exist in workspaces table
SELECT 
  id,
  name,
  created_by,
  created_at
FROM public.workspaces
ORDER BY created_at DESC;

-- 3. Check peno@proper.am user details
-- Handle case where organization column might not exist
SELECT 
  'peno@proper.am user details:' as info,
  id,
  email,
  full_name,
  role
FROM public.users
WHERE email = 'peno@proper.am';

-- 4. Check if peno's auth ID matches their user ID
SELECT 
  'Auth user check:' as info,
  id as auth_id,
  email
FROM auth.users
WHERE email = 'peno@proper.am';

-- 5. If peno exists, ensure they have admin role
UPDATE public.users 
SET role = 'admin'
WHERE email = 'peno@proper.am' AND role != 'admin';
