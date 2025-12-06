-- Enhanced security and RLS policies for archived projects system
-- Ensures only admins can access archived projects and manage archiving operations

-- Drop existing policies to recreate with enhanced security
DROP POLICY IF EXISTS "Admins can view archived projects" ON projects;
DROP POLICY IF EXISTS "Admins can archive projects" ON projects;

-- Create comprehensive RLS policies for archived projects
-- Only admins can view archived projects
CREATE POLICY "Admin only archived project access" ON projects
FOR SELECT USING (
  (archived = false) OR 
  (archived = true AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  ))
);

-- Only admins can update archiving status
CREATE POLICY "Admin only archiving operations" ON projects
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Add policy to prevent non-admins from accessing archived snapshots
-- Ensure archived_snapshot column is only accessible to admins
CREATE POLICY "Admin only snapshot access" ON projects
FOR SELECT USING (
  (archived_snapshot IS NULL) OR 
  (archived_snapshot IS NOT NULL AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  ))
);

-- Add function to validate archiving operations
CREATE OR REPLACE FUNCTION validate_archive_operation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow archiving if user is admin
  IF NEW.archived = true AND OLD.archived = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only administrators can archive projects';
    END IF;
  END IF;
  
  -- Only allow restoring if user is admin
  IF NEW.archived = false AND OLD.archived = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only administrators can restore archived projects';
    END IF;
  END IF;
  
  -- Ensure archived_at is set when archiving
  IF NEW.archived = true AND NEW.archived_at IS NULL THEN
    NEW.archived_at = NOW();
  END IF;
  
  -- Clear archived fields when restoring
  IF NEW.archived = false THEN
    NEW.archived_at = NULL;
    NEW.archived_snapshot = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce archiving validation
DROP TRIGGER IF EXISTS validate_archive_trigger ON projects;
CREATE TRIGGER validate_archive_trigger
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION validate_archive_operation();

-- Add audit logging for archiving operations
CREATE TABLE IF NOT EXISTS archive_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('archived', 'restored')),
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  project_name TEXT,
  workspace_name TEXT
);

-- Enable RLS on audit log
ALTER TABLE archive_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admin only audit access" ON archive_audit_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Create function to log archiving operations
CREATE OR REPLACE FUNCTION log_archive_operation()
RETURNS TRIGGER AS $$
BEGIN
  -- Log archiving operation
  IF NEW.archived = true AND OLD.archived = false THEN
    INSERT INTO archive_audit_log (project_id, action, performed_by, project_name, workspace_name)
    SELECT NEW.id, 'archived', auth.uid(), NEW.name, w.name
    FROM workspaces w WHERE w.id = NEW.workspace_id;
  END IF;
  
  -- Log restore operation
  IF NEW.archived = false AND OLD.archived = true THEN
    INSERT INTO archive_audit_log (project_id, action, performed_by, project_name, workspace_name)
    SELECT NEW.id, 'restored', auth.uid(), NEW.name, w.name
    FROM workspaces w WHERE w.id = NEW.workspace_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS log_archive_trigger ON projects;
CREATE TRIGGER log_archive_trigger
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION log_archive_operation();

-- Add index for performance on archived queries
CREATE INDEX IF NOT EXISTS idx_projects_archived_admin ON projects(archived, id) 
WHERE archived = true;

-- Add comments for documentation
COMMENT ON POLICY "Admin only archived project access" ON projects IS 'Restricts archived project visibility to administrators only';
COMMENT ON POLICY "Admin only archiving operations" ON projects IS 'Only administrators can archive or restore projects';
COMMENT ON FUNCTION validate_archive_operation() IS 'Validates and enforces archiving business rules';
COMMENT ON TABLE archive_audit_log IS 'Audit trail for all archiving and restore operations';
