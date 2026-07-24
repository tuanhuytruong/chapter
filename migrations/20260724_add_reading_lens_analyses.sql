BEGIN;

CREATE TABLE IF NOT EXISTS chapter.reading_lens_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  analysis JSONB NOT NULL,
  analyst_summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (log_id, schema_version)
);

CREATE INDEX IF NOT EXISTS idx_reading_lens_analyses_book_generated
  ON chapter.reading_lens_analyses (book_id, generated_at ASC);

COMMIT;
