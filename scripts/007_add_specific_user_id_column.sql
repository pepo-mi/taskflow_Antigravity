-- Add specific_user_id column to workspaces table for specific user visibility
ALTER TABLE workspaces 
ADD COLUMN specific_user_id UUID REFERENCES users(id);

-- Add index for better query performance
CREATE INDEX idx_workspaces_specific_user_id ON workspaces(specific_user_id);

-- Update RLS policies to handle specific user visibility
DROP POLICY IF EXISTS "Users can view workspaces based on visibility" ON workspaces;

CREATE POLICY "Users can view workspaces based on visibility" ON workspaces
FOR SELECT USING (
  visibility = 'all' OR 
  (visibility = 'admin_only' AND auth.jwt() ->> 'role' = 'admin') OR
  (visibility = 'specific_user' AND specific_user_id = auth.uid()) OR
  created_by = auth.uid()
);
