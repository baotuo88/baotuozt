ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS cancelable BOOLEAN NOT NULL DEFAULT TRUE;

-- Optional: if you use enum/check for status, ensure 'canceled' is included.
