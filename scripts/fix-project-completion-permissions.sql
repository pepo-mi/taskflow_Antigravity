-- Allow all authenticated users to update the 'completed' field on projects
-- This enables anyone to toggle project completion regardless of authorship

-- First, drop the existing update policy if it exists
DROP POLICY IF EXISTS "Users can update projects they created" ON projects;

-- Create a new policy that allows users to update their own projects (all fields)
CREATE POLICY "Users can update their own projects"
ON projects
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Create a separate policy that allows ANY authenticated user to update the 'completed' field
CREATE POLICY "Anyone can toggle project completion"
ON projects
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  -- Only allow updating the 'completed' field
  -- All other fields must remain unchanged
  (
    name = (SELECT name FROM projects WHERE id = projects.id) AND
    description = (SELECT description FROM projects WHERE id = projects.id) AND
    workspace_id = (SELECT workspace_id FROM projects WHERE id = projects.id) AND
    created_by = (SELECT created_by FROM projects WHERE id = projects.id) AND
    due_date = (SELECT due_date FROM projects WHERE id = projects.id) AND
    archived = (SELECT archived FROM projects WHERE id = projects.id)
  )
);
