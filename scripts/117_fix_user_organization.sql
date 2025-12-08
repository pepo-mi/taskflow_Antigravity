-- ============================================================================
-- FIX: Update organization for users with 'default' to 'proper.am'
-- This fixes the RLS policy issue where users can't see workspaces
-- ============================================================================

-- First, check what users have organization = 'default'
SELECT id, email, organization FROM public.users WHERE organization = 'default';

-- Update them to 'proper.am'
UPDATE public.users 
SET organization = 'proper.am' 
WHERE organization = 'default';

-- Verify the update
SELECT id, email, organization FROM public.users ORDER BY email;
