# Supabase Log Management Checklist

## Problem
Supabase uses Google BigQuery to store and query logs. Free tier has quota limits that can be exhausted by:
- Frequent dashboard log queries
- Large time ranges in log queries
- Automated log analysis
- High-traffic applications generating excessive logs

## Step-by-Step Monitoring & Reduction Checklist

### 1. **Identify Current Log Usage**
- [ ] Go to Supabase Dashboard → Settings → Logs
- [ ] Check the "Query Usage" indicator (if available)
- [ ] Note which log categories are being queried most:
  - Auth logs
  - Database logs  
  - API logs
  - Realtime logs
  - Storage logs

### 2. **Reduce Dashboard Log Queries**
- [ ] **Avoid frequent refreshes** - Don't continuously refresh log pages
- [ ] **Use smaller time ranges** - Query last 1 hour instead of 24 hours
- [ ] **Filter logs** - Use specific filters (user ID, timestamp) instead of broad queries
- [ ] **Export instead of re-query** - Download logs once, analyze locally
- [ ] **Set auto-refresh to OFF** in dashboard settings

### 3. **Optimize Application Logging**
- [ ] **Review database RLS policies** - Overly complex policies generate more auth logs
- [ ] **Reduce unnecessary database queries** - Each query generates a log entry
- [ ] **Implement client-side caching** - Use SWR/React Query to reduce redundant API calls
- [ ] **Batch operations** - Combine multiple small queries into fewer large ones
- [ ] **Remove debug console.log statements** in production

### 4. **Implement Application-Level Logging**
Instead of relying on Supabase logs, implement your own:
- [ ] Add custom error tracking (e.g., Sentry, LogRocket)
- [ ] Log critical events to your own database table
- [ ] Use structured logging (JSON format) for easy searching
- [ ] Set up log rotation/cleanup for old entries

### 5. **Configure Supabase Log Settings**
- [ ] Go to Supabase Dashboard → Settings → API
- [ ] Review which logs are enabled:
  - Disable non-critical log types if possible
  - Keep Auth logs for security
  - Consider disabling verbose database query logs
- [ ] Set log retention to shortest acceptable period

### 6. **Monitor Usage Patterns**
- [ ] Check Supabase dashboard daily for quota warnings
- [ ] Set up alerts for:
  - High error rates (indicates issues generating logs)
  - Slow queries (generates more detailed logs)
  - Failed authentication attempts
- [ ] Review application metrics:
  - API call frequency
  - Database query count
  - Active user sessions

### 7. **Implement Rate Limiting**
- [ ] Add rate limiting to API endpoints
- [ ] Implement debouncing for frequent user actions
- [ ] Use SWR's `dedupingInterval` to prevent duplicate requests
- [ ] Add request throttling for background jobs

### 8. **Optimize Database Queries**
- [ ] Review slow queries in Dashboard → Database → Query Performance
- [ ] Add indexes to frequently queried columns
- [ ] Use `.select()` to fetch only needed columns
- [ ] Implement pagination instead of fetching all records
- [ ] Use `.maybeSingle()` instead of `.select()` when expecting one result

### 9. **Clean Up Unused Features**
- [ ] Remove unused database triggers
- [ ] Delete old database functions that generate logs
- [ ] Disable unused Auth providers
- [ ] Remove unnecessary RLS policies

### 10. **Upgrade Plan (If Needed)**
If you consistently hit limits after optimization:
- [ ] Review Supabase pricing for Pro plan
- [ ] Compare cost vs. value of increased log quota
- [ ] Consider alternative logging solutions for non-critical data

## Quick Wins (Do These First)

1. **Stop querying Auth logs in dashboard** - This is your current error source
2. **Use 1-hour time range** instead of 24 hours when viewing logs
3. **Export critical logs** - Download and save locally, don't re-query
4. **Wait 24 hours** - Quota resets daily, avoid queries until reset

## Emergency Actions (If Quota Exhausted)

1. **Stop all log queries** - Close Supabase dashboard tabs
2. **Wait for quota reset** - Typically resets at midnight UTC
3. **Review application errors** - Check Vercel logs instead of Supabase
4. **Implement temporary logging** - Add console.log to critical paths
5. **Contact Supabase support** - If urgent, request quota increase

## Long-Term Solutions

### Custom Logging System
Create a `logs` table in your database:
\`\`\`sql
CREATE TABLE app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  level TEXT CHECK (level IN ('info', 'warn', 'error', 'debug')),
  category TEXT, -- 'auth', 'api', 'database', etc.
  message TEXT,
  metadata JSONB,
  user_id UUID REFERENCES auth.users(id),
  -- Auto-delete old logs
  CONSTRAINT auto_delete CHECK (created_at > NOW() - INTERVAL '7 days')
);

-- Add index for efficient querying
CREATE INDEX idx_app_logs_created_at ON app_logs(created_at DESC);
CREATE INDEX idx_app_logs_level ON app_logs(level);
CREATE INDEX idx_app_logs_user_id ON app_logs(user_id);

-- Add RLS
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs"
  ON app_logs FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
\`\`\`

### Implement in Application
\`\`\`typescript
// lib/logger.ts
import { createClient } from '@/lib/supabase/client'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export async function logEvent(
  level: LogLevel,
  category: string,
  message: string,
  metadata?: Record<string, any>
) {
  // Only log to Supabase in production and for errors/warnings
  if (process.env.NODE_ENV !== 'production' && level === 'debug') {
    console.log(`[${level}] ${category}: ${message}`, metadata)
    return
  }

  try {
    const supabase = createClient()
    await supabase.from('app_logs').insert({
      level,
      category,
      message,
      metadata: metadata || {},
    })
  } catch (error) {
    // Fallback to console if logging fails
    console.error('Failed to log event:', error)
  }
}

// Usage in your app:
// await logEvent('error', 'auth', 'Login failed', { email: 'user@example.com' })
\`\`\`

### Set Up Log Cleanup
\`\`\`sql
-- scripts/cleanup_old_logs.sql
-- Run this as a scheduled job (e.g., via pg_cron extension)
DELETE FROM app_logs 
WHERE created_at < NOW() - INTERVAL '7 days';
\`\`\`

## Monitoring Dashboard
Create a simple admin dashboard to view your custom logs:
- Filter by level, category, time range
- Search by message or metadata
- Export to CSV for analysis
- View real-time error rates

## Current TaskFlow Recommendations

Based on your application analysis:

1. **Remove all `console.log("[v0] ...")` statements** in production
   - You have ~50+ debug logs throughout the codebase
   - Each triggers a log entry when errors occur

2. **Optimize notification polling**
   - Currently using SWR with default refresh intervals
   - Consider increasing `refreshInterval` or using WebSocket for real-time updates

3. **Reduce auth queries**
   - Multiple components call `supabase.auth.getUser()` 
   - Centralize auth state in AuthProvider context (already done, ensure all components use it)

4. **Implement error boundaries**
   - Catch errors at component level instead of logging every render error

5. **Add request deduplication**
   - Multiple components fetching same data simultaneously
   - Use SWR's `dedupingInterval: 2000` setting

## Verification Steps

After implementing changes:
- [ ] Check Supabase dashboard logs in 24 hours
- [ ] Verify no BigQuery errors
- [ ] Monitor application performance
- [ ] Test all critical features still work
- [ ] Review custom log entries in `app_logs` table

## Support Resources

- [Supabase Logging Documentation](https://supabase.com/docs/guides/platform/logs)
- [BigQuery Quotas](https://cloud.google.com/bigquery/quotas)
- [Supabase Support](https://supabase.com/dashboard/support)
