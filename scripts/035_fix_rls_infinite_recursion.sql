-- ============================================================================
-- FIX RLS INFINITE RECURSION
-- ============================================================================
-- The previous script caused infinite recursion because policies checked
-- admin role by querying the users table, which triggered the same policy.
-- This script fixes it by checking the JWT token instead.
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
DROP POLICY IF EXISTS "file_attachments_update" ON public.file_attachments;
DROP POLICY IF EXISTS "file_attachments_delete" ON public.file_attachments;
DROP POLICY IF EXISTS "guest_users_select" ON public.guest_users;
DROP POLICY IF EXISTS "guest_users_insert" ON public.guest_users;
DROP POLICY IF EXISTS "guest_users_update" ON public.guest_users;
DROP POLICY IF EXISTS "guest_users_delete" ON public.guest_users;
DROP POLICY IF EXISTS "archive_audit_log_select" ON public.archive_audit_log;

-- ============================================================================
-- USERS TABLE - Fixed to avoid recursion
-- ============================================================================

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (
    -- Users can view their own profile
    (SELECT auth.uid()) = id OR
    -- Admin can view all users (check JWT, not users table)
    (SELECT auth.jwt()->>'role') = 'admin'
  );

CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (
    -- Users can update their own profile or admin can update any
    (SELECT auth.uid()) = id OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (
    -- Only admin can delete users
    (SELECT auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- WORKSPACES TABLE - Fixed to avoid recursion
-- ============================================================================

CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE USING (
    -- Creator or admin can update
    (SELECT auth.uid()) = created_by OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE USING (
    -- Creator or admin can delete
    (SELECT auth.uid()) = created_by OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- PROJECTS TABLE - Fixed to avoid recursion
-- ============================================================================

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (
    -- Authenticated users can view non-archived projects, admin can view all
    (SELECT auth.uid()) IS NOT NULL AND (
      archived = false OR 
      (SELECT auth.jwt()->>'role') = 'admin'
    )
  );

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    -- Creator or admin can update
    (SELECT auth.uid()) = created_by OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- TASKS TABLE - Fixed to avoid recursion
-- ============================================================================

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (
    -- Creator, assignee, or admin can update
    (SELECT auth.uid()) = created_by OR 
    (SELECT auth.uid()) = assigned_to OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (
    -- Creator or admin can delete
    (SELECT auth.uid()) = created_by OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- POSTS TABLE - Fixed to avoid recursion
-- ============================================================================

CREATE POLICY "posts_update" ON public.posts
  FOR UPDATE USING (
    -- Author or admin can update
    (SELECT auth.uid()) = author_id OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE USING (
    -- Author or admin can delete
    (SELECT auth.uid()) = author_id OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- FILE_ATTACHMENTS TABLE - Fixed to avoid recursion
-- ============================================================================

CREATE POLICY "file_attachments_update" ON public.file_attachments
  FOR UPDATE USING (
    -- Uploader or admin can update
    (SELECT auth.uid()) = uploaded_by OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

CREATE POLICY "file_attachments_delete" ON public.file_attachments
  FOR DELETE USING (
    -- Uploader or admin can delete
    (SELECT auth.uid()) = uploaded_by OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- GUEST_USERS TABLE - Fixed to avoid recursion
-- ============================================================================

CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT USING (
    -- Guest can view their own profile or admin can view all
    (SELECT auth.jwt()->>'email') = email OR
    (SELECT auth.jwt()->>'role') = 'admin'
  );

CREATE POLICY "guest_users_insert" ON public.guest_users
  FOR INSERT WITH CHECK (
    -- Only admin can create guest users
    (SELECT auth.jwt()->>'role') = 'admin'
  );

CREATE POLICY "guest_users_update" ON public.guest_users
  FOR UPDATE USING (
    -- Only admin can update guest users
    (SELECT auth.jwt()->>'role') = 'admin'
  );

CREATE POLICY "guest_users_delete" ON public.guest_users
  FOR DELETE USING (
    -- Only admin can delete guest users
    (SELECT auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- ARCHIVE_AUDIT_LOG TABLE - Fixed to avoid recursion
-- ============================================================================

CREATE POLICY "archive_audit_log_select" ON public.archive_audit_log
  FOR SELECT USING (
    -- Only admin can view audit logs
    (SELECT auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'RLS INFINITE RECURSION FIX COMPLETE';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Fixed all policies to check admin role from JWT';
    RAISE NOTICE 'instead of querying users table.';
    RAISE NOTICE '';
    RAISE NOTICE 'This eliminates the circular dependency that';
    RAISE NOTICE 'caused infinite recursion errors.';
    RAISE NOTICE '============================================';
END $$;
