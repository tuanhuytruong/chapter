-- AI Reader V2: additive continuity map and honest resolved language.
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS reading_path JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS thread_map JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS entity_map JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS connections JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS current_reading_state JSONB NOT NULL DEFAULT '{}';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS next_session_context TEXT NOT NULL DEFAULT '';
-- Existing V1 Auto rows have no raw source retained here; classify only their stored prose
-- before enforcing V2's resolved-language invariant.
UPDATE chapter.book_wiki SET output_language = CASE
  WHEN overview ~ '[ăâđêôơưĂÂĐÊÔƠƯ]' THEN 'vi' ELSE 'en' END
WHERE output_language = 'auto';
ALTER TABLE chapter.book_wiki ALTER COLUMN output_language SET DEFAULT 'en';
ALTER TABLE chapter.book_wiki DROP CONSTRAINT IF EXISTS book_wiki_output_language_check;
ALTER TABLE chapter.book_wiki ADD CONSTRAINT book_wiki_output_language_check CHECK (output_language IN ('vi', 'en'));
