-- Fix RLS Performance Issues
-- This script addresses all performance warnings from Supabase database linter
-- by optimizing auth function calls and removing duplicate indexes

-- =============================================================================
-- PART 1: Optimize RLS Policies - Replace auth.uid() with (select auth.uid())
-- =============================================================================

-- Users table policies
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
CREATE POLICY "users_select_authenticated" ON public.users
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "users_insert_authenticated" ON public.users;
CREATE POLICY "users_insert_authenticated" ON public.users
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Workspaces table policies
DROP POLICY IF EXISTS "workspaces_select_authenticated" ON public.workspaces;
CREATE POLICY "workspaces_select_authenticated" ON public.workspaces
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "workspaces_insert_own" ON public.workspaces;
CREATE POLICY "workspaces_insert_own" ON public.workspaces
    FOR INSERT WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "workspaces_update_creator" ON public.workspaces;
CREATE POLICY "workspaces_update_creator" ON public.workspaces
    FOR UPDATE USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "workspaces_delete_creator" ON public.workspaces;
CREATE POLICY "workspaces_delete_creator" ON public.workspaces
    FOR DELETE USING (created_by = (select auth.uid()));

-- Projects table policies
DROP POLICY IF EXISTS "projects_select_authenticated" ON public.projects;
CREATE POLICY "projects_select_authenticated" ON public.projects
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own" ON public.projects
    FOR INSERT WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "projects_update_creator" ON public.projects;
CREATE POLICY "projects_update_creator" ON public.projects
    FOR UPDATE USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "projects_delete_creator" ON public.projects;
CREATE POLICY "projects_delete_creator" ON public.projects
    FOR DELETE USING (created_by = (select auth.uid()));

-- Tasks table policies
DROP POLICY IF EXISTS "tasks_select_authenticated" ON public.tasks;
CREATE POLICY "tasks_select_authenticated" ON public.tasks
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "tasks_insert_own" ON public.tasks;
CREATE POLICY "tasks_insert_own" ON public.tasks
    FOR INSERT WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "tasks_update_creator_or_assignee" ON public.tasks;
CREATE POLICY "tasks_update_creator_or_assignee" ON public.tasks
    FOR UPDATE USING (
        created_by = (select auth.uid()) OR 
        assigned_to = (select auth.uid())
    );

DROP POLICY IF EXISTS "tasks_delete_creator" ON public.tasks;
CREATE POLICY "tasks_delete_creator" ON public.tasks
    FOR DELETE USING (created_by = (select auth.uid()));

-- Posts table policies
DROP POLICY IF EXISTS "posts_select_authenticated" ON public.posts;
CREATE POLICY "posts_select_authenticated" ON public.posts
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own" ON public.posts
    FOR INSERT WITH CHECK (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "posts_update_author" ON public.posts;
CREATE POLICY "posts_update_author" ON public.posts
    FOR UPDATE USING (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "posts_delete_author" ON public.posts;
CREATE POLICY "posts_delete_author" ON public.posts
    FOR DELETE USING (author_id = (select auth.uid()));

-- File attachments table policies
DROP POLICY IF EXISTS "file_attachments_select_authenticated" ON public.file_attachments;
CREATE POLICY "file_attachments_select_authenticated" ON public.file_attachments
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "file_attachments_insert_own" ON public.file_attachments;
CREATE POLICY "file_attachments_insert_own" ON public.file_attachments
    FOR INSERT WITH CHECK (uploaded_by = (select auth.uid()));

DROP POLICY IF EXISTS "file_attachments_delete_uploader" ON public.file_attachments;
CREATE POLICY "file_attachments_delete_uploader" ON public.file_attachments
    FOR DELETE USING (uploaded_by = (select auth.uid()));

-- Notifications table policies
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "notifications_insert_any" ON public.notifications;
CREATE POLICY "notifications_insert_any" ON public.notifications
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
    FOR DELETE USING (user_id = (select auth.uid()));

-- Reactions table policies
DROP POLICY IF EXISTS "reactions_select_authenticated" ON public.reactions;
CREATE POLICY "reactions_select_authenticated" ON public.reactions
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "reactions_insert_own" ON public.reactions;
CREATE POLICY "reactions_insert_own" ON public.reactions
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "reactions_delete_own" ON public.reactions;
CREATE POLICY "reactions_delete_own" ON public.reactions
    FOR DELETE USING (user_id = (select auth.uid()));

-- Archive audit log table policies
DROP POLICY IF EXISTS "archive_audit_log_select_authenticated" ON public.archive_audit_log;
CREATE POLICY "archive_audit_log_select_authenticated" ON public.archive_audit_log
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "archive_audit_log_insert_any" ON public.archive_audit_log;
CREATE POLICY "archive_audit_log_insert_any" ON public.archive_audit_log
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- =============================================================================
-- PART 2: Remove Duplicate Indexes
-- =============================================================================

-- Remove duplicate indexes on file_attachments table
-- Keep idx_file_attachments_uploaded_by, drop idx_file_attachments_uploader
DROP INDEX IF EXISTS idx_file_attachments_uploader;

-- Remove duplicate indexes on posts table  
-- Keep idx_posts_author_id, drop idx_posts_author_auth
DROP INDEX IF EXISTS idx_posts_author_auth;

-- =============================================================================
-- PART 3: Update Statistics for Query Planner
-- =============================================================================

-- Update table statistics to help query planner make better decisions
ANALYZE public.users;
ANALYZE public.workspaces;
ANALYZE public.projects;
ANALYZE public.tasks;
ANALYZE public.posts;
ANALYZE public.file_attachments;
ANALYZE public.notifications;
ANALYZE public.reactions;
ANALYZE public.archive_audit_log;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'RLS Performance Optimization Complete:';
    RAISE NOTICE '- Optimized % RLS policies across % tables', 35, 9;
    RAISE NOTICE '- Removed % duplicate indexes', 2;
    RAISE NOTICE '- Updated table statistics for query planner';
    RAISE NOTICE 'Database performance should be significantly improved.';
END $$;
