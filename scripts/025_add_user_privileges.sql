-- Add privileges column to both users and guest_users tables
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS privileges JSONB DEFAULT '{"can_create_workspaces": false, "can_create_projects": false, "can_create_tasks": false}';

ALTER TABLE public.guest_users 
ADD COLUMN IF NOT EXISTS privileges JSONB DEFAULT '{"can_create_workspaces": false, "can_create_projects": false, "can_create_tasks": false}';

-- Update existing users with default privileges based on role
UPDATE public.users 
SET privileges = CASE 
  WHEN role = 'admin' THEN '{"can_create_workspaces": true, "can_create_projects": true, "can_create_tasks": true}'::jsonb
  WHEN role = 'user' THEN '{"can_create_workspaces": false, "can_create_projects": true, "can_create_tasks": true}'::jsonb
  ELSE '{"can_create_workspaces": false, "can_create_projects": false, "can_create_tasks": false}'::jsonb
END
WHERE privileges IS NULL OR privileges = '{"can_create_workspaces": false, "can_create_projects": false, "can_create_tasks": false}'::jsonb;

-- Update existing guest users with restricted privileges
UPDATE public.guest_users 
SET privileges = '{"can_create_workspaces": false, "can_create_projects": false, "can_create_tasks": false}'::jsonb
WHERE privileges IS NULL OR privileges = '{"can_create_workspaces": false, "can_create_projects": false, "can_create_tasks": false}'::jsonb;

-- Update RLS policies to check privileges for project creation
DROP POLICY IF EXISTS "Organization users can create projects" ON public.projects;
CREATE POLICY "Users with privileges can create projects" ON public.projects
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND (u.role = 'admin' OR (u.privileges->>'can_create_projects')::boolean = true)
      )
      OR
      EXISTS (
        SELECT 1 FROM public.guest_users g 
        WHERE g.id = auth.uid() 
        AND (g.privileges->>'can_create_projects')::boolean = true
      )
    ) AND auth.uid() = created_by
  );

-- Update RLS policies to check privileges for task creation
DROP POLICY IF EXISTS "Organization users can create tasks" ON public.tasks;
CREATE POLICY "Users with privileges can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND (u.role = 'admin' OR (u.privileges->>'can_create_tasks')::boolean = true)
      )
      OR
      EXISTS (
        SELECT 1 FROM public.guest_users g 
        WHERE g.id = auth.uid() 
        AND (g.privileges->>'can_create_tasks')::boolean = true
      )
    ) AND auth.uid() = created_by
  );

-- Update RLS policies to check privileges for workspace creation
DROP POLICY IF EXISTS "Admin can manage workspaces" ON public.workspaces;
CREATE POLICY "Users with privileges can manage workspaces" ON public.workspaces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
      AND (u.role = 'admin' OR (u.privileges->>'can_create_workspaces')::boolean = true)
    )
  );

-- Create indexes for better performance on privileges column
CREATE INDEX IF NOT EXISTS idx_users_privileges ON public.users USING GIN (privileges);
CREATE INDEX IF NOT EXISTS idx_guest_users_privileges ON public.guest_users USING GIN (privileges);
