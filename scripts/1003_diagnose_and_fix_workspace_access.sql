DO $$
DECLARE
  peno_auth_id UUID;
  peno_user_record RECORD;
  workspace_count INTEGER;
  test_workspace_id UUID;
BEGIN
  RAISE NOTICE '=== DIAGNOSING WORKSPACE ACCESS FOR peno@proper.am ===';
  RAISE NOTICE '';
  
  -- Step 1: Check if user exists in auth.users
  RAISE NOTICE '1. Checking auth.users...';
  SELECT id INTO peno_auth_id 
  FROM auth.users 
  WHERE email = 'peno@proper.am';
  
  IF peno_auth_id IS NULL THEN
    RAISE NOTICE '   ❌ User NOT found in auth.users';
    RAISE NOTICE '   → Need to recreate user via admin recovery';
  ELSE
    RAISE NOTICE '   ✓ User found in auth.users with ID: %', peno_auth_id;
  END IF;
  
  RAISE NOTICE '';
  
  -- Step 2: Check if user exists in public.users
  RAISE NOTICE '2. Checking public.users...';
  SELECT * INTO peno_user_record 
  FROM public.users 
  WHERE email = 'peno@proper.am';
  
  IF peno_user_record IS NULL THEN
    RAISE NOTICE '   ❌ User NOT found in public.users';
    IF peno_auth_id IS NOT NULL THEN
      RAISE NOTICE '   → Creating user record...';
      INSERT INTO public.users (id, email, full_name, role, organization)
      VALUES (peno_auth_id, 'peno@proper.am', 'Peno Admin', 'admin', 'proper.am');
      RAISE NOTICE '   ✓ User record created';
    END IF;
  ELSE
    RAISE NOTICE '   ✓ User found in public.users';
    RAISE NOTICE '     - ID: %', peno_user_record.id;
    RAISE NOTICE '     - Email: %', peno_user_record.email;
    RAISE NOTICE '     - Role: %', peno_user_record.role;
    RAISE NOTICE '     - Organization: %', peno_user_record.organization;
    
    -- Fix role if not admin
    IF peno_user_record.role != 'admin' THEN
      RAISE NOTICE '   ⚠ Role is not admin, fixing...';
      UPDATE public.users SET role = 'admin' WHERE id = peno_user_record.id;
      RAISE NOTICE '   ✓ Role updated to admin';
    END IF;
    
    -- Fix organization if not proper.am
    IF peno_user_record.organization != 'proper.am' THEN
      RAISE NOTICE '   ⚠ Organization is not proper.am, fixing...';
      UPDATE public.users SET organization = 'proper.am' WHERE id = peno_user_record.id;
      RAISE NOTICE '   ✓ Organization updated to proper.am';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  
  -- Step 3: Check workspaces
  RAISE NOTICE '3. Checking workspaces...';
  SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
  RAISE NOTICE '   Total workspaces in database: %', workspace_count;
  
  IF workspace_count = 0 THEN
    RAISE NOTICE '   ❌ No workspaces found in database';
    RAISE NOTICE '   → Workspaces may have been deleted';
  ELSE
    RAISE NOTICE '   ✓ Workspaces exist:';
    FOR test_workspace_id IN 
      SELECT id FROM public.workspaces LIMIT 5
    LOOP
      RAISE NOTICE '     - Workspace ID: %', test_workspace_id;
    END LOOP;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== DIAGNOSIS COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. If user exists but workspaces don''t show: Log out and log back in';
  RAISE NOTICE '2. If no workspaces exist: They were deleted and cannot be recovered';
  RAISE NOTICE '3. If user doesn''t exist: Run admin recovery again';
  
END $$;
