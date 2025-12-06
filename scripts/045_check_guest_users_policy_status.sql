-- Diagnostic script to check the current state of guest_users_select policy
-- This will help us understand if the fix was applied correctly

-- Check if the policy exists and show its definition
DO $$
DECLARE
  policy_def TEXT;
  policy_count INTEGER;
BEGIN
  -- Count policies on guest_users
  SELECT COUNT(*) INTO policy_count
  FROM pg_policy pol
  JOIN pg_class c ON pol.polrelid = c.oid
  WHERE c.relname = 'guest_users';
  
  RAISE NOTICE 'Number of policies on guest_users: %', policy_count;
  
  -- Get the guest_users_select policy definition
  SELECT pg_get_policydef(pol.oid) INTO policy_def
  FROM pg_policy pol
  JOIN pg_class c ON pol.polrelid = c.oid
  WHERE c.relname = 'guest_users' AND pol.polname = 'guest_users_select';
  
  IF policy_def IS NOT NULL THEN
    RAISE NOTICE 'Current guest_users_select policy definition:';
    RAISE NOTICE '%', policy_def;
  ELSE
    RAISE NOTICE 'Policy guest_users_select does NOT exist!';
  END IF;
END $$;

-- Show table columns
SELECT 'Table columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'guest_users'
ORDER BY ordinal_position;

-- Show indexes
SELECT 'Indexes on guest_users:' as info;
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'guest_users';
