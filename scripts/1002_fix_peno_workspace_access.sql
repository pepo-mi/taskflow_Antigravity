-- Check and fix peno@proper.am workspace access
DO $$
DECLARE
  peno_user_id UUID;
  peno_email TEXT := 'peno@proper.am';
  workspace_count INTEGER;
  rec RECORD; -- Added RECORD declaration for loop variable
BEGIN
  -- Find peno's user ID
  SELECT id INTO peno_user_id
  FROM public.users
  WHERE email = peno_email;

  IF peno_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: User % not found in public.users table', peno_email;
    RETURN;
  END IF;

  RAISE NOTICE 'Found user: % with ID: %', peno_email, peno_user_id;

  -- Check current user details
  RAISE NOTICE 'Checking user details...';
  PERFORM 1 FROM public.users 
  WHERE id = peno_user_id 
  AND role = 'admin' 
  AND organization = 'proper.am';

  IF NOT FOUND THEN
    RAISE NOTICE 'User is not admin or not in proper.am organization. Fixing...';
    
    -- Update user to be admin in proper.am organization
    UPDATE public.users
    SET 
      role = 'admin',
      organization = 'proper.am',
      updated_at = NOW()
    WHERE id = peno_user_id;
    
    RAISE NOTICE 'Updated user to admin role in proper.am organization';
  ELSE
    RAISE NOTICE 'User is already admin in proper.am organization';
  END IF;

  -- Check how many workspaces exist
  SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
  RAISE NOTICE 'Total workspaces in database: %', workspace_count;

  -- Show all workspaces
  IF workspace_count > 0 THEN
    RAISE NOTICE 'Listing all workspaces:';
    FOR rec IN 
      SELECT w.id, w.name, w.created_by, u.email as creator_email
      FROM public.workspaces w
      LEFT JOIN public.users u ON w.created_by = u.id
    LOOP
      RAISE NOTICE '  - Workspace: % (ID: %, Created by: %)', rec.name, rec.id, rec.creator_email;
    END LOOP;
  ELSE
    RAISE NOTICE 'No workspaces found in database';
  END IF;

  RAISE NOTICE 'Admin workspace access check complete!';
  RAISE NOTICE 'If user still cannot see workspaces, they may need to log out and log back in.';

END $$;
