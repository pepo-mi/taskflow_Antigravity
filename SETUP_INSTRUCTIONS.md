# TaskFlow Setup Instructions

## Environment Variables Setup

### Required for Development

To enable email confirmation redirects during development, you need to set up the `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` environment variable.

#### Steps:

1. **In Vercel Dashboard** (if deploying to Vercel):
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add a new variable:
     - **Name**: `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`
     - **Value**: `http://localhost:3000/auth/callback` (for local development)
     - Or: `https://your-preview-url.vercel.app/auth/callback` (for preview deployments)
   - Click "Save"

2. **In v0 Workspace** (current environment):
   - Click the gear icon (⚙️) in the top right
   - Select "Environment Variables"
   - Add:
     - **Key**: `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`
     - **Value**: The URL where users should be redirected after email confirmation
   - Click "Save"

3. **For Local Development** (if running locally):
   - Create a `.env.local` file in your project root
   - Add:
     \`\`\`
     NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
     \`\`\`

### What This Variable Does

When users sign up with email/password, Supabase sends a confirmation email. The `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` tells Supabase where to redirect users after they click the confirmation link in their email.

- **Development**: Redirects to your local development server
- **Production**: Falls back to `window.location.origin` (your deployed URL)

### Current Environment Variables

Your workspace already has these Supabase variables configured:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `POSTGRES_*` (database connection strings)

You just need to add the redirect URL for email confirmations.

---

## Database Setup

### Running SQL Scripts

The SQL scripts in the `scripts/` folder need to be run in order. The latest fix is:

**`038_fix_jwt_admin_checks.sql`** - Fixes the infinite recursion and JWT role check issues

#### To Run Scripts:

1. **In v0** (recommended):
   - Scripts are automatically detected
   - Click "Run Script" when prompted
   - Or use the Scripts panel in the UI

2. **In Supabase Dashboard** (alternative):
   - Go to your Supabase project
   - Navigate to "SQL Editor"
   - Copy the contents of `scripts/038_fix_jwt_admin_checks.sql`
   - Paste and click "Run"

### What the Latest Script Fixes

The `038_fix_jwt_admin_checks.sql` script:
- ✅ Removes broken JWT role checks (JWT doesn't contain role by default)
- ✅ Creates an `is_admin()` helper function that safely checks admin status
- ✅ Rebuilds all RLS policies to avoid infinite recursion
- ✅ Maintains proper security while fixing performance issues

---

## Authentication Flow

### Allowed Users

- **Admin**: `peno@proper.am` (full access)
- **Users**: Any `@proper.am` email (can create projects and tasks)
- **Guests**: External emails (read-only, must be invited by admin)

### Sign Up Process

1. User enters email and password
2. Supabase sends confirmation email
3. User clicks link in email
4. Redirects to `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`
5. Auth callback processes the confirmation
6. User is redirected to dashboard

### Demo Mode

If Supabase is not configured, the app falls back to demo mode:
- Creates temporary demo users
- Allows testing without database
- Perfect for v0 preview environment

---

## Troubleshooting

### "Cannot setup development auth redirect"

**Solution**: Add the `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` environment variable as described above.

### "SQL execution run errors"

**Solution**: Run the latest script `038_fix_jwt_admin_checks.sql` to fix RLS policies.

### "Infinite recursion" or "JWT role" errors

**Solution**: The `038_fix_jwt_admin_checks.sql` script specifically fixes these issues by:
- Replacing JWT role checks with a proper `is_admin()` function
- Using subqueries to avoid circular dependencies
- Simplifying policies to reduce overhead

### Email confirmation not working

**Possible causes**:
1. `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` not set
2. Supabase email settings not configured
3. Email provider (SMTP) not set up in Supabase

**Solution**: 
- Set the redirect URL environment variable
- Check Supabase dashboard → Authentication → Email Templates
- Verify SMTP settings in Supabase dashboard → Project Settings → Auth

---

## Next Steps

1. ✅ Add `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` to environment variables
2. ✅ Run `scripts/038_fix_jwt_admin_checks.sql` in Supabase
3. ✅ Test sign up flow with a `@proper.am` email
4. ✅ Verify email confirmation redirect works
5. ✅ Check that RLS policies work without errors

---

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check Supabase logs in the dashboard
3. Verify all environment variables are set correctly
4. Ensure the latest SQL script has been run
