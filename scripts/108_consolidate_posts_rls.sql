-- ============================================================================
-- CONSOLIDATE POSTS RLS POLICIES
-- Resolves duplicates for INSERT and SELECT on public.posts
--
-- Duplicates to resolve:
-- INSERT: "Users can create posts" vs "posts_insert"
-- SELECT: "Users can view posts in accessible projects" vs "posts_select"
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CONSOLIDATE INSERT POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_consolidated" ON public.posts; -- Safety drop

CREATE POLICY "posts_insert_consolidated" ON public.posts
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    (
      -- Case A: Regular user in 'proper.am' organization
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = (SELECT auth.uid()) 
          AND u.organization = 'proper.am'
      )
      OR
      -- Case B: Guest with access to the workspace via the project
      EXISTS (
        SELECT 1 FROM public.guest_workspace_access gwa
        JOIN public.projects p ON p.workspace_id = gwa.workspace_id
        WHERE gwa.guest_id = (SELECT auth.uid()) 
          AND p.id = project_id
      )
    ) 
    -- Common requirement: Authenticated user must be the author
    AND (SELECT auth.uid()) = author_id
  );

COMMENT ON POLICY "posts_insert_consolidated" ON public.posts 
IS 'Consolidated: Allows inserts for Proper.am users OR authorized guests. Uses scalar subqueries.';


-- ============================================================================
-- 2. CONSOLIDATE SELECT POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view posts in accessible projects" ON public.posts;
DROP POLICY IF EXISTS "posts_select" ON public.posts;
DROP POLICY IF EXISTS "posts_select_consolidated" ON public.posts; -- Safety drop

CREATE POLICY "posts_select_consolidated" ON public.posts
  FOR SELECT 
  TO authenticated
  USING (
    -- Case A: Regular user in 'proper.am' organization
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = (SELECT auth.uid()) 
        AND u.organization = 'proper.am'
    )
    OR
    -- Case B: Guest with access to the workspace via the project
    EXISTS (
      SELECT 1 FROM public.guest_workspace_access gwa
      JOIN public.projects p ON p.workspace_id = gwa.workspace_id
      WHERE gwa.guest_id = (SELECT auth.uid()) 
          AND p.id = project_id
    )
  );

COMMENT ON POLICY "posts_select_consolidated" ON public.posts 
IS 'Consolidated: Allows select for Proper.am users OR authorized guests. Uses scalar subqueries.';

COMMIT;
