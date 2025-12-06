import os
from supabase import create_client, Client

# Get Supabase credentials from environment
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("Error: Missing Supabase credentials")
    exit(1)

# Create Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

print("[v0] Adding privileges column to guest_users table...")

# SQL to add privileges column
alter_table_sql = """
ALTER TABLE public.guest_users 
ADD COLUMN IF NOT EXISTS privileges jsonb DEFAULT '{
  "can_create_workspaces": false,
  "can_create_projects": false,
  "can_create_tasks": false
}'::jsonb;
"""

# SQL to update existing rows
update_sql = """
UPDATE public.guest_users 
SET privileges = '{
  "can_create_workspaces": false,
  "can_create_projects": false,
  "can_create_tasks": false
}'::jsonb
WHERE privileges IS NULL;
"""

try:
    # Execute ALTER TABLE
    result1 = supabase.rpc('exec_sql', {'sql': alter_table_sql}).execute()
    print("[v0] ✓ Added privileges column to guest_users table")
    
    # Execute UPDATE
    result2 = supabase.rpc('exec_sql', {'sql': update_sql}).execute()
    print("[v0] ✓ Set default privileges for existing guest users")
    
    print("\n[v0] Migration completed successfully!")
    print("[v0] You can now create guest users with privileges.")
    
except Exception as e:
    print(f"[v0] Error running migration: {str(e)}")
    print("\n[v0] Trying direct SQL execution...")
    
    try:
        # Try using postgrest directly
        supabase.postgrest.rpc('exec_sql', {'sql': alter_table_sql}).execute()
        print("[v0] ✓ Added privileges column")
        
        supabase.postgrest.rpc('exec_sql', {'sql': update_sql}).execute()
        print("[v0] ✓ Updated existing rows")
        
        print("\n[v0] Migration completed successfully!")
    except Exception as e2:
        print(f"[v0] Error: {str(e2)}")
        print("\n[v0] Please run this SQL manually in Supabase SQL Editor:")
        print(alter_table_sql)
        print(update_sql)
