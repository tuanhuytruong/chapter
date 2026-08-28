BEGIN;

CREATE TABLE IF NOT EXISTS chapter.reading_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK (reading_round >= 1),
  log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  page_position INT NOT NULL CHECK (page_position >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('idea', 'question', 'quote', 'return_to')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, owner_id, log_id, page_position, kind, note)
);

CREATE INDEX IF NOT EXISTS idx_reading_markers_book_owner_round_created
  ON chapter.reading_markers (book_id, owner_id, reading_round, created_at DESC);

COMMIT;
