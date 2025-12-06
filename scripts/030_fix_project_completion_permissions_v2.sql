-- Fix project completion toggle permissions (Version 2)
-- Allow all organization members to toggle project completion status

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "projects_update_creator" ON projects;
DROP POLICY IF EXISTS "projects_update_own" ON projects;
DROP POLICY IF EXISTS "Users with privileges can update projects" ON projects;
DROP POLICY IF EXISTS "projects_update_with_privileges" ON projects;
DROP POLICY IF EXISTS "projects_update_organization_members" ON projects;

-- Create a new policy that allows:
-- 1. All organization members to update projects (including completion status)
-- 2. Admins to update any project
CREATE POLICY "projects_update_organization_members" ON projects
FOR UPDATE USING (
  -- User is in the same organization (proper.am)
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = (select auth.uid()) 
    AND organization = 'proper.am'
  )
  OR
  -- User is a guest user with access
  EXISTS (
    SELECT 1 FROM guest_users 
    WHERE id = (select auth.uid())
  )
  OR
  -- User is an admin (extra check)
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = (select auth.uid()) 
    AND role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM guest_users 
    WHERE id = (select auth.uid()) 
    AND role = 'admin'
  )
);

-- Add edit_projects privilege to existing privilege system
UPDATE users 
SET privileges = jsonb_set(
  COALESCE(privileges, '{}'::jsonb),
  '{edit_projects}',
  'true'::jsonb
)
WHERE role IN ('admin', 'user');

UPDATE guest_users 
SET privileges = jsonb_set(
  COALESCE(privileges, '{}'::jsonb),
  '{edit_projects}',
  CASE WHEN role = 'admin' THEN 'true'::jsonb ELSE 'false'::jsonb END
);

-- Update default privileges for new users
ALTER TABLE users 
ALTER COLUMN privileges 
SET DEFAULT '{"can_create_workspaces": false, "can_create_projects": true, "can_create_tasks": true, "edit_projects": true}'::jsonb;

ALTER TABLE guest_users 
ALTER COLUMN privileges 
SET DEFAULT '{"can_create_workspaces": false, "can_create_projects": false, "can_create_tasks": false, "edit_projects": false}'::jsonb;
