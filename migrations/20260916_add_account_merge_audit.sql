BEGIN;

-- Explicit identity-merge audit. Source IDs are retained as values because the
-- duplicate user is deleted after its owned data has been transferred.
CREATE TABLE IF NOT EXISTS chapter.account_merge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE RESTRICT,
  source_user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google')),
  provider_subject_hash TEXT NOT NULL,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (destination_user_id <> source_user_id)
);
CREATE INDEX IF NOT EXISTS idx_account_merge_events_destination_merged
  ON chapter.account_merge_events(destination_user_id, merged_at DESC);
COMMIT;
