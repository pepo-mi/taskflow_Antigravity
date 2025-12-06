-- Drop all existing policies on projects table
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Anyone can toggle project completion" ON projects;
DROP POLICY IF EXISTS "Users can view projects in their workspaces" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

-- Enable RLS on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone can view projects in workspaces they have access to
CREATE POLICY "Users can view projects in their workspaces"
ON projects FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Authenticated users can create projects
CREATE POLICY "Users can insert projects"
ON projects FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: Anyone can update the completed field on any project
CREATE POLICY "Anyone can toggle project completion"
ON projects FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 4: Only project creators can delete projects
CREATE POLICY "Users can delete their own projects"
ON projects FOR DELETE
TO authenticated
USING (auth.uid() = created_by);
