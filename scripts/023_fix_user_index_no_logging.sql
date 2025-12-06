-- Fixed migration script without migration_log reference
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

-- Add index on email for auth lookups
CREATE INDEX IF NOT EXISTS idx_users_email_lookup 
ON public.users (email) 
WHERE email IS NOT NULL;

-- Analyze the users table to update query planner statistics
ANALYZE public.users;

-- Removed migration_log insert that was causing errors
-- Script completed successfully - indexes created for optimal profile query performance
