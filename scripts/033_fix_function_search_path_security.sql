-- Fix security issue: Function Search Path Mutable
-- This script adds the search_path parameter to notification cleanup functions
-- to prevent search path attacks

-- =============================================================================
-- Fix cleanup_project_notifications function
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_project_notifications()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE related_type = 'project' 
    AND related_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- =============================================================================
-- Fix cleanup_task_notifications function
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_task_notifications()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE related_type = 'task' 
    AND related_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- =============================================================================
-- Fix cleanup_post_notifications function
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_post_notifications()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE related_type = 'comment' 
    AND related_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- =============================================================================
-- Verification
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Security Fix Applied:';
  RAISE NOTICE '- Updated cleanup_project_notifications() with SET search_path = public';
  RAISE NOTICE '- Updated cleanup_task_notifications() with SET search_path = public';
  RAISE NOTICE '- Updated cleanup_post_notifications() with SET search_path = public';
  RAISE NOTICE '';
  RAISE NOTICE 'These functions are now protected against search path attacks.';
END $$;
