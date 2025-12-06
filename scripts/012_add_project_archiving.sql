-- Add archiving functionality to projects table
-- This enables admins to archive completed projects and store metadata snapshots

-- Add archiving columns to projects table
ALTER TABLE projects 
ADD COLUMN archived BOOLEAN DEFAULT false,
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN archived_snapshot JSONB;

-- Add index for efficient querying of archived projects
CREATE INDEX idx_projects_archived ON projects(archived);
CREATE INDEX idx_projects_archived_at ON projects(archived_at) WHERE archived = true;

-- Add constraint to ensure archived_at is set when archived is true
ALTER TABLE projects 
ADD CONSTRAINT check_archived_at_when_archived 
CHECK (
  (archived = false AND archived_at IS NULL) OR 
  (archived = true AND archived_at IS NOT NULL)
);

-- Update RLS policies to handle archived projects
-- Only admins can view archived projects
CREATE POLICY "Admins can view archived projects" ON projects
FOR SELECT USING (
  archived = true AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Allow admins to update archiving status
CREATE POLICY "Admins can archive projects" ON projects
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Add comment for documentation
COMMENT ON COLUMN projects.archived IS 'Indicates if the project has been archived by an admin';
COMMENT ON COLUMN projects.archived_at IS 'Timestamp when the project was archived';
COMMENT ON COLUMN projects.archived_snapshot IS 'Compressed metadata snapshot of project state when archived';
