-- Per-book AI summary depth. Safe to run repeatedly.
-- Existing books keep the current Casual summary behavior.
BEGIN;

ALTER TABLE chapter.books
  ADD COLUMN IF NOT EXISTS summary_mode TEXT NOT NULL DEFAULT 'casual';

ALTER TABLE chapter.books
  DROP CONSTRAINT IF EXISTS books_summary_mode_check;

ALTER TABLE chapter.books
  ADD CONSTRAINT books_summary_mode_check
  CHECK (summary_mode IN ('casual', 'deep_reading'));

COMMIT;
