-- Chapter performance audit — read-only. Run against DEV only:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/perf/audit-db.sql
-- Every statement stays inside a rollback-only transaction and returns no reading text.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '12s';

-- Replace the psql variables with a real DEV owner/book only in the shell, never commit values.
-- Example:
-- psql "$DATABASE_URL" -v owner_id='...' -v book_id='...' -f scripts/perf/audit-db.sql

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, author, file_type, total_pages, daily_pages, current_page, current_reading_round,
       status, summary_lang, reading_experience, summary_mode, cover_url, queue_order, created_at
FROM chapter.books
WHERE owner_id = :'owner_id'
ORDER BY CASE WHEN status = 'active' THEN 0 WHEN status = 'queued' THEN 1 ELSE 2 END,
         queue_order NULLS LAST, created_at DESC;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, date, session, reading_round, page_start, page_end, summary, key_insights, quote
FROM chapter.reading_log
WHERE book_id = :'book_id'
ORDER BY reading_round DESC, date DESC, session DESC;

EXPLAIN (ANALYZE, BUFFERS)
SELECT status, started_at, completed_at, error_message
FROM chapter.ai_reader_jobs
WHERE book_id = :'book_id';

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status, chapter_key, chapter_title, reading_round, updated_at
FROM chapter.podcasts
WHERE book_id = :'book_id'
ORDER BY created_at DESC;

ROLLBACK;
