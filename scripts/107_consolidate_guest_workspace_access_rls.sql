-- ============================================================================
-- CONSOLIDATE GUEST_WORKSPACE_ACCESS SELECT POLICIES
-- Resolves conflict between:
-- 1. "Admins can manage guest workspace access"
-- 2. "Guests can view their own workspace access"
--
-- This script replaces both with a single "guest_workspace_access_select_consolidated" policy
-- that includes both checks (Admin OR Guest Own Row) in a single optimized expression.
-- ============================================================================

BEGIN;

-- 1. Drop the duplicate policies
DROP POLICY IF EXISTS "Admins can manage guest workspace access" ON public.guest_workspace_access;
DROP POLICY IF EXISTS "Guests can view their own workspace access" ON public.guest_workspace_access;
DROP POLICY IF EXISTS "guest_workspace_access_select_consolidated" ON public.guest_workspace_access; -- Safety drop

-- 2. Create the unified, optimized policy
CREATE POLICY "guest_workspace_access_select_consolidated" ON public.guest_workspace_access
  FOR SELECT 
  TO authenticated
  USING (
    -- Optimize logic: Check Guest Own Row OR Admin status
    -- We use (SELECT auth.uid()) for scalar optimization for guest check
    (guest_id = (SELECT auth.uid()))
    OR
    -- Admin check using our optimized helper function
    public.is_admin()
  );

COMMENT ON POLICY "guest_workspace_access_select_consolidated" ON public.guest_workspace_access 
IS 'Consolidated: Allows select for Guests (own rows) OR Admins. Uses optimized scalar logic.';

COMMIT;
