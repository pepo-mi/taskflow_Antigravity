-- Create a separate table for guest users to avoid foreign key constraints with auth.users
CREATE TABLE IF NOT EXISTS public.guest_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text UNIQUE NOT NULL,
    full_name text NOT NULL,
    role text DEFAULT 'guest' CHECK (role = 'guest'),
    organization text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;

-- Create policies for guest_users table
CREATE POLICY "Admin users can view all guest users" ON public.guest_users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admin users can insert guest users" ON public.guest_users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admin users can update guest users" ON public.guest_users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admin users can delete guest users" ON public.guest_users
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_guest_users_updated_at 
    BEFORE UPDATE ON public.guest_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
