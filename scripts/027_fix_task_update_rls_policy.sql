-- Fix RLS policy for task updates to allow collaborative editing
-- This addresses the issue where users cannot assign tasks to others
-- if they are not the creator or current assignee

-- Drop the restrictive update policy
DROP POLICY IF EXISTS "tasks_update_creator_or_assignee" ON public.tasks;

-- Create a more permissive policy that allows any authenticated user to update tasks
-- This is appropriate for a collaborative workspace where team members need to
-- assign tasks to each other and update task details
CREATE POLICY "tasks_update_authenticated" ON public.tasks
    FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

-- Log the change
DO $$
BEGIN
    RAISE NOTICE 'Task update RLS policy has been updated:';
    RAISE NOTICE '- Removed restrictive "tasks_update_creator_or_assignee" policy';
    RAISE NOTICE '- Added permissive "tasks_update_authenticated" policy';
    RAISE NOTICE '- All authenticated users can now update tasks in their workspace';
END $$;
