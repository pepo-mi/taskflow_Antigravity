-- Add due_date column to tasks table
ALTER TABLE tasks ADD COLUMN due_date DATE;

-- Add comment to the column
COMMENT ON COLUMN tasks.due_date IS 'Due date for the task';
