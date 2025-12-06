-- Nuclear option: Drop ALL policies and recreate with zero recursion
-- This script uses dynamic SQL to ensure all old policies are removed

BEGIN;

-- Step 1: Drop ALL policies on ALL tables using dynamic SQL
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on all tables in public schema
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Dropped policy % on %.%', r.policyname, r.schemaname, r.tablename;
    END LOOP;
END $$;

-- Step 2: Create the SIMPLEST possible policies with ZERO recursion

-- ============================================================================
-- USERS TABLE - THE MOST CRITICAL ONE
-- ============================================================================
-- Rule: NEVER query the users table from within a users table policy
-- This is the root cause of infinite recursion

CREATE POLICY "users_select_all" ON public.users
  FOR SELECT 
  TO authenticated
  USING (true);  -- All authenticated users can read all user profiles

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE 
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- No INSERT policy - handled by auth trigger
-- No DELETE policy - users are soft-deleted or deleted via auth.users cascade

-- ============================================================================
-- WORKSPACES TABLE
-- ============================================================================

CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT 
  TO authenticated
  USING (
    created_by = (SELECT auth.uid()) OR
    specific_user_id = (SELECT auth.uid())
  );

CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT 
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE 
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE 
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT 
  TO authenticated
  USING (
    created_by = (SELECT auth.uid()) OR
    workspace_id IN (
      SELECT id FROM public.workspaces 
      WHERE created_by = (SELECT auth.uid()) 
         OR specific_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND
    workspace_id IN (
      SELECT id FROM public.workspaces 
      WHERE created_by = (SELECT auth.uid()) 
         OR specific_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE 
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces 
      WHERE created_by = (SELECT auth.uid()) 
         OR specific_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces 
      WHERE created_by = (SELECT auth.uid()) 
         OR specific_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE 
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces 
      WHERE created_by = (SELECT auth.uid()) 
         OR specific_user_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- TASKS TABLE
-- ============================================================================

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT 
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE created_by = (SELECT auth.uid()) OR
            workspace_id IN (
              SELECT id FROM public.workspaces 
              WHERE created_by = (SELECT auth.uid()) 
                 OR specific_user_id = (SELECT auth.uid())
            )
    )
  );

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid()) 
           OR specific_user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE 
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid()) 
           OR specific_user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid()) 
           OR specific_user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE 
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid()) 
           OR specific_user_id = (SELECT auth.uid())
      )
    )
  );

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT 
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);  -- Any authenticated user can create notifications

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE 
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE 
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- GUEST_USERS TABLE
-- ============================================================================

CREATE POLICY "guest_users_select" ON public.guest_users
  FOR SELECT 
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid()) 
           OR specific_user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "guest_users_insert" ON public.guest_users
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "guest_users_update" ON public.guest_users
  FOR UPDATE 
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "guest_users_delete" ON public.guest_users
  FOR DELETE 
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid())
      )
    )
  );

-- ============================================================================
-- POSTS TABLE (Discussion posts)
-- ============================================================================

CREATE POLICY "posts_select" ON public.posts
  FOR SELECT 
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid()) 
           OR specific_user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "posts_insert" ON public.posts
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid()) AND
    project_id IN (
      SELECT id FROM public.projects 
      WHERE workspace_id IN (
        SELECT id FROM public.workspaces 
        WHERE created_by = (SELECT auth.uid()) 
           OR specific_user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "posts_update" ON public.posts
  FOR UPDATE 
  TO authenticated
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE 
  TO authenticated
  USING (author_id = (SELECT auth.uid()));

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List all policies to verify
DO $$ 
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== Current RLS Policies ===';
    FOR r IN (
        SELECT schemaname, tablename, policyname, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, cmd, policyname
    ) LOOP
        RAISE NOTICE 'Table: %.% | Command: % | Policy: %', 
            r.schemaname, r.tablename, r.cmd, r.policyname;
    END LOOP;
END $$;

COMMIT;
