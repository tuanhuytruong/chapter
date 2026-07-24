BEGIN;

CREATE TABLE IF NOT EXISTS chapter.onboarding_progress (
  owner_id UUID PRIMARY KEY REFERENCES chapter.users(id) ON DELETE CASCADE,
  dismissed_steps TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

-- Verification:
-- SELECT to_regclass('chapter.onboarding_progress') AS onboarding_progress;
-- Expected: chapter.onboarding_progress