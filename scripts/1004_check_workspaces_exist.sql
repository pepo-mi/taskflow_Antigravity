-- Check if workspaces exist in the database and diagnose access issues

DO $$
DECLARE
  workspace_count INTEGER;
  peno_user_id UUID;
  peno_org TEXT;
  peno_role TEXT;
  rec RECORD; -- Added missing RECORD declaration for loop variable
BEGIN
  -- Check if peno@proper.am exists
  SELECT id, organization, role INTO peno_user_id, peno_org, peno_role
  FROM public.users
  WHERE email = 'peno@proper.am';
  
  IF peno_user_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: peno@proper.am does not exist in public.users table!';
    RAISE NOTICE 'Run the admin recovery script first.';
    RETURN;
  END IF;
  
  RAISE NOTICE '✓ peno@proper.am found:';
  RAISE NOTICE '  - User ID: %', peno_user_id;
  RAISE NOTICE '  - Organization: %', peno_org;
  RAISE NOTICE '  - Role: %', peno_role;
  RAISE NOTICE '';
  
  -- Count total workspaces
  SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
  
  RAISE NOTICE 'Total workspaces in database: %', workspace_count;
  RAISE NOTICE '';
  
  IF workspace_count = 0 THEN
    RAISE NOTICE '❌ NO WORKSPACES FOUND IN DATABASE!';
    RAISE NOTICE 'The workspaces have been deleted or never existed.';
    RAISE NOTICE 'You will need to restore from a backup or recreate them.';
  ELSE
    RAISE NOTICE '✓ Workspaces exist. Listing all workspaces:';
    RAISE NOTICE '';
    
    -- List all workspaces
    FOR rec IN 
      SELECT 
        w.id,
        w.name,
        w.created_at,
        w.created_by,
        u.email as creator_email,
        u.organization as creator_org
      FROM public.workspaces w
      LEFT JOIN public.users u ON w.created_by = u.id
      ORDER BY w.created_at DESC
    LOOP
      RAISE NOTICE 'Workspace: % (ID: %)', rec.name, rec.id;
      RAISE NOTICE '  - Created: %', rec.created_at;
      RAISE NOTICE '  - Created by: % (%)', rec.creator_email, rec.creator_org;
      RAISE NOTICE '';
    END LOOP;
    
    -- Check if peno's organization matches
    IF peno_org != 'proper.am' THEN
      RAISE NOTICE '❌ ISSUE: peno organization is "%" but should be "proper.am"', peno_org;
      RAISE NOTICE 'Fixing organization...';
      UPDATE public.users SET organization = 'proper.am' WHERE id = peno_user_id;
      RAISE NOTICE '✓ Fixed! Organization updated to "proper.am"';
    ELSE
      RAISE NOTICE '✓ Organization is correct: proper.am';
    END IF;
    
    -- Check if peno is admin
    IF peno_role != 'admin' THEN
      RAISE NOTICE '❌ ISSUE: peno role is "%" but should be "admin"', peno_role;
      RAISE NOTICE 'Fixing role...';
      UPDATE public.users SET role = 'admin' WHERE id = peno_user_id;
      RAISE NOTICE '✓ Fixed! Role updated to "admin"';
    ELSE
      RAISE NOTICE '✓ Role is correct: admin';
    END IF;
  END IF;
  
END $$;
