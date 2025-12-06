-- Performance optimization based on Supabase linter suggestions
-- Adds missing foreign key indexes and removes unused indexes

-- ============================================================================
-- ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================
-- These foreign keys are queried frequently but lack covering indexes

-- Index for archive_audit_log.performed_by foreign key
CREATE INDEX IF NOT EXISTS idx_archive_audit_log_performed_by 
ON archive_audit_log(performed_by);

-- Index for archive_audit_log.project_id foreign key
CREATE INDEX IF NOT EXISTS idx_archive_audit_log_project_id 
ON archive_audit_log(project_id);

-- Index for posts.parent_id foreign key (for reply lookups)
CREATE INDEX IF NOT EXISTS idx_posts_parent_id 
ON posts(parent_id);

-- ============================================================================
-- REMOVE UNUSED INDEXES
-- ============================================================================
-- These indexes have never been used and can be safely removed
-- Note: Keeping some indexes that might be used in future features

-- File attachments - remove unused indexes
DROP INDEX IF EXISTS idx_file_attachments_post_id;
DROP INDEX IF EXISTS idx_file_attachments_uploaded_by;

-- Posts - remove unused author_id index (covered by other queries)
DROP INDEX IF EXISTS idx_posts_author_id;

-- Projects - remove redundant archived indexes
DROP INDEX IF EXISTS idx_projects_archived_admin;
DROP INDEX IF EXISTS idx_projects_archived_at;
DROP INDEX IF EXISTS idx_projects_archived_auth;

-- Reactions - remove unused indexes
DROP INDEX IF EXISTS idx_reactions_post_id;
DROP INDEX IF EXISTS idx_reactions_user_id;

-- Workspaces - remove unused indexes
DROP INDEX IF EXISTS idx_workspaces_created_by;
DROP INDEX IF EXISTS idx_workspaces_visibility;
DROP INDEX IF EXISTS idx_workspaces_specific_user_id;

-- Users - remove redundant role indexes (keeping the main ones)
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_role_auth;
DROP INDEX IF EXISTS idx_users_role_admin;
DROP INDEX IF EXISTS idx_users_profile_lookup;
DROP INDEX IF EXISTS idx_users_email_lookup;
DROP INDEX IF EXISTS idx_users_privileges;

-- Notifications - remove unused composite indexes
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_read;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_user_read;
DROP INDEX IF EXISTS idx_notifications_related_type;
DROP INDEX IF EXISTS idx_notifications_related_composite;

-- Tasks - remove unused indexes
DROP INDEX IF EXISTS idx_tasks_creator_assignee;
DROP INDEX IF EXISTS idx_tasks_created_by;

-- Guest users - remove unused indexes
DROP INDEX IF EXISTS idx_guest_users_privileges;
DROP INDEX IF EXISTS idx_guest_users_email;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
-- Update statistics for query planner after index changes

ANALYZE archive_audit_log;
ANALYZE posts;
ANALYZE file_attachments;
ANALYZE projects;
ANALYZE reactions;
ANALYZE workspaces;
ANALYZE users;
ANALYZE notifications;
ANALYZE tasks;
ANALYZE guest_users;
