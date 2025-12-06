-- Add "awaiting-feedback" to the tasks status check constraint
-- This allows tasks to have the new "Awaiting Feedback" status

-- First, drop the existing constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add the new constraint with "awaiting-feedback" included
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('todo', 'in-progress', 'done', 'awaiting-feedback'));

-- Update any existing tasks that might need the new status (optional)
-- This is just a placeholder - no existing tasks will be updated automatically
