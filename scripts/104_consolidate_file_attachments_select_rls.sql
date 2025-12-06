-- ============================================================================
-- CONSOLIDATE FILE_ATTACHMENTS SELECT POLICIES
-- Resolves conflict between:
-- 1. "file_attachments_select" (potentially from script 040)
-- 2. "Users can view file attachments" (from script 101/048)
--
-- This script replaces both with a single "file_attachments_select_consolidated" policy
-- that includes the comprehensive checks for guest access + org membership.
-- ============================================================================

BEGIN;

-- 1. Drop the duplicate policies
DROP POLICY IF EXISTS "file_attachments_select" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can view file attachments" ON public.file_attachments;

-- 2. Create the unified, optimized policy
-- Uses the comprehensive logic from script 101/048, which correctly handles both
-- regular users (Proper.am org) and guest users (workspace access).
CREATE POLICY "file_attachments_select_consolidated" ON public.file_attachments
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
      JOIN public.posts po ON po.project_id = p.id
      WHERE gwa.guest_id = (SELECT auth.uid()) 
        AND po.id = post_id
    )
  );

COMMENT ON POLICY "file_attachments_select_consolidated" ON public.file_attachments 
IS 'Consolidated: Allows select for Proper.am users OR authorized guests. Uses scalar subqueries for performance.';

COMMIT;
