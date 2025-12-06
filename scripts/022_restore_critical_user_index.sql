-- Restore Critical User Index for Profile Query Performance
-- The users table primary key index should handle id lookups, but let's ensure optimal performance

-- Add index on users.id if it doesn't exist (should be automatic as primary key)
-- This ensures fast profile lookups by user ID
CREATE INDEX IF NOT EXISTS idx_users_id_lookup 
ON public.users (id);

-- Add composite index for common profile query patterns
CREATE INDEX IF NOT EXISTS idx_users_profile_lookup 
ON public.users (id, email, role) 
WHERE id IS NOT NULL;

-- Analyze the users table to update query planner statistics
ANALYZE public.users;

-- Log completion
INSERT INTO public.migration_log (script_name, executed_at, description) 
VALUES (
    '022_restore_critical_user_index.sql',
    NOW(),
    'Restored critical user indexes for optimal profile query performance'
);
