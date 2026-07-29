-- Chapter Podcast V1 — idempotent production migration.
-- This migration is additive: it does not delete or overwrite existing data.
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS podcast_voice_gender TEXT;
ALTER TABLE chapter.users DROP CONSTRAINT IF EXISTS users_podcast_voice_gender_check;
ALTER TABLE chapter.users ADD CONSTRAINT users_podcast_voice_gender_check
  CHECK (podcast_voice_gender IS NULL OR podcast_voice_gender IN ('female', 'male'));

ALTER TABLE chapter.book_reading_units ADD COLUMN IF NOT EXISTS spine_index INT;
ALTER TABLE chapter.book_reading_units ADD COLUMN IF NOT EXISTS chapter_key TEXT;
CREATE INDEX IF NOT EXISTS idx_book_reading_units_book_chapter
  ON chapter.book_reading_units (book_id, chapter_key, unit_index);

CREATE TABLE IF NOT EXISTS chapter.podcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE, log_id UUID REFERENCES chapter.reading_log(id) ON DELETE SET NULL,
  reading_round INT NOT NULL DEFAULT 1, chapter_key TEXT NOT NULL, chapter_title TEXT,
  language TEXT NOT NULL CHECK (language IN ('vi', 'en')), voice_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'scripting', 'synthesizing', 'archiving', 'archive_pending', 'ready', 'failed')),
  script_text TEXT, word_count INT, duration_s INT, tg_file_id TEXT, tg_file_unique_id TEXT, tg_chat_id TEXT, tg_message_id BIGINT,
  local_cache_path TEXT, local_cache_until TIMESTAMPTZ, error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, chapter_key, reading_round)
);
-- Existing Podcast installations need this constraint refresh to permit a protected
-- local-only episode while Telegram archive retry is pending.
ALTER TABLE chapter.podcasts DROP CONSTRAINT IF EXISTS podcasts_status_check;
ALTER TABLE chapter.podcasts ADD CONSTRAINT podcasts_status_check
  CHECK (status IN ('queued', 'scripting', 'synthesizing', 'archiving', 'archive_pending', 'ready', 'failed'));

CREATE INDEX IF NOT EXISTS idx_podcasts_user_book_created ON chapter.podcasts (user_id, book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_podcasts_cache_expiry ON chapter.podcasts (local_cache_until) WHERE local_cache_until IS NOT NULL;

SELECT to_regclass('chapter.podcasts') AS podcasts_table,
       to_regclass('chapter.book_reading_units') AS reading_units_table;