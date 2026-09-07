BEGIN;

CREATE TABLE IF NOT EXISTS chapter.return_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_card_id UUID NOT NULL REFERENCES chapter.review_cards(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('still_true', 'changed', 'revisit', 'dismissed')),
  reflection TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT return_responses_reflection_limit
    CHECK (reflection IS NULL OR char_length(reflection) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_return_responses_owner_card_time
  ON chapter.return_responses (owner_id, review_card_id, responded_at DESC);

COMMIT;
