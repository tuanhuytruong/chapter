-- Reference Books & Playbooks — shared dwh/chapter migration
-- Run once by the database operator before deploying application code that
-- depends on Reference books or Playbooks. Safe to re-run after completion.

BEGIN;

ALTER TABLE chapter.books DROP CONSTRAINT IF EXISTS books_reading_experience_check;
ALTER TABLE chapter.books ADD CONSTRAINT books_reading_experience_check
  CHECK (reading_experience IN ('analytical', 'story', 'reference'));

CREATE TABLE IF NOT EXISTS chapter.reference_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK (reading_round >= 1),
  log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  card_type TEXT NOT NULL CHECK (card_type IN ('recipe', 'formula', 'procedure')),
  schema_version SMALLINT NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  personal_adaptation TEXT NOT NULL DEFAULT '' CHECK (char_length(personal_adaptation) <= 2000),
  source_excerpt TEXT NOT NULL CHECK (char_length(source_excerpt) BETWEEN 1 AND 12000),
  source_page_start INT NOT NULL CHECK (source_page_start >= 0),
  source_page_end INT NOT NULL CHECK (source_page_end >= source_page_start),
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, request_key)
);
CREATE INDEX IF NOT EXISTS idx_reference_cards_owner_updated
  ON chapter.reference_cards (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reference_cards_owner_type_updated
  ON chapter.reference_cards (owner_id, card_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reference_cards_book_round
  ON chapter.reference_cards (book_id, reading_round, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reference_cards_tags
  ON chapter.reference_cards USING GIN (tags);

CREATE TABLE IF NOT EXISTS chapter.reference_card_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES chapter.reference_cards(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, request_key)
);
CREATE INDEX IF NOT EXISTS idx_reference_card_uses_card_time
  ON chapter.reference_card_uses (card_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_reference_card_uses_owner_time
  ON chapter.reference_card_uses (owner_id, used_at DESC);

ALTER TABLE chapter.search_documents DROP CONSTRAINT IF EXISTS search_documents_kind_check;
ALTER TABLE chapter.search_documents ADD CONSTRAINT search_documents_kind_check
  CHECK (kind IN ('book','wiki','quote','note','reflection','story_session','story_memory','reference_card'));

COMMIT;
