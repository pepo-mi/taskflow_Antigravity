-- Add triggers to automatically clean up notifications when projects or tasks are deleted
-- This prevents orphaned notification records that reference non-existent entities

-- =============================================================================
-- PART 1: Create cleanup function for project deletions
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_project_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Fixed column names: reference_type -> related_type, reference_id -> related_id
  DELETE FROM public.notifications
  WHERE related_type = 'project' 
    AND related_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run cleanup function before project deletion
DROP TRIGGER IF EXISTS cleanup_project_notifications_trigger ON public.projects;
CREATE TRIGGER cleanup_project_notifications_trigger
  BEFORE DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_project_notifications();

-- =============================================================================
-- PART 2: Create cleanup function for task deletions
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_task_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Fixed column names: reference_type -> related_type, reference_id -> related_id
  DELETE FROM public.notifications
  WHERE related_type = 'task' 
    AND related_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run cleanup function before task deletion
DROP TRIGGER IF EXISTS cleanup_task_notifications_trigger ON public.tasks;
CREATE TRIGGER cleanup_task_notifications_trigger
  BEFORE DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_task_notifications();

-- =============================================================================
-- PART 3: Create cleanup function for post/comment deletions
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_post_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Fixed column names: reference_type -> related_type, reference_id -> related_id
  DELETE FROM public.notifications
  WHERE related_type = 'comment' 
    AND related_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run cleanup function before post deletion
DROP TRIGGER IF EXISTS cleanup_post_notifications_trigger ON public.posts;
CREATE TRIGGER cleanup_post_notifications_trigger
  BEFORE DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_post_notifications();

-- =============================================================================
-- PART 4: Clean up existing orphaned notifications (one-time cleanup)
-- =============================================================================

-- Fixed column names in cleanup queries
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

-- Delete orphaned comment notifications
DELETE FROM public.notifications
WHERE related_type = 'comment'
  AND related_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.posts 
    WHERE posts.id = notifications.related_id
  );

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  -- Fixed column names in verification query
  SELECT COUNT(*) INTO orphaned_count
  FROM public.notifications n
  WHERE (
    (n.related_type = 'project' AND n.related_id IS NOT NULL 
     AND NOT EXISTS (SELECT 1 FROM public.projects WHERE id = n.related_id))
    OR
    (n.related_type = 'task' AND n.related_id IS NOT NULL 
     AND NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = n.related_id))
    OR
    (n.related_type = 'comment' AND n.related_id IS NOT NULL 
     AND NOT EXISTS (SELECT 1 FROM public.posts WHERE id = n.related_id))
  );
  
  RAISE NOTICE 'Notification Cleanup Complete:';
  RAISE NOTICE '- Created 3 cleanup triggers (projects, tasks, posts)';
  RAISE NOTICE '- Cleaned up existing orphaned notifications';
  RAISE NOTICE '- Remaining orphaned notifications: %', orphaned_count;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned notifications that could not be cleaned up', orphaned_count;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON FUNCTION cleanup_project_notifications() IS 'Automatically deletes notifications when a project is deleted';
COMMENT ON FUNCTION cleanup_task_notifications() IS 'Automatically deletes notifications when a task is deleted';
COMMENT ON FUNCTION cleanup_post_notifications() IS 'Automatically deletes notifications when a post/comment is deleted';
