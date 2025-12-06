-- Add privileges column to guest_users table to match users table structure
ALTER TABLE public.guest_users 
ADD COLUMN IF NOT EXISTS privileges jsonb DEFAULT '{
  "can_create_workspaces": false,
  "can_create_projects": false,
  "can_create_tasks": false
}'::jsonb;

-- Update existing guest users to have default privileges if they don't have any
UPDATE public.guest_users 
SET privileges = '{
  "can_create_workspaces": false,
  "can_create_projects": false,
  "can_create_tasks": false
}'::jsonb
WHERE privileges IS NULL;
