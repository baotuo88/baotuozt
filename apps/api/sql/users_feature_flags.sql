ALTER TABLE users
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_feature_flags_gin
  ON users USING GIN (feature_flags);

