-- AI Reader narrative V1 — additive and idempotent.
-- Existing BookWiki rows remain readable by legacy clients.

ALTER TABLE chapter.book_wiki
  ADD COLUMN IF NOT EXISTS schema_version SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE chapter.book_wiki
  ADD COLUMN IF NOT EXISTS output_language TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE chapter.book_wiki
  ADD COLUMN IF NOT EXISTS book_so_far TEXT NOT NULL DEFAULT '';
ALTER TABLE chapter.book_wiki
  ADD COLUMN IF NOT EXISTS current_position JSONB NOT NULL DEFAULT '{}';
ALTER TABLE chapter.book_wiki
  ADD COLUMN IF NOT EXISTS narrative_arc JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki
  ADD COLUMN IF NOT EXISTS carry_forward_insights JSONB NOT NULL DEFAULT '[]';

ALTER TABLE chapter.book_wiki DROP CONSTRAINT IF EXISTS book_wiki_output_language_check;
ALTER TABLE chapter.book_wiki ADD CONSTRAINT book_wiki_output_language_check
  CHECK (output_language IN ('auto', 'vi', 'en'));

-- Read-only verification
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'chapter' AND table_name = 'book_wiki'
  AND column_name IN ('schema_version', 'output_language', 'book_so_far', 'current_position', 'narrative_arc', 'carry_forward_insights')
ORDER BY column_name;
