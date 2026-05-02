CREATE TABLE IF NOT EXISTS user_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  event_value TEXT NULL,
  duration_ms INTEGER NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_events_created_at
  ON user_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_events_user_id_created_at
  ON user_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_events_type_created_at
  ON user_events(event_type, created_at DESC);
