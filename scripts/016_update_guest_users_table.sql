-- Add id column to guest_users table to link with auth.users
-- This allows guest users to authenticate and receive password emails

-- First, drop the existing table if it exists (since we're changing the structure)
DROP TABLE IF EXISTS guest_users;

-- Recreate guest_users table with proper auth integration
CREATE TABLE guest_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guest',
  organization TEXT NOT NULL DEFAULT 'external',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE guest_users ENABLE ROW LEVEL SECURITY;

-- Create policies for guest_users
CREATE POLICY "Guest users can view their own profile" ON guest_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage all guest users" ON guest_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_guest_users_updated_at 
  BEFORE UPDATE ON guest_users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
