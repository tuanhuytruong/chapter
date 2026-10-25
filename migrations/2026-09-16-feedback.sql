BEGIN;

CREATE TABLE IF NOT EXISTS chapter.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('bug','idea','other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  route_path TEXT NOT NULL CHECK (char_length(route_path) BETWEEN 1 AND 300),
  client_platform TEXT CHECK (client_platform IN ('web_desktop','web_android','web_ios','unknown')),
  browser_family TEXT CHECK (browser_family IN ('chrome','safari','firefox','edge','other','unknown')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','planned','resolved','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_status_created_idx ON chapter.feedback (status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_owner_created_idx ON chapter.feedback (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chapter.feedback_rate_limits (
  rate_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rate_key, window_started_at)
);
CREATE INDEX IF NOT EXISTS feedback_rate_limits_window_cleanup_idx
  ON chapter.feedback_rate_limits (window_started_at);

COMMIT;
