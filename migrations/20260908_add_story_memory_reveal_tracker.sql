-- Story Memory v2 is a current snapshot plus append-only reveal/revision evidence.
CREATE TABLE IF NOT EXISTS chapter.story_memory_snapshots (
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INTEGER NOT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 2,
  state JSONB NOT NULL,
  covered_log_id UUID REFERENCES chapter.reading_log(id) ON DELETE SET NULL,
  covered_session INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','generating','failed')),
  error_message TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, reading_round, schema_version)
);
CREATE TABLE IF NOT EXISTS chapter.story_memory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('identity_hypothesis','identity_confirmed','identity_rejected','assumption_revised')),
  subject_key TEXT NOT NULL,
  prior_claim TEXT,
  current_claim TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('hypothesis','confirmed','rejected')),
  source_log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  source_session INTEGER NOT NULL,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, reading_round, event_type, subject_key, source_log_id, current_claim)
);
CREATE INDEX IF NOT EXISTS idx_story_memory_events_book_round ON chapter.story_memory_events (book_id, reading_round, source_session ASC, created_at ASC);
