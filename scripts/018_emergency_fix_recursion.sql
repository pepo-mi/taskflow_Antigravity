-- Emergency fix for infinite recursion in RLS policies
-- This completely removes all problematic policies and creates simple, safe ones

-- Temporarily disable RLS to avoid recursion during policy updates
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_audit_log DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start completely fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- USERS TABLE - Ultra-simple policies with NO table self-references
CREATE POLICY "users_select_authenticated" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "users_update_own" ON public.users  
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_authenticated" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- WORKSPACES TABLE - Simple policies
CREATE POLICY "workspaces_select_authenticated" ON public.workspaces
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "workspaces_insert_own" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "workspaces_update_creator" ON public.workspaces
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "workspaces_delete_creator" ON public.workspaces
  FOR DELETE USING (auth.uid() = created_by);

-- PROJECTS TABLE - Simple policies
CREATE POLICY "projects_select_authenticated" ON public.projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "projects_update_creator" ON public.projects
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "projects_delete_creator" ON public.projects
  FOR DELETE USING (auth.uid() = created_by);

-- TASKS TABLE - Simple policies
CREATE POLICY "tasks_select_authenticated" ON public.tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "tasks_update_creator_or_assignee" ON public.tasks
  FOR UPDATE USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE POLICY "tasks_delete_creator" ON public.tasks
  FOR DELETE USING (auth.uid() = created_by);

-- POSTS TABLE - Simple policies
CREATE POLICY "posts_select_authenticated" ON public.posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_update_author" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "posts_delete_author" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

-- FILE_ATTACHMENTS TABLE - Simple policies
CREATE POLICY "file_attachments_select_authenticated" ON public.file_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "file_attachments_insert_own" ON public.file_attachments
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "file_attachments_delete_uploader" ON public.file_attachments
  FOR DELETE USING (auth.uid() = uploaded_by);

-- NOTIFICATIONS TABLE - Simple policies
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_any" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- REACTIONS TABLE - Simple policies
CREATE POLICY "reactions_select_authenticated" ON public.reactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "reactions_insert_own" ON public.reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_delete_own" ON public.reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ARCHIVE_AUDIT_LOG TABLE - Simple policies
CREATE POLICY "archive_audit_log_select_authenticated" ON public.archive_audit_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "archive_audit_log_insert_any" ON public.archive_audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Re-enable RLS on all tables
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
