-- Drop the existing constraint if it exists
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_visibility_check;

-- Update any existing workspaces with invalid visibility values
UPDATE workspaces 
SET visibility = 'all' 
WHERE visibility IS NULL OR visibility NOT IN ('all', 'admin_only', 'specific_user');

-- Add the check constraint for workspace visibility values
ALTER TABLE workspaces 
ADD CONSTRAINT workspaces_visibility_check 
CHECK (visibility IN ('all', 'admin_only', 'specific_user'));

-- Ensure all existing workspaces have a valid visibility value
UPDATE workspaces 
SET visibility = 'all' 
WHERE visibility IS NULL;
