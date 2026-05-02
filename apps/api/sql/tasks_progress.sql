ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;

-- Optional strict check
-- ALTER TABLE tasks
--   ADD CONSTRAINT chk_tasks_progress_range CHECK (progress >= 0 AND progress <= 100);
