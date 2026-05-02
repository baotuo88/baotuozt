CREATE TABLE IF NOT EXISTS model_providers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model_type VARCHAR(64) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  status VARCHAR(16) NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_model_providers_model_type_priority
  ON model_providers(model_type, priority ASC);

CREATE INDEX IF NOT EXISTS idx_model_providers_status
  ON model_providers(status);
