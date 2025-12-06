-- Add index for posts.parent_id foreign key
-- This improves performance when loading reply threads

CREATE INDEX IF NOT EXISTS idx_posts_parent_id ON public.posts(parent_id);

-- Update query planner statistics
ANALYZE public.posts;
