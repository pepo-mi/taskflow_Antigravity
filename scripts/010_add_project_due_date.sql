-- Add due_date column to projects table
ALTER TABLE projects ADD COLUMN due_date DATE;

-- Add index for due_date queries
CREATE INDEX idx_projects_due_date ON projects(due_date);

-- Update RLS policies to include due_date in allowed columns
-- (No changes needed as existing policies allow all columns)
