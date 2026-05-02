CREATE TABLE IF NOT EXISTS ab_tests (
  image_id BIGINT PRIMARY KEY,
  clicks BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_clicks_desc
  ON ab_tests(clicks DESC);
