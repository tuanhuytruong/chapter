BEGIN;

-- Backfill rounds that existed in saved reading history before the lifecycle
-- table was introduced. Keep existing rows authoritative and make this safe
-- to apply repeatedly.
WITH historical_rounds AS (
  SELECT
    l.book_id,
    l.reading_round,
    MIN(l.created_at) AS started_at,
    MAX(l.created_at) AS last_saved_at,
    MAX(l.page_end) AS final_page
  FROM chapter.reading_log l
  GROUP BY l.book_id, l.reading_round
)
INSERT INTO chapter.book_reading_rounds (
  book_id, reading_round, status, started_at, finished_at, final_page
)
SELECT
  h.book_id,
  h.reading_round,
  CASE
    WHEN h.reading_round < b.current_reading_round THEN 'finished'
    ELSE b.status
  END,
  h.started_at,
  CASE
    WHEN h.reading_round < b.current_reading_round THEN h.last_saved_at
    WHEN b.status = 'finished' THEN h.last_saved_at
    ELSE NULL
  END,
  COALESCE(h.final_page, 0)
FROM historical_rounds h
JOIN chapter.books b ON b.id = h.book_id
ON CONFLICT (book_id, reading_round) DO NOTHING;

COMMIT;
