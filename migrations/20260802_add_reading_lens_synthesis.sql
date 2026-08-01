BEGIN;
CREATE TABLE IF NOT EXISTS chapter.reading_lens_synthesis (
  book_id UUID PRIMARY KEY REFERENCES chapter.books(id) ON DELETE CASCADE, schema_version SMALLINT NOT NULL DEFAULT 1, through_line TEXT NOT NULL DEFAULT '', evolving_concepts JSONB NOT NULL DEFAULT '[]', resolved_questions JSONB NOT NULL DEFAULT '[]', open_questions JSONB NOT NULL DEFAULT '[]', tensions JSONB NOT NULL DEFAULT '[]', confidence_notes JSONB NOT NULL DEFAULT '[]', output_language TEXT NOT NULL DEFAULT 'en', sessions_covered INT NOT NULL DEFAULT 0, last_log_id UUID REFERENCES chapter.reading_log(id), last_log_date DATE, last_log_session INT, source_revision BIGINT NOT NULL DEFAULT 0, stale BOOLEAN NOT NULL DEFAULT FALSE, generated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT reading_lens_synthesis_language_check CHECK (output_language IN ('vi','en'))
);
ALTER TABLE chapter.reading_lens_synthesis ADD COLUMN IF NOT EXISTS last_log_date DATE;
ALTER TABLE chapter.reading_lens_synthesis ADD COLUMN IF NOT EXISTS last_log_session INT;
COMMIT;
