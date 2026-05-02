CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  role VARCHAR(16) NOT NULL DEFAULT 'user',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status);

CREATE TABLE IF NOT EXISTS styles (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL DEFAULT 'default',
  category VARCHAR(32) NOT NULL DEFAULT 'general',
  version INTEGER NOT NULL DEFAULT 1,
  prompt_template TEXT NULL,
  lighting TEXT NULL,
  composition TEXT NULL,
  camera TEXT NULL,
  details TEXT NULL,
  color_style TEXT NULL,
  quality_booster TEXT NULL,
  negative_prompt TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  mode VARCHAR(32) NOT NULL,
  style_id BIGINT NOT NULL REFERENCES styles(id),
  style_version INTEGER NOT NULL DEFAULT 1,
  prompt TEXT NOT NULL,
  credit_deduction_id TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  cancelable BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT NULL,
  result_url TEXT NULL,
  thumbnail_url TEXT NULL,
  storage_provider VARCHAR(32) NULL,
  format VARCHAR(16) NULL,
  error_message TEXT NULL,
  finished_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  canceled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id_created_at
  ON tasks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_status_created_at
  ON tasks(status, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_deductions (
  deduction_id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  credits_used INTEGER NOT NULL,
  mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'deducted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rolled_back_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_deductions_user_id_created_at
  ON credit_deductions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_deductions_status_created_at
  ON credit_deductions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_orders (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  credits INTEGER NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_orders_user_id_created_at
  ON billing_orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS api_configs (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 100,
  used_today INTEGER NULL,
  daily_budget INTEGER NULL,
  last_error TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_configs_model_priority
  ON api_configs(model, priority ASC);
