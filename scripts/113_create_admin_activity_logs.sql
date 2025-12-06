-- ============================================================================
-- CREATE ADMIN ACTIVITY LOGS TABLE
-- This table logs admin actions for auditing purposes
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_id UUID,
  target_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_id ON public.admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action ON public.admin_activity_logs(action);

-- Enable RLS
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage activity logs
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.admin_activity_logs;
CREATE POLICY "Admins can view activity logs" ON public.admin_activity_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert activity logs" ON public.admin_activity_logs;
CREATE POLICY "Admins can insert activity logs" ON public.admin_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

COMMIT;
