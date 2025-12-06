-- ============================================================================
-- FIX JWT ADMIN CHECKS - Replace with proper subquery pattern
-- ============================================================================
-- The JWT doesn't contain role by default in Supabase, so we need to use
-- a subquery pattern that avoids infinite recursion while still checking admin
-- ============================================================================

BEGIN;

-- Drop all policies that use auth.jwt()->>'role' pattern
DO $$ 
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE 'Dropping policies with JWT role checks...';
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || 
                ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
    RAISE NOTICE 'All existing policies dropped.';
END $$;

-- ============================================================================
-- HELPER FUNCTION: Check if current user is admin (avoids recursion)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
    LIMIT 1
  );
$$;

-- ============================================================================
-- USERS TABLE - Avoid recursion by using simple checks
-- ============================================================================

CREATE POLICY "users_select" ON public.users
  FOR SELECT 
  TO authenticated
  USING (true);  -- All authenticated users can view all profiles

CREATE POLICY "users_insert" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "users_update" ON public.users
  FOR UPDATE 
  TO authenticated
  USING ((SELECT auth.uid()) = id OR public.is_admin());

CREATE POLICY "users_delete" ON public.users
  FOR DELETE 
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- WORKSPACES TABLE
-- ============================================================================

CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT 
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);

CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE 
  TO authenticated
  USING ((SELECT auth.uid()) = created_by OR public.is_admin());

CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE 
  TO authenticated
  USING ((SELECT auth.uid()) = created_by OR public.is_admin());

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT 
  TO authenticated
  USING (
    archived = false OR 
    public.is_admin() OR
    (SELECT auth.uid()) = created_by
  );

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT 
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE 
  TO authenticated
  USING (true);  -- All authenticated users can update projects

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE 
  TO authenticated
  USING (true);  -- All authenticated users can delete projects

-- ============================================================================
-- TASKS TABLE
-- ============================================================================

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT 
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE 
  TO authenticated
  USING (
    (SELECT auth.uid()) = created_by OR 
    (SELECT auth.uid()) = assigned_to OR
    public.is_admin()
  );

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE 
  TO authenticated
  USING ((SELECT auth.uid()) = created_by OR public.is_admin());

-- ============================================================================
-- POSTS TABLE
-- ============================================================================

CREATE POLICY "posts_select" ON public.posts
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "posts_insert" ON public.posts
  FOR INSERT 
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = author_id);

CREATE POLICY "posts_update" ON public.posts
  FOR UPDATE 
  TO authenticated
  USING ((SELECT auth.uid()) = author_id OR public.is_admin());

CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE 
  TO authenticated
  USING ((SELECT auth.uid()) = author_id OR public.is_admin());

-- ============================================================================
-- FILE_ATTACHMENTS TABLE
-- ============================================================================

CREATE POLICY "file_attachments_select" ON public.file_attachments
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "file_attachments_insert" ON public.file_attachments
  FOR INSERT 
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = uploaded_by);

CREATE POLICY "file_attachments_update" ON public.file_attachments
  FOR UPDATE 
  TO authenticated
  USING ((SELECT auth.uid()) = uploaded_by OR public.is_admin());

CREATE POLICY "file_attachments_delete" ON public.file_attachments
  FOR DELETE 
  TO authenticated
  USING ((SELECT auth.uid()) = uploaded_by OR public.is_admin());

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT 
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE 
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE 
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- REACTIONS TABLE
-- ============================================================================

CREATE POLICY "reactions_select" ON public.reactions
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "reactions_insert" ON public.reactions
  FOR INSERT 
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "reactions_update" ON public.reactions
  FOR UPDATE 
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "reactions_delete" ON public.reactions
  FOR DELETE 
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- GUEST_USERS TABLE
-- ============================================================================

CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT 
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'email') = email OR
    public.is_admin()
  );

CREATE POLICY "guest_users_insert" ON public.guest_users
  FOR INSERT 
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "guest_users_update" ON public.guest_users
  FOR UPDATE 
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "guest_users_delete" ON public.guest_users
  FOR DELETE 
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- ARCHIVE_AUDIT_LOG TABLE
-- ============================================================================

CREATE POLICY "archive_audit_log_select" ON public.archive_audit_log
  FOR SELECT 
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "archive_audit_log_insert" ON public.archive_audit_log
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- ENSURE RLS IS ENABLED
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'JWT ADMIN CHECK FIX COMPLETE';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Created % policies using is_admin() function', policy_count;
    RAISE NOTICE 'This avoids JWT role checks and infinite recursion';
    RAISE NOTICE '============================================';
END $$;

COMMIT;
