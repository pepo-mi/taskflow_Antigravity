-- Fix project update permissions to allow users with appropriate privileges
-- This allows non-creators to toggle project completion and make other updates

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "projects_update_creator" ON projects;
DROP POLICY IF EXISTS "projects_update_own" ON projects;
DROP POLICY IF EXISTS "Users with privileges can update projects" ON projects;

-- Create a new policy that allows:
-- 1. Project creators to update their projects
-- 2. Admins to update any project
-- 3. Users with edit_projects privilege to update projects
CREATE POLICY "projects_update_with_privileges" ON projects
FOR UPDATE USING (
  -- User is the creator
  created_by = (select auth.uid())
  OR
  -- User is an admin (check both users and guest_users tables)
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
  OR
  -- User has edit_projects privilege (check both users and guest_users tables)
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = (select auth.uid()) 
    AND privileges->>'edit_projects' = 'true'
  )
  OR
  EXISTS (
    SELECT 1 FROM guest_users 
    WHERE id = (select auth.uid()) 
    AND privileges->>'edit_projects' = 'true'
  )
);

-- Ensure the policy allows updating all columns including completed
-- No WITH CHECK clause means all updates are allowed if the USING clause passes
