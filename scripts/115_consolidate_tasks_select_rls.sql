-- ============================================================================
-- CONSOLIDATE: tasks SELECT RLS Policies
-- Combines multiple permissive SELECT policies into one for better performance
-- ============================================================================

BEGIN;

-- Drop all existing SELECT policies on tasks
DROP POLICY IF EXISTS "Users can view tasks in accessible projects" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_authenticated" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Proper.am users can view tasks" ON public.tasks;

-- Create single consolidated SELECT policy with optimized auth calls
CREATE POLICY "tasks_select_consolidated" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all tasks
    public.is_admin()
    OR
    -- Regular users: check project access through workspace access
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND (
        -- User is admin
        public.is_admin()
        OR
        -- Guest with explicit workspace access
        EXISTS (
          SELECT 1 FROM public.guest_workspace_access gwa
          WHERE gwa.guest_id = (SELECT auth.uid())
            AND gwa.workspace_id = p.workspace_id
        )
        OR
        -- Regular user with organization access
        (
          EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = (SELECT auth.uid())
              AND u.organization = 'proper.am'
          )
          AND
          (
            -- No workspace restrictions = see all
            NOT EXISTS (
              SELECT 1 FROM public.user_workspace_access uwa
              WHERE uwa.user_id = (SELECT auth.uid())
            )
            OR
            -- Has restrictions = only assigned workspaces
            EXISTS (
              SELECT 1 FROM public.user_workspace_access uwa
              WHERE uwa.user_id = (SELECT auth.uid())
                AND uwa.workspace_id = p.workspace_id
            )
          )
        )
      )
    )
  );

COMMIT;
