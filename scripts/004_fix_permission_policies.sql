-- Completely rewrite RLS policies to fix permission denied errors
-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view organization members" ON public.users;
DROP POLICY IF EXISTS "Proper.am users can view workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Admin can manage workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Proper.am users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Proper.am users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Admin can manage all projects" ON public.projects;
DROP POLICY IF EXISTS "Proper.am users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Proper.am users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Proper.am users can view posts" ON public.posts;
DROP POLICY IF EXISTS "Proper.am users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Proper.am users can view file attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "Proper.am users can upload file attachments" ON public.file_attachments;

-- Create simple, working RLS policies that avoid recursion
-- Users table - allow authenticated users to view all users (simplified for now)
CREATE POLICY "Authenticated users can view users" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Workspaces table - allow authenticated users to view and admin to manage
CREATE POLICY "Authenticated users can view workspaces" ON public.workspaces
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage workspaces" ON public.workspaces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Projects table - allow authenticated users to view and create
CREATE POLICY "Authenticated users can view projects" ON public.projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Admin can manage all projects" ON public.projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Tasks table - allow authenticated users to view and create
CREATE POLICY "Authenticated users can view tasks" ON public.tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update tasks" ON public.tasks
  FOR UPDATE USING (
    auth.uid() = created_by OR 
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Posts table - allow authenticated users to view and create
CREATE POLICY "Authenticated users can view posts" ON public.posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own posts" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own posts" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

-- File attachments table - allow authenticated users to view and upload
CREATE POLICY "Authenticated users can view file attachments" ON public.file_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload file attachments" ON public.file_attachments
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own file attachments" ON public.file_attachments
  FOR DELETE USING (auth.uid() = uploaded_by);
