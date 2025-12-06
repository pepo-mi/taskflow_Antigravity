-- ============================================================================
-- UNIFIED RLS FIX SCRIPT
-- Combines fixes for:
-- 1. Guest Users RLS performance warning (Script 102)
-- 2. File Attachments INSERT duplicate policies (Script 103)
-- 3. File Attachments SELECT duplicate policies (Script 104)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. OPTIMIZE GUEST_USERS RLS POLICY
-- ============================================================================
-- Drop the potentially unoptimized policy
DROP POLICY IF EXISTS "guest_users_select" ON public.guest_users;

-- Recreate it with guaranteed scalar execution for auth.jwt()
CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT 
  TO authenticated
  USING (
    -- Wrap auth.jwt() access in a scalar subquery cast to text
    -- This ensures evaluation happens once per statement
    ((SELECT auth.jwt() ->> 'email')::text = email)
    OR
    public.is_admin()
  );

COMMENT ON POLICY "guest_users_select" ON public.guest_users IS 'Optimized: Uses (SELECT auth.jwt()) to prevent per-row evaluation';


-- ============================================================================
-- 2. CONSOLIDATE FILE_ATTACHMENTS INSERT POLICIES
-- ============================================================================
-- Drop the duplicate policies
DROP POLICY IF EXISTS "file_attachments_insert" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can upload file attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "file_attachments_insert_consolidated" ON public.file_attachments; -- Safety drop

-- Create the unified, optimized policy
CREATE POLICY "file_attachments_insert_consolidated" ON public.file_attachments
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
        JOIN public.posts po ON po.project_id = p.id
        WHERE gwa.guest_id = (SELECT auth.uid()) 
          AND po.id = post_id
      )
    ) 
    -- Common requirement: Authenticated user must be the uploader
    AND (SELECT auth.uid()) = uploaded_by
  );

COMMENT ON POLICY "file_attachments_insert_consolidated" ON public.file_attachments 
IS 'Consolidated: Allows inserts for Proper.am users OR authorized guests. Uses scalar subqueries for performance.';


-- ============================================================================
-- 3. CONSOLIDATE FILE_ATTACHMENTS SELECT POLICIES
-- ============================================================================
-- Drop the duplicate policies
DROP POLICY IF EXISTS "file_attachments_select" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can view file attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "file_attachments_select_consolidated" ON public.file_attachments; -- Safety drop

-- Create the unified, optimized policy
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
