BEGIN;

ALTER TABLE chapter.books ADD COLUMN IF NOT EXISTS reading_round INT NOT NULL DEFAULT 1;
ALTER TABLE chapter.books ADD COLUMN IF NOT EXISTS current_reading_round INT NOT NULL DEFAULT 1;
UPDATE chapter.books SET current_reading_round = GREATEST(current_reading_round, reading_round, 1);

ALTER TABLE chapter.reading_log ADD COLUMN IF NOT EXISTS reading_round INT NOT NULL DEFAULT 1;
UPDATE chapter.reading_log SET reading_round=1 WHERE reading_round IS NULL;

CREATE TABLE IF NOT EXISTS chapter.book_reading_rounds (
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK (reading_round >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished', 'queued')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  final_page INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, reading_round)
);
INSERT INTO chapter.book_reading_rounds (book_id, reading_round, status, final_page, started_at, finished_at)
SELECT id, current_reading_round, status, current_page, created_at,
       CASE WHEN status='finished' THEN COALESCE(reflection_at, created_at) END
FROM chapter.books
ON CONFLICT (book_id, reading_round) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_reading_log_book_round_date ON chapter.reading_log (book_id, reading_round, date DESC, session DESC);
CREATE INDEX IF NOT EXISTS idx_book_reading_rounds_book_status ON chapter.book_reading_rounds (book_id, status, reading_round DESC);
COMMIT;
