-- Add INSERT policy for users to create their own profile
-- This is needed when the auth hook tries to create a profile if it doesn't exist

CREATE POLICY "allow_users_insert_own_profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Also ensure users can read their own profile specifically
CREATE POLICY "allow_users_read_own_profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_attachments TO authenticated;

-- Ensure the authenticated role exists and has proper permissions
GRANT USAGE ON SCHEMA public TO authenticated;
