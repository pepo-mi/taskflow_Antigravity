-- Fix RLS policies preventing project creation
-- The issue is that the organization check is too restrictive

-- Drop the restrictive organization-based policies
DROP POLICY IF EXISTS "Organization users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects in accessible workspaces" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects they created" ON public.projects;

-- Create more flexible policies that allow authenticated users to create projects
-- Allow authenticated users to create projects (they must set created_by to their own ID)
CREATE POLICY "Authenticated users can create projects" ON public.projects
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid() = created_by
  );

-- Allow users to view projects (no organization restriction)
CREATE POLICY "Authenticated users can view projects" ON public.projects
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- Allow users to update projects they created or if they're admin
CREATE POLICY "Users can update own projects or admin can update all" ON public.projects
  FOR UPDATE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Allow users to delete projects they created or if they're admin
CREATE POLICY "Users can delete own projects or admin can delete all" ON public.projects
  FOR DELETE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Ensure the admin policy still works for all operations
-- This policy should take precedence for admin users
CREATE POLICY "Admin can manage all projects" ON public.projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
