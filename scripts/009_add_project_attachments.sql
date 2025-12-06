-- Add project_id column to file_attachments table to support direct project attachments
ALTER TABLE public.file_attachments 
ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Update the constraint to allow either post_id OR project_id (but not both null)
ALTER TABLE public.file_attachments 
ADD CONSTRAINT file_attachments_reference_check 
CHECK (
  (post_id IS NOT NULL AND project_id IS NULL) OR 
  (post_id IS NULL AND project_id IS NOT NULL)
);

-- Create index for better performance on project attachments
CREATE INDEX IF NOT EXISTS idx_file_attachments_project_id ON public.file_attachments(project_id);

-- Update RLS policies to handle project attachments
DROP POLICY IF EXISTS "Users can view file attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can upload file attachments" ON public.file_attachments;

-- New RLS policies that handle both post and project attachments
CREATE POLICY "Users can view file attachments" ON public.file_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.organization = 'proper.am'
    )
  );

CREATE POLICY "Users can upload file attachments" ON public.file_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.organization = 'proper.am'
    ) AND auth.uid() = uploaded_by
  );

CREATE POLICY "Users can delete their own file attachments" ON public.file_attachments
  FOR DELETE USING (auth.uid() = uploaded_by);
