-- ============================================================================
-- OPTIMIZE: guest_users RLS Policy
-- Wraps auth.uid() in a subselect to prevent per-row evaluation
-- ============================================================================

BEGIN;

-- Drop the existing policy
DROP POLICY IF EXISTS "guest_users_select" ON public.guest_users;

-- Recreate with optimized pattern using (SELECT auth.uid())
CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR
    public.is_admin()
  );

COMMIT;
