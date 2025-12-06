-- Add completed column to projects table
ALTER TABLE projects ADD COLUMN completed BOOLEAN DEFAULT FALSE;

-- Add index for completed status queries
CREATE INDEX idx_projects_completed ON projects(completed);

-- Update RLS policies to include completed in allowed columns
-- (No changes needed as existing policies allow all columns)
