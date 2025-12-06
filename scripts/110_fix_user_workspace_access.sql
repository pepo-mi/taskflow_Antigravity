-- ============================================================================
-- FIX: USER WORKSPACE ACCESS - IDEMPOTENT VERSION
-- This script is safe to run multiple times
-- ============================================================================

BEGIN;

-- 1. Ensure table exists (will not fail if already exists)
CREATE TABLE IF NOT EXISTS public.user_workspace_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

-- 2. Create indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_user_workspace_access_user_id ON public.user_workspace_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspace_access_workspace_id ON public.user_workspace_access(workspace_id);

-- 3. Enable RLS (safe to run multiple times)
ALTER TABLE public.user_workspace_access ENABLE ROW LEVEL SECURITY;

-- 4. DROP existing policies first (makes it idempotent)
DROP POLICY IF EXISTS "Admins can manage user workspace access" ON public.user_workspace_access;
DROP POLICY IF EXISTS "Users can view their own workspace access" ON public.user_workspace_access;

-- 5. Create policies
CREATE POLICY "Admins can manage user workspace access" ON public.user_workspace_access
  FOR ALL 
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can view their own workspace access" ON public.user_workspace_access
  FOR SELECT 
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 6. Update workspace RLS policy
DROP POLICY IF EXISTS "Users can view workspaces in their organization" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select_consolidated" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select_with_restrictions" ON public.workspaces;

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
      WHERE gwa.guest_id = (SELECT auth.uid()) AND gwa.workspace_id = id
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
          WHERE uwa.user_id = (SELECT auth.uid()) AND uwa.workspace_id = id
        )
      )
    )
  );

-- 7. Update projects RLS policy
DROP POLICY IF EXISTS "Users can view projects in accessible workspaces" ON public.projects;
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_select_consolidated" ON public.projects;
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
      WHERE gwa.guest_id = (SELECT auth.uid()) AND gwa.workspace_id = workspace_id
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
          WHERE uwa.user_id = (SELECT auth.uid()) AND uwa.workspace_id = workspace_id
        )
      )
    )
  );

COMMIT;
