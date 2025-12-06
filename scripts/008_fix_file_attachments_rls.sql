-- Fix RLS policies for file_attachments table (was incorrectly named "attachments" in previous script)

-- Drop incorrect policies for "attachments" table
DROP POLICY IF EXISTS "attachments_all_authenticated" ON public.attachments;

-- Create correct policies for "file_attachments" table
CREATE POLICY "file_attachments_all_authenticated" ON public.file_attachments
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure RLS is enabled for file_attachments table
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated role for file_attachments table
GRANT ALL ON public.file_attachments TO authenticated;
