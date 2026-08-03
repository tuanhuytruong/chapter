-- Phase A: durable, privacy-preserving authentication rate-limit counters.
CREATE TABLE IF NOT EXISTS chapter.auth_rate_limits (
  scope TEXT NOT NULL CHECK (scope IN ('login','forgot_password','reset_password','oauth')),
  rate_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, rate_key, window_started_at)
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_window_cleanup_idx
  ON chapter.auth_rate_limits (window_started_at);
