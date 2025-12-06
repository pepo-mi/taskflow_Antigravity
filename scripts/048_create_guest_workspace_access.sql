-- Create junction table for guest-workspace access control
CREATE TABLE IF NOT EXISTS public.guest_workspace_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES public.guest_users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guest_id, workspace_id)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_guest_workspace_access_guest_id ON public.guest_workspace_access(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_workspace_access_workspace_id ON public.guest_workspace_access(workspace_id);

-- Enable RLS
ALTER TABLE public.guest_workspace_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for guest_workspace_access
CREATE POLICY "Admins can manage guest workspace access" ON public.guest_workspace_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Guests can view their own workspace access" ON public.guest_workspace_access
  FOR SELECT USING (auth.uid() = guest_id);

-- Update workspace RLS policy to include guest access
DROP POLICY IF EXISTS "Users can view workspaces in their organization" ON public.workspaces;
CREATE POLICY "Users can view workspaces in their organization" ON public.workspaces
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.organization = 'proper.am'
    )
    OR
    -- Guests with explicit workspace access
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      WHERE gwa.guest_id = auth.uid() AND gwa.workspace_id = id
    )
  );

-- Update project RLS policy to include guest access
DROP POLICY IF EXISTS "Users can view projects in accessible workspaces" ON public.projects;
CREATE POLICY "Users can view projects in accessible workspaces" ON public.projects
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.organization = 'proper.am'
    )
    OR
    -- Guests with workspace access
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      WHERE gwa.guest_id = auth.uid() AND gwa.workspace_id = workspace_id
    )
  );

-- Update task RLS policy to include guest access
DROP POLICY IF EXISTS "Users can view tasks in accessible projects" ON public.tasks;
CREATE POLICY "Users can view tasks in accessible projects" ON public.tasks
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.organization = 'proper.am'
    )
    OR
    -- Guests with workspace access (via project)
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      JOIN public.projects p ON p.workspace_id = gwa.workspace_id
      WHERE gwa.guest_id = auth.uid() AND p.id = project_id
    )
  );

-- Update posts RLS policy to include guest access
DROP POLICY IF EXISTS "Users can view posts in accessible projects" ON public.posts;
CREATE POLICY "Users can view posts in accessible projects" ON public.posts
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.organization = 'proper.am'
    )
    OR
    -- Guests with workspace access (via project)
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      JOIN public.projects p ON p.workspace_id = gwa.workspace_id
      WHERE gwa.guest_id = auth.uid() AND p.id = project_id
    )
  );

-- Update file_attachments RLS policy to include guest access
DROP POLICY IF EXISTS "Users can view file attachments" ON public.file_attachments;
CREATE POLICY "Users can view file attachments" ON public.file_attachments
  FOR SELECT USING (
    -- Regular users in the organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.organization = 'proper.am'
    )
    OR
    -- Guests with workspace access (via post -> project)
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      JOIN public.projects p ON p.workspace_id = gwa.workspace_id
      JOIN public.posts po ON po.project_id = p.id
      WHERE gwa.guest_id = auth.uid() AND po.id = post_id
    )
  );

-- Allow guests to create content in workspaces they have access to
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
CREATE POLICY "Users can create posts" ON public.posts
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() AND u.organization = 'proper.am'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.guest_workspace_access gwa
        JOIN public.projects p ON p.workspace_id = gwa.workspace_id
        WHERE gwa.guest_id = auth.uid() AND p.id = project_id
      )
    ) AND auth.uid() = author_id
  );

DROP POLICY IF EXISTS "Users can upload file attachments" ON public.file_attachments;
CREATE POLICY "Users can upload file attachments" ON public.file_attachments
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() AND u.organization = 'proper.am'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.guest_workspace_access gwa
        JOIN public.projects p ON p.workspace_id = gwa.workspace_id
        JOIN public.posts po ON po.project_id = p.id
        WHERE gwa.guest_id = auth.uid() AND po.id = post_id
      )
    ) AND auth.uid() = uploaded_by
  );
