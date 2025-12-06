-- Debug and fix RLS policies
-- First, ensure RLS is enabled on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on users table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.users';
    END LOOP;
    
    -- Drop all policies on workspaces table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'workspaces' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.workspaces';
    END LOOP;
    
    -- Drop all policies on projects table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.projects';
    END LOOP;
    
    -- Drop all policies on tasks table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'tasks' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.tasks';
    END LOOP;
    
    -- Drop all policies on posts table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'posts' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.posts';
    END LOOP;
    
    -- Drop all policies on file_attachments table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'file_attachments' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.file_attachments';
    END LOOP;
END $$;

-- Create the simplest possible policies that work
-- Users table - allow authenticated users to read all users and update their own profile
CREATE POLICY "allow_authenticated_read_users" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_users_update_own_profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Workspaces table
CREATE POLICY "allow_authenticated_read_workspaces" ON public.workspaces
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_admin_manage_workspaces" ON public.workspaces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Projects table
CREATE POLICY "allow_authenticated_read_projects" ON public.projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_authenticated_create_projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "allow_users_update_own_projects" ON public.projects
  FOR UPDATE USING (auth.uid() = created_by);

-- Tasks table
CREATE POLICY "allow_authenticated_read_tasks" ON public.tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_authenticated_create_tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "allow_users_update_tasks" ON public.tasks
  FOR UPDATE USING (
    auth.uid() = created_by OR 
    auth.uid() = assigned_to
  );

-- Posts table
CREATE POLICY "allow_authenticated_read_posts" ON public.posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_authenticated_create_posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "allow_users_manage_own_posts" ON public.posts
  FOR ALL USING (auth.uid() = author_id);

-- File attachments table
CREATE POLICY "allow_authenticated_read_attachments" ON public.file_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_authenticated_create_attachments" ON public.file_attachments
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "allow_users_manage_own_attachments" ON public.file_attachments
  FOR ALL USING (auth.uid() = uploaded_by);

-- Ensure the user creation trigger exists and works
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, organization)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email = 'peno@proper.am' THEN 'admin'
      WHEN NEW.email LIKE '%@proper.am' THEN 'user'
      ELSE 'guest'
    END,
    CASE 
      WHEN NEW.email LIKE '%@proper.am' THEN 'proper.am'
      ELSE 'external'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
