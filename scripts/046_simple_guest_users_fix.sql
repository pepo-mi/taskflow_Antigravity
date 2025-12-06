-- Simple fix for guest_users_select RLS policy
-- Wraps auth.jwt() in scalar subquery for performance

-- Drop existing policy
DROP POLICY IF EXISTS "guest_users_select" ON public.guest_users;

-- Create optimized policy with scalar subquery
CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT 
  TO authenticated
  USING (
    email = ((SELECT auth.jwt()) ->> 'email')
    OR 
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = (SELECT auth.uid()) 
      AND users.role = 'admin'
    )
  );

-- Ensure email index exists for performance
CREATE INDEX IF NOT EXISTS idx_guest_users_email ON public.guest_users(email);

-- Update statistics
ANALYZE public.guest_users;
