-- Add position column to workspaces table for drag and drop functionality
-- This enables workspace reordering by users

-- Add position column with default value
ALTER TABLE public.workspaces 
ADD COLUMN position INTEGER DEFAULT 0;

-- Update existing workspaces with incremental positions based on creation date
UPDATE public.workspaces 
SET position = row_number 
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_number 
  FROM public.workspaces
) as numbered_workspaces 
WHERE workspaces.id = numbered_workspaces.id;

-- Make position NOT NULL after setting values
ALTER TABLE public.workspaces 
ALTER COLUMN position SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.workspaces.position IS 'Position for drag and drop ordering of workspaces';
