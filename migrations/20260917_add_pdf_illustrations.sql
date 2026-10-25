ALTER TABLE chapter.book_reading_units
  ADD COLUMN IF NOT EXISTS has_illustration BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE chapter.reading_log
  ADD COLUMN IF NOT EXISTS illustration_pages INT[] NOT NULL DEFAULT '{}';
ALTER TABLE chapter.reading_log
  ADD COLUMN IF NOT EXISTS illustration_source_hash TEXT;

CREATE TABLE IF NOT EXISTS chapter.reading_log_illustrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  page_number INT NOT NULL CHECK (page_number > 0),
  source_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'failed')),
  analysis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reading_log_id, page_number, source_hash)
);
CREATE INDEX IF NOT EXISTS idx_reading_log_illustrations_log
  ON chapter.reading_log_illustrations (reading_log_id, page_number);
