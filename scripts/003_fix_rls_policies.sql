-- Drop the problematic RLS policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view organization members" ON public.users;

-- Create a simpler policy that doesn't cause recursion
-- Users can view other users in the same organization without circular reference
CREATE POLICY "Users can view organization members" ON public.users
  FOR SELECT USING (
    -- Allow users to see their own profile
    auth.uid() = id OR
    -- Allow users to see others in proper.am organization
    (organization = 'proper.am' AND 
     auth.jwt() ->> 'email' LIKE '%@proper.am' OR
     EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid()))
  );

-- Simplify workspace policies to avoid potential recursion
DROP POLICY IF EXISTS "Users can view workspaces in their organization" ON public.workspaces;
DROP POLICY IF EXISTS "Admin can manage workspaces" ON public.workspaces;

CREATE POLICY "Proper.am users can view workspaces" ON public.workspaces
  FOR SELECT USING (
    auth.jwt() ->> 'email' LIKE '%@proper.am' OR
    auth.jwt() ->> 'email' = 'peno@proper.am'
  );

CREATE POLICY "Admin can manage workspaces" ON public.workspaces
  FOR ALL USING (
    auth.jwt() ->> 'email' = 'peno@proper.am'
  );

-- Simplify project policies to avoid recursion
DROP POLICY IF EXISTS "Users can view projects in accessible workspaces" ON public.projects;
DROP POLICY IF EXISTS "Organization users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Admin can manage all projects" ON public.projects;

CREATE POLICY "Proper.am users can view projects" ON public.projects
  FOR SELECT USING (
    auth.jwt() ->> 'email' LIKE '%@proper.am' OR
    auth.jwt() ->> 'email' = 'peno@proper.am'
  );

CREATE POLICY "Proper.am users can create projects" ON public.projects
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'email' LIKE '%@proper.am' OR
     auth.jwt() ->> 'email' = 'peno@proper.am') AND 
    auth.uid() = created_by
  );

CREATE POLICY "Admin can manage all projects" ON public.projects
  FOR ALL USING (
    auth.jwt() ->> 'email' = 'peno@proper.am'
  );

-- Simplify task policies to avoid recursion
DROP POLICY IF EXISTS "Users can view tasks in accessible projects" ON public.tasks;
DROP POLICY IF EXISTS "Organization users can create tasks" ON public.tasks;

CREATE POLICY "Proper.am users can view tasks" ON public.tasks
  FOR SELECT USING (
    auth.jwt() ->> 'email' LIKE '%@proper.am' OR
    auth.jwt() ->> 'email' = 'peno@proper.am'
  );

CREATE POLICY "Proper.am users can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'email' LIKE '%@proper.am' OR
     auth.jwt() ->> 'email' = 'peno@proper.am') AND 
    auth.uid() = created_by
  );

-- Simplify post policies to avoid recursion
DROP POLICY IF EXISTS "Users can view posts in accessible projects" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;

CREATE POLICY "Proper.am users can view posts" ON public.posts
  FOR SELECT USING (
    auth.jwt() ->> 'email' LIKE '%@proper.am' OR
    auth.jwt() ->> 'email' = 'peno@proper.am'
  );

CREATE POLICY "Proper.am users can create posts" ON public.posts
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'email' LIKE '%@proper.am' OR
     auth.jwt() ->> 'email' = 'peno@proper.am') AND 
    auth.uid() = author_id
  );

-- Simplify file attachment policies to avoid recursion
DROP POLICY IF EXISTS "Users can view file attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can upload file attachments" ON public.file_attachments;

CREATE POLICY "Proper.am users can view file attachments" ON public.file_attachments
  FOR SELECT USING (
    auth.jwt() ->> 'email' LIKE '%@proper.am' OR
    auth.jwt() ->> 'email' = 'peno@proper.am'
  );

CREATE POLICY "Proper.am users can upload file attachments" ON public.file_attachments
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'email' LIKE '%@proper.am' OR
     auth.jwt() ->> 'email' = 'peno@proper.am') AND 
    auth.uid() = uploaded_by
  );
