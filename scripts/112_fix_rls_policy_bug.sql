-- ============================================================================
-- FIX: CORRECT THE RLS POLICY BUG
-- The previous policy had: uwa.workspace_id = uwa.id (WRONG!)
-- Should be: uwa.workspace_id = workspaces.id
-- ============================================================================

BEGIN;

-- Drop the broken policy
DROP POLICY IF EXISTS "workspaces_select_with_restrictions" ON public.workspaces;

-- Create the CORRECT policy
CREATE POLICY "workspaces_select_with_restrictions" ON public.workspaces
  FOR SELECT 
  TO authenticated
  USING (
    -- Admins see all workspaces
    public.is_admin()
    OR
    -- Guests with explicit workspace access
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      WHERE gwa.guest_id = (SELECT auth.uid()) 
        AND gwa.workspace_id = workspaces.id  -- FIXED: use workspaces.id not gwa.id
    )
    OR
    -- Regular users: check if they have workspace restrictions
    (
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = (SELECT auth.uid()) AND u.organization = 'proper.am'
      )
      AND
      (
        -- If user has NO entries in user_workspace_access, they see ALL workspaces (opt-in)
        NOT EXISTS (
          SELECT 1 FROM public.user_workspace_access uwa
          WHERE uwa.user_id = (SELECT auth.uid())
        )
        OR
        -- If user HAS entries, only show assigned workspaces
        EXISTS (
          SELECT 1 FROM public.user_workspace_access uwa
          WHERE uwa.user_id = (SELECT auth.uid()) 
            AND uwa.workspace_id = workspaces.id  -- FIXED: use workspaces.id not uwa.id
        )
      )
    )
  );

-- Also fix the projects policy with the same bug
DROP POLICY IF EXISTS "projects_select_with_restrictions" ON public.projects;

CREATE POLICY "projects_select_with_restrictions" ON public.projects
  FOR SELECT 
  TO authenticated
  USING (
    -- Admins see all projects
    public.is_admin()
    OR
    -- Guests with workspace access
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      WHERE gwa.guest_id = (SELECT auth.uid()) 
        AND gwa.workspace_id = projects.workspace_id  -- FIXED
    )
    OR
    -- Regular users with opt-in restrictions
    (
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = (SELECT auth.uid()) AND u.organization = 'proper.am'
      )
      AND
      (
        -- No restrictions = see all
        NOT EXISTS (
          SELECT 1 FROM public.user_workspace_access uwa
          WHERE uwa.user_id = (SELECT auth.uid())
        )
        OR
        -- Has restrictions = only assigned workspaces
        EXISTS (
          SELECT 1 FROM public.user_workspace_access uwa
          WHERE uwa.user_id = (SELECT auth.uid()) 
            AND uwa.workspace_id = projects.workspace_id  -- FIXED
        )
      )
    )
  );

COMMIT;
