-- ============================================================================
-- Script 036: Eliminate ALL Infinite Recursion from RLS Policies
-- ============================================================================
-- This script completely removes all recursive policy patterns that cause
-- infinite recursion errors. The key principle: NEVER query a table from
-- within its own RLS policy.
-- ============================================================================

-- Drop ALL existing policies on all tables to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============================================================================
-- USERS TABLE POLICIES (NO RECURSION)
-- ============================================================================
-- Key: Never query users table from within users policies

-- SELECT: All authenticated users can read all user profiles
-- This is the standard pattern - user profiles are visible to other users
CREATE POLICY "users_select_all" ON public.users
  FOR SELECT 
  TO authenticated
  USING (true);

-- UPDATE: Users can only update their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT: Handled by auth trigger, but allow for completeness
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- DELETE: Not allowed (handled by auth.users CASCADE)
-- No delete policy needed

-- ============================================================================
-- WORKSPACES TABLE POLICIES
-- ============================================================================

-- SELECT: All authenticated users can view workspaces
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can create workspaces
CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: Creator or users with specific access can update
CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    specific_user_id = auth.uid()
  );

-- DELETE: Only creator can delete
CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- PROJECTS TABLE POLICIES
-- ============================================================================

-- SELECT: All authenticated users can view projects
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can create projects
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: Creator can update
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- DELETE: Creator can delete
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- TASKS TABLE POLICIES
-- ============================================================================

-- SELECT: All authenticated users can view tasks
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can create tasks
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: Creator or assignee can update
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid()
  );

-- DELETE: Creator can delete
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- POSTS TABLE POLICIES
-- ============================================================================

-- SELECT: All authenticated users can view posts
CREATE POLICY "posts_select" ON public.posts
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can create posts
CREATE POLICY "posts_insert" ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- UPDATE: Author can update their own posts
CREATE POLICY "posts_update" ON public.posts
  FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid());

-- DELETE: Author can delete their own posts
CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- ============================================================================
-- FILE_ATTACHMENTS TABLE POLICIES
-- ============================================================================

-- SELECT: All authenticated users can view attachments
CREATE POLICY "file_attachments_select" ON public.file_attachments
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can upload files
CREATE POLICY "file_attachments_insert" ON public.file_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- UPDATE: Uploader can update
CREATE POLICY "file_attachments_update" ON public.file_attachments
  FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- DELETE: Uploader can delete
CREATE POLICY "file_attachments_delete" ON public.file_attachments
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- ============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================================

-- SELECT: Users can only see their own notifications
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: System can create notifications (via service role)
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- DELETE: Users can delete their own notifications
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- GUEST_USERS TABLE POLICIES (if exists)
-- ============================================================================

-- SELECT: All authenticated users can view guest users
CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can create guest users
CREATE POLICY "guest_users_insert" ON public.guest_users
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: Creator can update
CREATE POLICY "guest_users_update" ON public.guest_users
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- DELETE: Creator can delete
CREATE POLICY "guest_users_delete" ON public.guest_users
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_specific_user ON public.workspaces(specific_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_posts_project_id ON public.posts(project_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_post_id ON public.file_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- Update table statistics for query planner
ANALYZE public.users;
ANALYZE public.workspaces;
ANALYZE public.projects;
ANALYZE public.tasks;
ANALYZE public.posts;
ANALYZE public.file_attachments;
ANALYZE public.notifications;
ANALYZE public.guest_users;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List all policies to verify
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
