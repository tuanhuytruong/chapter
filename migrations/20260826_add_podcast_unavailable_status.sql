BEGIN;

ALTER TABLE chapter.podcasts
  DROP CONSTRAINT IF EXISTS podcasts_status_check;

ALTER TABLE chapter.podcasts
  ADD CONSTRAINT podcasts_status_check
  CHECK (status IN ('queued','scripting','synthesizing','archiving','archive_pending','ready','failed','unavailable'));

COMMIT;
