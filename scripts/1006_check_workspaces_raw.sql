-- Simple check to see if workspaces exist in the database
-- This bypasses RLS to see the raw data

-- Count total workspaces
SELECT 
  'Total workspaces in database:' as info,
  COUNT(*) as count
FROM public.workspaces;

-- Show all workspaces (if any exist)
SELECT 
  id,
  name,
  created_at,
  created_by
FROM public.workspaces
ORDER BY created_at DESC;

-- Count total users
SELECT 
  'Total users in database:' as info,
  COUNT(*) as count
FROM public.users;

-- Show all users with their roles
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- Check if peno@proper.am exists
SELECT 
  'Peno account status:' as info,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.users WHERE email = 'peno@proper.am') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as status;
