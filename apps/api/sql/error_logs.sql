CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NULL,
  user_id BIGINT NULL,
  source VARCHAR(64) NOT NULL,
  code VARCHAR(128) NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_task_id_created_at
  ON error_logs(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id_created_at
  ON error_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_source_created_at
  ON error_logs(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_code_created_at
  ON error_logs(code, created_at DESC);
