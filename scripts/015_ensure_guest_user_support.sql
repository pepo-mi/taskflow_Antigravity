-- Ensure guest user support is properly configured
-- This script ensures the foreign key constraint is removed and guest users can be created

-- Drop any remaining foreign key constraints on users.id
DO $$ 
BEGIN
    -- Drop the foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_id_fkey' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;
        RAISE NOTICE 'Dropped foreign key constraint users_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint users_id_fkey does not exist';
    END IF;
END $$;

-- Ensure the check constraint exists for guest user validation
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_id_auth_check' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT users_id_auth_check;
    END IF;
    
    -- Add the check constraint
    ALTER TABLE public.users ADD CONSTRAINT users_id_auth_check 
    CHECK (
      (role = 'guest') OR 
      (role != 'guest' AND id IN (SELECT id FROM auth.users))
    );
    
    RAISE NOTICE 'Added check constraint for guest user validation';
END $$;

-- Verify the constraint was removed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_id_fkey' 
        AND table_name = 'users'
    ) THEN
        RAISE NOTICE 'SUCCESS: Foreign key constraint users_id_fkey has been removed';
    ELSE
        RAISE NOTICE 'ERROR: Foreign key constraint users_id_fkey still exists';
    END IF;
END $$;
