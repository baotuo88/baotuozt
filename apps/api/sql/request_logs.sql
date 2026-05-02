CREATE TABLE IF NOT EXISTS request_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NULL,
  ip VARCHAR(64) NOT NULL,
  method VARCHAR(16) NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_logs_created_at
  ON request_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_logs_user_id_created_at
  ON request_logs(user_id, created_at DESC);
