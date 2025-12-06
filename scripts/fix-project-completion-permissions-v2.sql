-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Anyone can toggle project completion" ON projects;

-- Policy 1: Allow users to update their own projects (all fields)
CREATE POLICY "Users can update their own projects"
ON projects
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Policy 2: Allow anyone to toggle project completion status
CREATE POLICY "Anyone can toggle project completion"
ON projects
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  -- Only allow updating the completed field
  -- All other fields must remain unchanged
  name = (SELECT name FROM projects WHERE id = projects.id) AND
  description = (SELECT description FROM projects WHERE id = projects.id) AND
  workspace_id = (SELECT workspace_id FROM projects WHERE id = projects.id) AND
  created_by = (SELECT created_by FROM projects WHERE id = projects.id) AND
  created_at = (SELECT created_at FROM projects WHERE id = projects.id)
);
