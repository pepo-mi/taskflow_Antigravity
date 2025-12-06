import os
from supabase import create_client

# Get Supabase credentials from environment
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("❌ Missing Supabase credentials")
    exit(1)

# Create Supabase client
supabase = create_client(supabase_url, supabase_key)

print("🔧 Adding privileges column to guest_users table...")

# Read and execute the migration
with open("scripts/027_add_privileges_to_guest_users.sql", "r") as f:
    sql = f.read()

try:
    # Execute the SQL
    result = supabase.rpc("exec_sql", {"sql": sql}).execute()
    print("✅ Migration completed successfully!")
    print("   - Added privileges column to guest_users table")
    print("   - Set default privileges for existing guest users")
except Exception as e:
    # If RPC doesn't exist, try direct execution
    print(f"⚠️  RPC method not available, attempting direct execution...")
    print(f"   Error: {e}")
    print("\n📋 Please run this SQL manually in your Supabase SQL editor:")
    print("\n" + "="*60)
    print(sql)
    print("="*60)
    print("\n✅ After running the SQL, guest user creation will work properly!")
