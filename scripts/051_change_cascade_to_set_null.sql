-- Migration: Change ON DELETE CASCADE to ON DELETE SET NULL for content preservation
-- This ensures that when a user is deleted, their created content remains in the database
-- but the created_by/author_id references are set to NULL

-- First, we need to drop the existing foreign key constraints and recreate them with SET NULL

-- 1. Workspaces: Change created_by from CASCADE to SET NULL
ALTER TABLE public.workspaces 
  DROP CONSTRAINT IF EXISTS workspaces_created_by_fkey;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Make created_by nullable (required for SET NULL to work)
ALTER TABLE public.workspaces 
  ALTER COLUMN created_by DROP NOT NULL;

-- 2. Projects: Change created_by from CASCADE to SET NULL
ALTER TABLE public.projects 
  DROP CONSTRAINT IF EXISTS projects_created_by_fkey;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Make created_by nullable
ALTER TABLE public.projects 
  ALTER COLUMN created_by DROP NOT NULL;

-- 3. Tasks: Change created_by from CASCADE to SET NULL (assigned_to already uses SET NULL)
ALTER TABLE public.tasks 
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Make created_by nullable
ALTER TABLE public.tasks 
  ALTER COLUMN created_by DROP NOT NULL;

-- 4. Posts: Change author_id from CASCADE to SET NULL
ALTER TABLE public.posts 
  DROP CONSTRAINT IF EXISTS posts_author_id_fkey;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_author_id_fkey 
  FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Make author_id nullable
ALTER TABLE public.posts 
  ALTER COLUMN author_id DROP NOT NULL;

-- 5. File Attachments: Change uploaded_by from CASCADE to SET NULL
ALTER TABLE public.file_attachments 
  DROP CONSTRAINT IF EXISTS file_attachments_uploaded_by_fkey;

ALTER TABLE public.file_attachments
  ADD CONSTRAINT file_attachments_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Make uploaded_by nullable
ALTER TABLE public.file_attachments 
  ALTER COLUMN uploaded_by DROP NOT NULL;

-- Note: The following CASCADE constraints are intentionally KEPT because they make sense:
-- - workspaces -> projects (deleting workspace should delete its projects)
-- - projects -> tasks (deleting project should delete its tasks)
-- - projects -> posts (deleting project should delete its posts)
-- - posts -> file_attachments (deleting post should delete its attachments)
-- - posts -> posts (parent_id for replies - deleting parent deletes replies)
