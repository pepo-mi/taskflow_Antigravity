-- Diagnostic and Fix Script for guest_users_select RLS Policy
-- This script will show the current policy and recreate it with correct syntax

-- First, let's see what the current policy looks like
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'guest_users'
      AND policyname = 'guest_users_select'
  LOOP
    RAISE NOTICE 'Current Policy: %', policy_record.policyname;
    RAISE NOTICE 'Table: %.%', policy_record.schemaname, policy_record.tablename;
    RAISE NOTICE 'Command: %', policy_record.cmd;
    RAISE NOTICE 'Roles: %', policy_record.roles;
    RAISE NOTICE 'USING clause: %', policy_record.qual;
    RAISE NOTICE '---';
  END LOOP;
END $$;

-- Now drop and recreate with the correct optimized syntax
DROP POLICY IF EXISTS "guest_users_select" ON public.guest_users;

-- Create the policy with properly wrapped auth calls
-- The key is: ((SELECT auth.jwt()) ->> 'email') NOT (SELECT auth.jwt()->>'email')
CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT 
  TO authenticated
  USING (
    email = ((SELECT auth.jwt()) ->> 'email')
    OR 
    public.is_admin()
  );

-- Verify the policy was created
DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'guest_users'
      AND policyname = 'guest_users_select'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    RAISE NOTICE 'SUCCESS: guest_users_select policy has been recreated';
  ELSE
    RAISE WARNING 'FAILED: guest_users_select policy was not created';
  END IF;
END $$;

-- Ensure the email column has an index for performance
CREATE INDEX IF NOT EXISTS idx_guest_users_email ON public.guest_users(email);

-- Run ANALYZE to update query planner statistics
ANALYZE public.guest_users;

RAISE NOTICE 'Script completed. Check Supabase linter in 2-3 minutes to verify the warning is resolved.';
