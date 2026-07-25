-- Story Thread V1 — safe, idempotent production migration.
-- Adds a locked book experience plus owner-scoped Story continuity artifacts.
-- Does not rewrite or remove existing books, logs, summaries, or analyses.

ALTER TABLE chapter.books
  ADD COLUMN IF NOT EXISTS reading_experience TEXT NOT NULL DEFAULT 'analytical';
ALTER TABLE chapter.books DROP CONSTRAINT IF EXISTS books_reading_experience_check;
ALTER TABLE chapter.books ADD CONSTRAINT books_reading_experience_check
  CHECK (reading_experience IN ('analytical', 'story'));

CREATE TABLE IF NOT EXISTS chapter.story_thread_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  analysis JSONB NOT NULL,
  story_recap TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (log_id, schema_version)
);
CREATE INDEX IF NOT EXISTS idx_story_thread_analyses_book_generated
  ON chapter.story_thread_analyses (book_id, generated_at ASC);

CREATE TABLE IF NOT EXISTS chapter.story_state_snapshots (
  book_id UUID PRIMARY KEY REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL DEFAULT 1,
  last_log_id UUID REFERENCES chapter.reading_log(id) ON DELETE SET NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read-only verification
SELECT to_regclass('chapter.story_thread_analyses') AS story_thread_analyses,
       to_regclass('chapter.story_state_snapshots') AS story_state_snapshots;