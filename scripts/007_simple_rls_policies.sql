-- Complete RLS policy reset with the simplest possible policies
-- This will fix the "permission denied for table users" error

-- Drop all existing policies
DROP POLICY IF EXISTS "allow_authenticated_read_users" ON public.users;
DROP POLICY IF EXISTS "allow_user_insert_own_profile" ON public.users;
DROP POLICY IF EXISTS "allow_user_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "allow_admin_all_users" ON public.users;
DROP POLICY IF EXISTS "allow_authenticated_read_workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "allow_admin_manage_workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "allow_authenticated_read_projects" ON public.projects;
DROP POLICY IF EXISTS "allow_users_manage_projects" ON public.projects;
DROP POLICY IF EXISTS "allow_authenticated_read_tasks" ON public.tasks;
DROP POLICY IF EXISTS "allow_users_manage_tasks" ON public.tasks;
DROP POLICY IF EXISTS "allow_authenticated_read_posts" ON public.posts;
DROP POLICY IF EXISTS "allow_users_manage_own_posts" ON public.posts;
DROP POLICY IF EXISTS "allow_authenticated_read_attachments" ON public.attachments;
DROP POLICY IF EXISTS "allow_users_manage_attachments" ON public.attachments;

-- Disable RLS temporarily
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Create the simplest possible policies - just allow authenticated users to do everything
-- Users table
CREATE POLICY "users_all_authenticated" ON public.users
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Workspaces table
CREATE POLICY "workspaces_all_authenticated" ON public.workspaces
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Projects table
CREATE POLICY "projects_all_authenticated" ON public.projects
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Tasks table
CREATE POLICY "tasks_all_authenticated" ON public.tasks
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Posts table
CREATE POLICY "posts_all_authenticated" ON public.posts
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Attachments table
CREATE POLICY "attachments_all_authenticated" ON public.attachments
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Grant necessary permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure the authenticated role can access auth schema
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
