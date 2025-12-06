-- ============================================================================
-- OPTIMIZE GUEST_USERS RLS POLICY
-- Wraps auth.jwt() calls in scalar subqueries to prevent per-row evaluation.
-- Fixes warning: "The RLS policy guest_users_select... calls current_setting()..."
-- ============================================================================

BEGIN;

-- Drop the potentially unoptimized policy
DROP POLICY IF EXISTS "guest_users_select" ON public.guest_users;

-- Recreate it with guaranteed scalar execution for auth.jwt()
CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT 
  TO authenticated
  USING (
    -- Wrap auth.jwt() access in a scalar subquery cast to text
    ((SELECT auth.jwt() ->> 'email')::text = email)
    OR
    public.is_admin()
  );

COMMENT ON POLICY "guest_users_select" ON public.guest_users IS 'Optimized: Uses (SELECT auth.jwt()) to prevent per-row evaluation';

COMMIT;
