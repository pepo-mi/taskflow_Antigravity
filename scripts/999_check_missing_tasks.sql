-- Script to check for any tasks that might be orphaned or in an invalid state
-- Run this to diagnose missing tasks

-- Check for tasks with invalid project references
SELECT 
  t.id,
  t.title,
  t.description,
  t.status,
  t.project_id,
  t.created_at,
  t.updated_at,
  'Invalid project reference' as issue
FROM public.tasks t
LEFT JOIN public.projects p ON t.project_id = p.id
WHERE p.id IS NULL;

-- Check for tasks with invalid user references
SELECT 
  t.id,
  t.title,
  t.description,
  t.status,
  t.assigned_to,
  t.created_by,
  t.created_at,
  t.updated_at,
  CASE 
    WHEN u_assigned.id IS NULL AND t.assigned_to IS NOT NULL THEN 'Invalid assigned_to reference'
    WHEN u_created.id IS NULL THEN 'Invalid created_by reference'
  END as issue
FROM public.tasks t
LEFT JOIN public.users u_assigned ON t.assigned_to = u_assigned.id
LEFT JOIN public.users u_created ON t.created_by = u_created.id
WHERE (u_assigned.id IS NULL AND t.assigned_to IS NOT NULL) 
   OR u_created.id IS NULL;

-- Check all tasks in the "SM tasks in HyeConnect" workspace
SELECT 
  w.name as workspace_name,
  p.name as project_name,
  t.id as task_id,
  t.title,
  t.description,
  t.status,
  t.created_at,
  t.updated_at,
  u_created.full_name as created_by_name,
  u_assigned.full_name as assigned_to_name
FROM public.tasks t
JOIN public.projects p ON t.project_id = p.id
JOIN public.workspaces w ON p.workspace_id = w.id
LEFT JOIN public.users u_created ON t.created_by = u_created.id
LEFT JOIN public.users u_assigned ON t.assigned_to = u_assigned.id
WHERE w.name = 'HyeConnect'
ORDER BY t.created_at DESC;

-- Count tasks by status in HyeConnect workspace
SELECT 
  w.name as workspace_name,
  t.status,
  COUNT(*) as task_count
FROM public.tasks t
JOIN public.projects p ON t.project_id = p.id
JOIN public.workspaces w ON p.workspace_id = w.id
WHERE w.name = 'HyeConnect'
GROUP BY w.name, t.status
ORDER BY t.status;
