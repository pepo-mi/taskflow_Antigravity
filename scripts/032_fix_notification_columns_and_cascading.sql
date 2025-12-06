-- Fix notification column names and ensure cascading deletes work properly
-- This script ensures notifications are automatically deleted when projects, tasks, or posts are deleted

-- =============================================================================
-- PART 1: Rename columns if they still use old names
-- =============================================================================

-- Check if old column names exist and rename them
DO $$
BEGIN
  -- Rename reference_id to related_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN reference_id TO related_id;
    RAISE NOTICE 'Renamed reference_id to related_id';
  END IF;

  -- Rename reference_type to related_type if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN reference_type TO related_type;
    RAISE NOTICE 'Renamed reference_type to related_type';
  END IF;
END $$;

-- =============================================================================
-- PART 2: Ensure cleanup triggers exist and are correct
-- =============================================================================

-- Cleanup function for project deletions
CREATE OR REPLACE FUNCTION cleanup_project_notifications()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE related_type = 'project' 
    AND related_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project deletions
DROP TRIGGER IF EXISTS cleanup_project_notifications_trigger ON public.projects;
CREATE TRIGGER cleanup_project_notifications_trigger
  BEFORE DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_project_notifications();

-- Cleanup function for task deletions
CREATE OR REPLACE FUNCTION cleanup_task_notifications()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE related_type = 'task' 
    AND related_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task deletions
DROP TRIGGER IF EXISTS cleanup_task_notifications_trigger ON public.tasks;
CREATE TRIGGER cleanup_task_notifications_trigger
  BEFORE DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_task_notifications();

-- Cleanup function for post/comment deletions
CREATE OR REPLACE FUNCTION cleanup_post_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle both 'comment', 'post', and 'reply' types
  DELETE FROM public.notifications
  WHERE related_id = OLD.id
    AND related_type IN ('comment', 'post', 'reply');
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for post deletions
DROP TRIGGER IF EXISTS cleanup_post_notifications_trigger ON public.posts;
CREATE TRIGGER cleanup_post_notifications_trigger
  BEFORE DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_post_notifications();

-- =============================================================================
-- PART 3: Clean up existing orphaned notifications
-- =============================================================================

-- Delete orphaned project notifications
DELETE FROM public.notifications
WHERE related_type = 'project'
  AND related_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = notifications.related_id
  );

-- Delete orphaned task notifications
DELETE FROM public.notifications
WHERE related_type = 'task'
  AND related_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = notifications.related_id
  );

-- Delete orphaned post/comment/reply notifications
DELETE FROM public.notifications
WHERE related_type IN ('comment', 'post', 'reply')
  AND related_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.posts 
    WHERE posts.id = notifications.related_id
  );

-- =============================================================================
-- PART 4: Add indexes for better performance
-- =============================================================================

-- Create index on related_id and related_type for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_related_id 
  ON public.notifications(related_id);

CREATE INDEX IF NOT EXISTS idx_notifications_related_type 
  ON public.notifications(related_type);

CREATE INDEX IF NOT EXISTS idx_notifications_related_composite 
  ON public.notifications(related_type, related_id);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  orphaned_count INTEGER;
  trigger_count INTEGER;
BEGIN
  -- Check for orphaned notifications
  SELECT COUNT(*) INTO orphaned_count
  FROM public.notifications n
  WHERE (
    (n.related_type = 'project' AND n.related_id IS NOT NULL 
     AND NOT EXISTS (SELECT 1 FROM public.projects WHERE id = n.related_id))
    OR
    (n.related_type = 'task' AND n.related_id IS NOT NULL 
     AND NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = n.related_id))
    OR
    (n.related_type IN ('comment', 'post', 'reply') AND n.related_id IS NOT NULL 
     AND NOT EXISTS (SELECT 1 FROM public.posts WHERE id = n.related_id))
  );
  
  -- Check trigger count
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN (
    'cleanup_project_notifications_trigger',
    'cleanup_task_notifications_trigger',
    'cleanup_post_notifications_trigger'
  );
  
  RAISE NOTICE '=== Cascading Delete Setup Complete ===';
  RAISE NOTICE 'Triggers installed: %', trigger_count;
  RAISE NOTICE 'Orphaned notifications cleaned: %', orphaned_count;
  RAISE NOTICE 'Indexes created for performance';
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned notifications after cleanup', orphaned_count;
  ELSE
    RAISE NOTICE '✓ No orphaned notifications found';
  END IF;
  
  IF trigger_count = 3 THEN
    RAISE NOTICE '✓ All 3 cleanup triggers are active';
  ELSE
    RAISE WARNING 'Expected 3 triggers but found %', trigger_count;
  END IF;
END $$;

-- Add documentation
COMMENT ON FUNCTION cleanup_project_notifications() IS 
  'Automatically deletes all notifications when a project is deleted';
COMMENT ON FUNCTION cleanup_task_notifications() IS 
  'Automatically deletes all notifications when a task is deleted';
COMMENT ON FUNCTION cleanup_post_notifications() IS 
  'Automatically deletes all notifications when a post/comment/reply is deleted';
