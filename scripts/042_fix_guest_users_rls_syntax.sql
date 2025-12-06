-- ============================================================================
-- FIX GUEST_USERS_SELECT RLS POLICY SYNTAX
-- ============================================================================
-- The auth.jwt() call must be wrapped correctly: ((SELECT auth.jwt()) ->> 'email')
-- NOT: (SELECT auth.jwt()->>'email')
-- Per Supabase docs: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================================

BEGIN;

-- Drop the incorrectly formatted policy
DROP POLICY IF EXISTS "guest_users_select" ON public.guest_users;

-- Recreate with correct syntax: wrap ONLY the function call, not the entire expression
CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT 
  TO authenticated
  USING (
    -- Correct syntax: ((SELECT auth.jwt()) ->> 'email')
    ((SELECT auth.jwt()) ->> 'email') = email OR
    public.is_admin()
  );

-- Verify the policy was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'guest_users' 
        AND policyname = 'guest_users_select'
    ) THEN
        RAISE NOTICE '✓ guest_users_select policy created with optimized syntax';
        RAISE NOTICE '  Auth function wrapped correctly: ((SELECT auth.jwt()) ->> ''email'')';
    ELSE
        RAISE EXCEPTION 'Failed to create guest_users_select policy';
    END IF;
END $$;

COMMIT;
