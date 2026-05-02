-- 1) styles: add version field
ALTER TABLE styles
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 2) tasks: snapshot style version for historical consistency
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS style_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_tasks_style_id_style_version
  ON tasks(style_id, style_version);
