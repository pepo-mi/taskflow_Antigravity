-- ============================================================================
-- OPTIMIZE GUEST ACCESS RLS POLICIES
-- Replaces policies from scripts/048_create_guest_workspace_access.sql
-- with optimized versions using (SELECT auth.uid()) subqueries.
-- ============================================================================

BEGIN;

-- 1. Optimize GUEST_WORKSPACE_ACCESS policies
DROP POLICY IF EXISTS "Admins can manage guest workspace access" ON public.guest_workspace_access;
CREATE POLICY "Admins can manage guest workspace access" ON public.guest_workspace_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Guests can view their own workspace access" ON public.guest_workspace_access;
CREATE POLICY "Guests can view their own workspace access" ON public.guest_workspace_access
  FOR SELECT USING ((SELECT auth.uid()) = guest_id);

-- 2. Optimize WORKSPACES policy
DROP POLICY IF EXISTS "Users can view workspaces in their organization" ON public.workspaces;
CREATE POLICY "Users can view workspaces in their organization" ON public.workspaces
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.organization = 'proper.am'
    )
    OR
    -- Guests with explicit workspace access
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      WHERE gwa.guest_id = (SELECT auth.uid()) AND gwa.workspace_id = id
    )
  );

-- 3. Optimize PROJECTS policy
DROP POLICY IF EXISTS "Users can view projects in accessible workspaces" ON public.projects;
CREATE POLICY "Users can view projects in accessible workspaces" ON public.projects
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.organization = 'proper.am'
    )
    OR
    -- Guests with workspace access
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      WHERE gwa.guest_id = (SELECT auth.uid()) AND gwa.workspace_id = workspace_id
    )
  );

-- 4. Optimize TASKS policy
DROP POLICY IF EXISTS "Users can view tasks in accessible projects" ON public.tasks;
CREATE POLICY "Users can view tasks in accessible projects" ON public.tasks
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.organization = 'proper.am'
    )
    OR
    -- Guests with workspace access (via project)
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      JOIN public.projects p ON p.workspace_id = gwa.workspace_id
      WHERE gwa.guest_id = (SELECT auth.uid()) AND p.id = project_id
    )
  );

-- 5. Optimize POSTS policies
DROP POLICY IF EXISTS "Users can view posts in accessible projects" ON public.posts;
CREATE POLICY "Users can view posts in accessible projects" ON public.posts
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.organization = 'proper.am'
    )
    OR
    -- Guests with workspace access (via project)
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      JOIN public.projects p ON p.workspace_id = gwa.workspace_id
      WHERE gwa.guest_id = (SELECT auth.uid()) AND p.id = project_id
    )
  );

DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
CREATE POLICY "Users can create posts" ON public.posts
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = (SELECT auth.uid()) AND u.organization = 'proper.am'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.guest_workspace_access gwa
        JOIN public.projects p ON p.workspace_id = gwa.workspace_id
        WHERE gwa.guest_id = (SELECT auth.uid()) AND p.id = project_id
      )
    ) AND (SELECT auth.uid()) = author_id
  );

-- 6. Optimize FILE_ATTACHMENTS policies
DROP POLICY IF EXISTS "Users can view file attachments" ON public.file_attachments;
CREATE POLICY "Users can view file attachments" ON public.file_attachments
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.organization = 'proper.am'
    )
    OR
    -- Guests with workspace access (via post -> project)
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      JOIN public.projects p ON p.workspace_id = gwa.workspace_id
      JOIN public.posts po ON po.project_id = p.id
      WHERE gwa.guest_id = (SELECT auth.uid()) AND po.id = post_id
    )
  );

DROP POLICY IF EXISTS "Users can upload file attachments" ON public.file_attachments;
CREATE POLICY "Users can upload file attachments" ON public.file_attachments
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = (SELECT auth.uid()) AND u.organization = 'proper.am'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.guest_workspace_access gwa
        JOIN public.projects p ON p.workspace_id = gwa.workspace_id
        JOIN public.posts po ON po.project_id = p.id
        WHERE gwa.guest_id = (SELECT auth.uid()) AND po.id = post_id
      )
    ) AND (SELECT auth.uid()) = uploaded_by
  );

COMMIT;
