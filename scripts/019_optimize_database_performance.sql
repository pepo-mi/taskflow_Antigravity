-- Database Performance Optimization Script
-- Addresses Supabase linter recommendations for better query performance

-- Add missing indexes for foreign key constraints
-- These indexes will improve JOIN performance and foreign key constraint checking

-- Index for archive_audit_log.performed_by foreign key
CREATE INDEX IF NOT EXISTS idx_archive_audit_log_performed_by 
ON public.archive_audit_log (performed_by);

-- Index for archive_audit_log.project_id foreign key  
CREATE INDEX IF NOT EXISTS idx_archive_audit_log_project_id 
ON public.archive_audit_log (project_id);

-- Index for posts.parent_id foreign key
CREATE INDEX IF NOT EXISTS idx_posts_parent_id 
ON public.posts (parent_id);

-- Remove unused indexes to improve write performance and reduce storage overhead
-- These indexes are not being used by any queries according to the linter

-- Remove unused file_attachments indexes
DROP INDEX IF EXISTS idx_file_attachments_post_id;
DROP INDEX IF EXISTS idx_file_attachments_uploaded_by;
DROP INDEX IF EXISTS idx_file_attachments_uploader;

-- Remove unused posts indexes
DROP INDEX IF EXISTS idx_posts_author_id;
DROP INDEX IF EXISTS idx_posts_author_auth;

-- Remove unused projects indexes
DROP INDEX IF EXISTS idx_projects_archived_admin;
DROP INDEX IF EXISTS idx_projects_archived_at;
DROP INDEX IF EXISTS idx_projects_completed;
DROP INDEX IF EXISTS idx_projects_archived_auth;

-- Remove unused reactions indexes
DROP INDEX IF EXISTS idx_reactions_post_id;
DROP INDEX IF EXISTS idx_reactions_user_id;

-- Remove unused workspaces indexes
DROP INDEX IF EXISTS idx_workspaces_created_by;
DROP INDEX IF EXISTS idx_workspaces_visibility;
DROP INDEX IF EXISTS idx_workspaces_specific_user_id;

-- Remove unused users indexes
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_role_auth;

-- Remove unused notifications indexes
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_read;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_user_read;

-- Remove unused tasks indexes
DROP INDEX IF EXISTS idx_tasks_creator_assignee;

-- Analyze tables to update query planner statistics after index changes
ANALYZE public.archive_audit_log;
ANALYZE public.posts;
ANALYZE public.file_attachments;
ANALYZE public.projects;
ANALYZE public.reactions;
ANALYZE public.workspaces;
ANALYZE public.users;
ANALYZE public.notifications;
ANALYZE public.tasks;

-- Log completion
INSERT INTO public.migration_log (script_name, executed_at, description) 
VALUES (
    '019_optimize_database_performance.sql',
    NOW(),
    'Added missing foreign key indexes and removed unused indexes for better performance'
);
