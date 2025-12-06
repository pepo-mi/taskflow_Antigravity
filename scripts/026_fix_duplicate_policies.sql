-- Fix duplicate policy error by properly dropping and recreating policies
-- This script is idempotent and can be run multiple times safely

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users with privileges can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users with privileges can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users with privileges can manage workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Organization users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Organization users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin can manage workspaces" ON public.workspaces;

-- Recreate policies with privilege checks for project creation
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

-- Recreate policies with privilege checks for task creation
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

-- Recreate policies with privilege checks for workspace management
CREATE POLICY "Users with privileges can manage workspaces" ON public.workspaces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
      AND (u.role = 'admin' OR (u.privileges->>'can_create_workspaces')::boolean = true)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.guest_users g 
      WHERE g.id = auth.uid() 
      AND (g.privileges->>'can_create_workspaces')::boolean = true
    )
  );
