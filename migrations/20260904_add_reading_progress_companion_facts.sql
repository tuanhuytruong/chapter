BEGIN;

CREATE TABLE IF NOT EXISTS chapter.reading_progress_companion_facts (
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK(reading_round >= 1),
  log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  source_hash TEXT NOT NULL,
  facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_language TEXT NOT NULL CHECK(output_language IN ('vi','en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(book_id, reading_round, log_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_companion_facts_round
  ON chapter.reading_progress_companion_facts(book_id, reading_round, created_at);

COMMIT;
