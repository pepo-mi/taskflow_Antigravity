-- Fix workspace_id constraint to allow guest users without workspace assignment
-- This addresses the 500 error when creating guest users in the admin panel

BEGIN;

-- Make workspace_id nullable to allow guest users without workspace
ALTER TABLE public.users
  ALTER COLUMN workspace_id DROP NOT NULL;

-- Remove old foreign key constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_workspace_id_fkey;

-- Re-create foreign key constraint to allow nulls and cascade cleanup
ALTER TABLE public.users
  ADD CONSTRAINT users_workspace_id_fkey
    FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces (id)
    ON DELETE SET NULL;

-- Verify the changes
DO $$
BEGIN
    -- Check if workspace_id is now nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'workspace_id' 
        AND is_nullable = 'YES'
    ) THEN
        RAISE NOTICE 'SUCCESS: workspace_id is now nullable';
    ELSE
        RAISE NOTICE 'ERROR: workspace_id is still NOT NULL';
    END IF;
    
    -- Check if foreign key constraint allows nulls
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_workspace_id_fkey' 
        AND table_name = 'users'
    ) THEN
        RAISE NOTICE 'SUCCESS: Foreign key constraint users_workspace_id_fkey exists with null support';
    ELSE
        RAISE NOTICE 'ERROR: Foreign key constraint users_workspace_id_fkey missing';
    END IF;
END $$;

COMMIT;
