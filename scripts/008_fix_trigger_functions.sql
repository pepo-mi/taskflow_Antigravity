-- Fix remaining trigger functions that still have mutable search_path
-- These are the actual trigger functions that were causing the security warnings

-- Fix log_archive_operation trigger function
CREATE OR REPLACE FUNCTION public.log_archive_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Log archiving operation
  IF NEW.archived = true AND OLD.archived = false THEN
    INSERT INTO public.archive_audit_log (project_id, action, performed_by, project_name, workspace_name)
    SELECT NEW.id, 'archived', auth.uid(), NEW.name, w.name
    FROM public.workspaces w WHERE w.id = NEW.workspace_id;
  END IF;
  
  -- Log restore operation
  IF NEW.archived = false AND OLD.archived = true THEN
    INSERT INTO public.archive_audit_log (project_id, action, performed_by, project_name, workspace_name)
    SELECT NEW.id, 'restored', auth.uid(), NEW.name, w.name
    FROM public.workspaces w WHERE w.id = NEW.workspace_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix validate_archive_operation trigger function
CREATE OR REPLACE FUNCTION public.validate_archive_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow archiving if user is admin
  IF NEW.archived = true AND OLD.archived = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only administrators can archive projects';
    END IF;
  END IF;
  
  -- Only allow restoring if user is admin
  IF NEW.archived = false AND OLD.archived = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users 
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
$function$;

-- Verify the fixes
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    CASE WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 'FIXED' ELSE 'NEEDS FIX' END as status
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
AND p.proname IN ('handle_new_user', 'log_archive_operation', 'validate_archive_operation')
ORDER BY p.proname, pg_get_function_arguments(p.oid);
