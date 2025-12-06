-- Fix cascade delete issues to prevent data loss when users are deleted
-- This changes foreign key constraints so that deleting a user doesn't delete their workspaces/projects/tasks

DO $$
BEGIN
  RAISE NOTICE '=== FIXING CASCADE DELETE CONSTRAINTS ===';
  
  -- Fix workspaces.created_by - change from CASCADE to SET NULL
  RAISE NOTICE 'Fixing workspaces.created_by constraint...';
  ALTER TABLE public.workspaces 
    DROP CONSTRAINT IF EXISTS workspaces_created_by_fkey;
  
  ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;
  
  -- Fix projects.created_by - change from CASCADE to SET NULL
  RAISE NOTICE 'Fixing projects.created_by constraint...';
  ALTER TABLE public.projects 
    DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
  
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;
  
  -- Fix tasks.created_by - change from CASCADE to SET NULL
  RAISE NOTICE 'Fixing tasks.created_by constraint...';
  ALTER TABLE public.tasks 
    DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
  
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;
  
  -- Fix posts.author_id (not user_id) - change from CASCADE to SET NULL
  RAISE NOTICE 'Fixing posts.author_id constraint...';
  ALTER TABLE public.posts 
    DROP CONSTRAINT IF EXISTS posts_author_id_fkey;
  
  ALTER TABLE public.posts
    ADD CONSTRAINT posts_author_id_fkey 
    FOREIGN KEY (author_id) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;
  
  -- Fix file_attachments.uploaded_by - change from CASCADE to SET NULL
  RAISE NOTICE 'Fixing file_attachments.uploaded_by constraint...';
  ALTER TABLE public.file_attachments 
    DROP CONSTRAINT IF EXISTS file_attachments_uploaded_by_fkey;
  
  ALTER TABLE public.file_attachments
    ADD CONSTRAINT file_attachments_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;
  
  RAISE NOTICE '=== CASCADE DELETE FIXES COMPLETE ===';
  RAISE NOTICE 'Workspaces, projects, tasks, posts, and file attachments will no longer be deleted when users are deleted.';
  RAISE NOTICE 'Instead, the created_by/assigned_to/author_id/uploaded_by fields will be set to NULL.';
END $$;
