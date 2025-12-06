-- Restore critical foreign key indexes that were incorrectly removed
-- Foreign key indexes are essential for join performance even if not used yet

-- ============================================================================
-- ADD FOREIGN KEY INDEXES
-- ============================================================================

-- File attachments foreign keys
CREATE INDEX IF NOT EXISTS idx_file_attachments_post_id 
ON file_attachments(post_id);

CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_by 
ON file_attachments(uploaded_by);

-- Notifications foreign key
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id);

-- Posts foreign key
CREATE INDEX IF NOT EXISTS idx_posts_author_id 
ON posts(author_id);

-- Reactions foreign key
CREATE INDEX IF NOT EXISTS idx_reactions_user_id 
ON reactions(user_id);

-- Tasks foreign key
CREATE INDEX IF NOT EXISTS idx_tasks_created_by 
ON tasks(created_by);

-- Workspaces foreign keys
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by 
ON workspaces(created_by);

CREATE INDEX IF NOT EXISTS idx_workspaces_specific_user_id 
ON workspaces(specific_user_id);

-- ============================================================================
-- REMOVE TRULY UNUSED INDEXES FROM ARCHIVE_AUDIT_LOG
-- ============================================================================
-- These indexes on archive_audit_log are genuinely unused and can be removed
-- The table is rarely queried and the foreign key lookups are infrequent

DROP INDEX IF EXISTS idx_archive_audit_log_performed_by;
DROP INDEX IF EXISTS idx_archive_audit_log_project_id;
DROP INDEX IF EXISTS idx_posts_parent_id;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

ANALYZE file_attachments;
ANALYZE notifications;
ANALYZE posts;
ANALYZE reactions;
ANALYZE tasks;
ANALYZE workspaces;
ANALYZE archive_audit_log;
