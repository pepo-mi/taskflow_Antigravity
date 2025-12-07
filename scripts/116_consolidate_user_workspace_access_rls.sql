-- ============================================================================
-- CONSOLIDATE: user_workspace_access SELECT RLS Policies
-- Combines overlapping SELECT policies into one for better performance
-- ============================================================================

BEGIN;

-- Drop the overlapping policies
DROP POLICY IF EXISTS "Admins can manage user workspace access" ON public.user_workspace_access;
DROP POLICY IF EXISTS "Users can view their own workspace access" ON public.user_workspace_access;

-- Create single consolidated SELECT policy
CREATE POLICY "user_workspace_access_select" ON public.user_workspace_access
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR
    public.is_admin()
  );

-- Create separate policies for INSERT/UPDATE/DELETE (admin only)
CREATE POLICY "user_workspace_access_insert" ON public.user_workspace_access
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "user_workspace_access_update" ON public.user_workspace_access
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "user_workspace_access_delete" ON public.user_workspace_access
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMIT;
