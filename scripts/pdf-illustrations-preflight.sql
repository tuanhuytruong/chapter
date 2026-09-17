BEGIN;
\i /tmp/chapter-pdf-illustrations-preflight.sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'chapter'
  AND (
    (table_name = 'reading_log' AND column_name IN ('illustration_pages', 'illustration_source_hash'))
    OR (table_name = 'book_reading_units' AND column_name = 'has_illustration')
  )
ORDER BY table_name, column_name;
SELECT to_regclass('chapter.reading_log_illustrations') AS illustration_table;
ROLLBACK;
