-- Add check constraint for workspace visibility values
ALTER TABLE workspaces 
ADD CONSTRAINT workspaces_visibility_check 
CHECK (visibility IN ('all', 'admin_only', 'specific_user'));

-- Update any existing workspaces with invalid visibility values
UPDATE workspaces 
SET visibility = 'all' 
WHERE visibility IS NULL OR visibility NOT IN ('all', 'admin_only', 'specific_user');
