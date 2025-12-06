-- Optimize RLS policies for performance by wrapping auth functions in SELECT subqueries
-- This prevents per-row evaluation and improves query performance on large tables

-- Drop all existing policies that use direct auth function calls
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on all tables to recreate with optimized versions
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- USERS TABLE - Optimized policies with SELECT-wrapped auth functions
CREATE POLICY "users_select_own_profile" ON public.users
  FOR SELECT USING ((SELECT auth.uid()) = id);

CREATE POLICY "users_update_own_profile" ON public.users
  FOR UPDATE USING ((SELECT auth.uid()) = id);

CREATE POLICY "users_select_organization_members" ON public.users
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      (SELECT auth.uid()) = id OR
      organization = 'proper.am'
    )
  );

CREATE POLICY "admin_manage_all_users" ON public.users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

-- WORKSPACES TABLE - Optimized policies
CREATE POLICY "workspaces_select_authenticated" ON public.workspaces
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "workspaces_insert_authenticated" ON public.workspaces
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND 
    (SELECT auth.uid()) = created_by
  );

CREATE POLICY "workspaces_update_creator_or_admin" ON public.workspaces
  FOR UPDATE USING (
    (SELECT auth.uid()) = created_by OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

CREATE POLICY "admin_manage_all_workspaces" ON public.workspaces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

-- PROJECTS TABLE - Optimized policies with archived project handling
CREATE POLICY "projects_select_non_archived_or_admin" ON public.projects
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      archived = false OR 
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
      )
    )
  );

CREATE POLICY "projects_insert_authenticated" ON public.projects
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND 
    (SELECT auth.uid()) = created_by
  );

CREATE POLICY "projects_update_creator_or_admin" ON public.projects
  FOR UPDATE USING (
    (SELECT auth.uid()) = created_by OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

CREATE POLICY "projects_delete_creator_or_admin" ON public.projects
  FOR DELETE USING (
    (SELECT auth.uid()) = created_by OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

-- TASKS TABLE - Optimized policies
CREATE POLICY "tasks_select_authenticated" ON public.tasks
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "tasks_insert_authenticated" ON public.tasks
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND 
    (SELECT auth.uid()) = created_by
  );

CREATE POLICY "tasks_update_creator_assignee_or_admin" ON public.tasks
  FOR UPDATE USING (
    (SELECT auth.uid()) = created_by OR 
    (SELECT auth.uid()) = assigned_to OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

CREATE POLICY "tasks_delete_creator_or_admin" ON public.tasks
  FOR DELETE USING (
    (SELECT auth.uid()) = created_by OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

-- POSTS TABLE - Optimized policies
CREATE POLICY "posts_select_authenticated" ON public.posts
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "posts_insert_authenticated" ON public.posts
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND 
    (SELECT auth.uid()) = author_id
  );

CREATE POLICY "posts_update_author_or_admin" ON public.posts
  FOR UPDATE USING (
    (SELECT auth.uid()) = author_id OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

CREATE POLICY "posts_delete_author_or_admin" ON public.posts
  FOR DELETE USING (
    (SELECT auth.uid()) = author_id OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

-- FILE_ATTACHMENTS TABLE - Optimized policies
CREATE POLICY "file_attachments_select_authenticated" ON public.file_attachments
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "file_attachments_insert_authenticated" ON public.file_attachments
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND 
    (SELECT auth.uid()) = uploaded_by
  );

CREATE POLICY "file_attachments_update_uploader_or_admin" ON public.file_attachments
  FOR UPDATE USING (
    (SELECT auth.uid()) = uploaded_by OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

CREATE POLICY "file_attachments_delete_uploader_or_admin" ON public.file_attachments
  FOR DELETE USING (
    (SELECT auth.uid()) = uploaded_by OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

-- NOTIFICATIONS TABLE - Optimized policies
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_insert_for_user" ON public.notifications
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- REACTIONS TABLE - Optimized policies
CREATE POLICY "reactions_select_authenticated" ON public.reactions
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "reactions_insert_own" ON public.reactions
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND 
    (SELECT auth.uid()) = user_id
  );

CREATE POLICY "reactions_delete_own" ON public.reactions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ARCHIVE_AUDIT_LOG TABLE - Optimized policies (admin only)
CREATE POLICY "archive_audit_log_select_admin" ON public.archive_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'admin'
    )
  );

-- Create performance indexes for commonly queried auth patterns
CREATE INDEX IF NOT EXISTS idx_users_role_auth ON public.users(role) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS idx_projects_archived_auth ON public.projects(archived, created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_assignee ON public.tasks(created_by, assigned_to);
CREATE INDEX IF NOT EXISTS idx_posts_author_auth ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploader ON public.file_attachments(uploaded_by);

-- Add comments documenting the optimization
COMMENT ON POLICY "users_select_own_profile" ON public.users IS 'Optimized: Uses (SELECT auth.uid()) to prevent per-row evaluation';
COMMENT ON POLICY "admin_manage_all_users" ON public.users IS 'Optimized: Wraps auth.uid() in subquery for performance';

-- Verify all tables have RLS enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_audit_log ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
