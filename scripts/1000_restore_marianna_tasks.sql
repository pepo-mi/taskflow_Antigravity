-- Find and restore Marianna's tasks in HyeConnect workspace

-- First, let's find Marianna's user ID and HyeConnect workspace
DO $$
DECLARE
  marianna_id UUID;
  hyeconnect_workspace_id UUID;
  hyeconnect_project_id UUID;
  rec RECORD;
BEGIN
  -- Find Marianna by email instead of name for accuracy
  SELECT id INTO marianna_id FROM public.users WHERE email = 'marianna@proper.am' LIMIT 1;
  
  IF marianna_id IS NULL THEN
    SELECT id INTO marianna_id FROM public.guest_users WHERE email = 'marianna@proper.am' LIMIT 1;
  END IF;

  -- Find HyeConnect workspace
  SELECT id INTO hyeconnect_workspace_id FROM public.workspaces WHERE name ILIKE '%HyeConnect%' LIMIT 1;

  -- Find the project in HyeConnect (likely "SM tasks" or similar)
  SELECT id INTO hyeconnect_project_id 
  FROM public.projects 
  WHERE workspace_id = hyeconnect_workspace_id 
  LIMIT 1;

  -- Display what we found
  RAISE NOTICE 'Marianna ID: %', marianna_id;
  RAISE NOTICE 'HyeConnect Workspace ID: %', hyeconnect_workspace_id;
  RAISE NOTICE 'HyeConnect Project ID: %', hyeconnect_project_id;

  -- Fixed query to join through projects table to get workspace
  RAISE NOTICE '--- Tasks edited by Marianna in HyeConnect ---';
  
  FOR rec IN 
    SELECT 
      t.id,
      t.title,
      t.status,
      t.created_at,
      t.updated_at,
      t.project_id,
      p.workspace_id,
      COALESCE(u.full_name, gu.full_name) as creator_name,
      COALESCE(u2.full_name, gu2.full_name) as assignee_name
    FROM public.tasks t
    LEFT JOIN public.projects p ON t.project_id = p.id
    LEFT JOIN public.users u ON t.created_by = u.id
    LEFT JOIN public.guest_users gu ON t.created_by = gu.id
    LEFT JOIN public.users u2 ON t.assigned_to = u2.id
    LEFT JOIN public.guest_users gu2 ON t.assigned_to = gu2.id
    WHERE p.workspace_id = hyeconnect_workspace_id
    AND (t.created_by = marianna_id OR t.assigned_to = marianna_id)
    ORDER BY t.updated_at DESC
  LOOP
    RAISE NOTICE 'Task: % | Title: % | Status: % | Project ID: % | Workspace ID: %', 
      rec.id, rec.title, rec.status, rec.project_id, rec.workspace_id;
  END LOOP;

  -- Check for tasks with NULL project_id (workspace_id doesn't exist on tasks table)
  RAISE NOTICE '--- Tasks with missing project_id ---';
  
  FOR rec IN 
    SELECT id, title, project_id
    FROM public.tasks
    WHERE (created_by = marianna_id OR assigned_to = marianna_id)
    AND project_id IS NULL
  LOOP
    RAISE NOTICE 'Task % ("%") has NULL project_id', 
      rec.id, rec.title;
    
    -- Fix the task by setting the correct project_id
    UPDATE public.tasks
    SET project_id = hyeconnect_project_id
    WHERE id = rec.id;
    
    RAISE NOTICE 'Fixed task % by setting project_id to %', rec.id, hyeconnect_project_id;
  END LOOP;

END $$;

-- Fixed final query to join through projects table
SELECT 
  COUNT(*) as total_tasks,
  t.status,
  COALESCE(u.full_name, gu.full_name) as creator_name
FROM public.tasks t
LEFT JOIN public.projects p ON t.project_id = p.id
LEFT JOIN public.users u ON t.created_by = u.id
LEFT JOIN public.guest_users gu ON t.created_by = gu.id
WHERE p.workspace_id IN (SELECT id FROM public.workspaces WHERE name ILIKE '%HyeConnect%')
AND (t.created_by IN (SELECT id FROM public.users WHERE email = 'marianna@proper.am')
     OR t.created_by IN (SELECT id FROM public.guest_users WHERE email = 'marianna@proper.am')
     OR t.assigned_to IN (SELECT id FROM public.users WHERE email = 'marianna@proper.am')
     OR t.assigned_to IN (SELECT id FROM public.guest_users WHERE email = 'marianna@proper.am'))
GROUP BY t.status, creator_name
ORDER BY t.status;
