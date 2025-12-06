-- Fix guest_users_select RLS policy for performance
-- Wraps auth.jwt() in scalar subquery to prevent per-row evaluation

-- Drop the existing policy
DROP POLICY IF EXISTS "guest_users_select" ON public.guest_users;

-- Create the optimized policy with correct syntax
CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT 
  TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'email') = email OR
    public.is_admin()
  );

-- Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_guest_users_email ON public.guest_users(email);

-- Analyze the table to update query planner statistics
ANALYZE public.guest_users;
