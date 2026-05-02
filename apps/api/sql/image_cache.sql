CREATE TABLE IF NOT EXISTS image_cache (
  prompt_hash VARCHAR(32) PRIMARY KEY,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_cache_updated_at
  ON image_cache(updated_at DESC);
