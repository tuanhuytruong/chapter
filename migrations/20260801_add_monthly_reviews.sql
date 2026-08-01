-- Phase 3A: owner-scoped, versioned Monthly Review artifacts.
CREATE TABLE IF NOT EXISTS chapter.monthly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL CHECK (period_key ~ '^\d{4}-(0[1-9]|1[0-2])$'), schema_version SMALLINT NOT NULL,
  output_language TEXT NOT NULL CHECK (output_language IN ('vi','en')), payload JSONB NOT NULL,
  source_session_count INT NOT NULL CHECK (source_session_count >= 0), generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(owner_id,period_key)
);
CREATE INDEX IF NOT EXISTS idx_monthly_reviews_owner_generated ON chapter.monthly_reviews(owner_id,generated_at DESC);
