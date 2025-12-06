-- Create admin_activity_logs table
create table if not exists admin_activity_logs (
    id uuid default gen_random_uuid() primary key,
    admin_id uuid references auth.users(id) not null,
    action_type text not null,
    target_id text,
    target_type text,
    metadata jsonb default '{}'::jsonb,
    ip_address text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table admin_activity_logs enable row level security;

-- Policy: Admins can view all logs
create policy "Admins can view all logs"
    on admin_activity_logs for select
    using (
        exists (
            select 1 from users
            where users.id = auth.uid() and users.role = 'admin'
        )
        or
        exists (
            select 1 from guest_users
            where guest_users.id = auth.uid() and guest_users.role = 'admin'
        )
    );

-- Policy: Admins can insert logs
create policy "Admins can insert logs"
    on admin_activity_logs for insert
    with check (
        exists (
            select 1 from users
            where users.id = auth.uid() and users.role = 'admin'
        )
        or
        exists (
            select 1 from guest_users
            where guest_users.id = auth.uid() and guest_users.role = 'admin'
        )
    );

-- Create index for faster querying by time and actor
create index if not exists idx_admin_activity_logs_created_at on admin_activity_logs(created_at desc);
create index if not exists idx_admin_activity_logs_admin_id on admin_activity_logs(admin_id);
