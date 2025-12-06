-- ============================================================================
-- FINAL FIX FOR GUEST_USERS SELECT POLICY
-- Strictly follows Supabase performance recommendations by ensuring all
-- function calls (auth.jwt, auth.uid) are wrapped in scalar subqueries.
-- ============================================================================

BEGIN;

-- 1. Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "guest_users_select" ON public.guest_users;

-- 2. Create optimized policy
-- Uses the syntax: column = (SELECT expression)
-- This guarantees the expression is evaluated once per statement.
CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT 
  TO authenticated
  USING (
    (
      -- Match email from JWT (evaluated once)
      email = (SELECT (auth.jwt() ->> 'email')::text)
    )
    OR
    (
      -- Check admin status via helper (evaluated once)
      public.is_admin()
    )
  );

COMMENT ON POLICY "guest_users_select" ON public.guest_users 
IS 'Strictly Optimized: Uses (SELECT ...) for all dynamic values to prevent per-row evaluation.';

COMMIT;
