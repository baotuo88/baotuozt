CREATE TABLE IF NOT EXISTS api_call_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NULL,
  task_id BIGINT NULL,
  provider VARCHAR(128) NOT NULL,
  endpoint TEXT NOT NULL,
  status VARCHAR(16) NOT NULL,
  latency_ms INTEGER NOT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at
  ON api_call_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_call_logs_user_id_created_at
  ON api_call_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_call_logs_task_id_created_at
  ON api_call_logs(task_id, created_at DESC);
