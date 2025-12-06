-- Allow all authenticated users to delete projects
-- This removes the creator-only restriction and enables collaborative project management

-- =============================================================================
-- PART 1: Update Projects Table RLS Policy
-- =============================================================================

-- Drop the restrictive creator-only delete policy
DROP POLICY IF EXISTS "projects_delete_creator" ON public.projects;

-- Create new policy that allows any authenticated user to delete projects
CREATE POLICY "projects_delete_authenticated" ON public.projects
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- =============================================================================
-- PART 2: Verification
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Project Deletion Policy Updated:';
  RAISE NOTICE '- Removed creator-only restriction';
  RAISE NOTICE '- Any authenticated user can now delete projects';
  RAISE NOTICE '- This enables collaborative project management';
END $$;

-- Add comment for documentation
COMMENT ON POLICY "projects_delete_authenticated" ON public.projects IS 
  'Allows any authenticated user to delete projects, enabling collaborative management';
