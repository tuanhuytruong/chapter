-- Chapter — AI Daily Book Reading Companion
-- PostgreSQL schema for the `chapter` schema inside the `dwh` database.
-- Run with: psql "$DATABASE_URL" -f src/db/schema.sql
-- Requires PostgreSQL 13+ (uses built-in gen_random_uuid(), no uuid-ossp needed).
-- Schema option A: tables live under the `chapter` schema (search_path set in db.ts).
--
-- NOTE: the `chapter` schema must be created ONCE by a role with CREATE SCHEMA
-- privilege (e.g. the DB owner / superuser). The apps runtime role (dwh) only
-- needs CREATE TABLE inside the existing schema. If you hit
-- "permission denied for database dwh" on the CREATE SCHEMA line, create the
-- schema manually first:
--   psql "$DATABASE_URL" -c "CREATE SCHEMA IF NOT EXISTS chapter;"
-- The apps ensureSchema() tolerates this error and continues to CREATE TABLEs.

CREATE SCHEMA IF NOT EXISTS chapter;

-- Bootstrap identities before tables that reference an owner. This is also kept
-- here (not only in a deployment migration) so an empty database is usable.
CREATE TABLE IF NOT EXISTS chapter.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  telegram_chat_id TEXT,
  podcast_voice_gender TEXT CHECK (podcast_voice_gender IS NULL OR podcast_voice_gender IN ('female', 'male')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS podcast_voice_gender TEXT;
ALTER TABLE chapter.users DROP CONSTRAINT IF EXISTS users_podcast_voice_gender_check;
ALTER TABLE chapter.users ADD CONSTRAINT users_podcast_voice_gender_check
  CHECK (podcast_voice_gender IS NULL OR podcast_voice_gender IN ('female', 'male'));


-- ───────────────────────────────────────────────────────────
-- chapter.session (express-session via connect-pg-simple)
-- ───────────────────────────────────────────────────────────
-- Create this here rather than relying on connect-pg-simple's lazy auto-create:
-- session middleware can receive a request before that asynchronous bootstrap
-- completes, which otherwise surfaces as Express's default HTML 500 page.
CREATE TABLE IF NOT EXISTS chapter.session (
  sid     varchar NOT NULL COLLATE "default",
  sess    json NOT NULL,
  expire  timestamp(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON chapter.session (expire);

-- ───────────────────────────────────────────────────────────
-- chapter.books
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter.books (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  author        TEXT NOT NULL DEFAULT 'Unknown',
  file_path     TEXT NOT NULL,
  file_type     TEXT NOT NULL CHECK (file_type IN ('pdf', 'epub')),
  total_pages   INT NOT NULL DEFAULT 0,
  daily_pages   INT NOT NULL DEFAULT 3,
  current_page  INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished', 'queued')),
  summary_lang  TEXT NOT NULL DEFAULT 'auto' CHECK (summary_lang IN ('auto', 'vi', 'en')),
  reading_experience TEXT NOT NULL DEFAULT 'analytical' CHECK (reading_experience IN ('analytical', 'story')),
  summary_mode  TEXT NOT NULL DEFAULT 'casual' CHECK (summary_mode IN ('casual', 'deep_reading')),
  cover_url     TEXT,
  reflection_text TEXT,
  reflection_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_status ON chapter.books (status);

-- Upload ownership is separate from books while a file is waiting to be saved.
-- A claimed file remains recorded so another user cannot attach it later.
CREATE TABLE IF NOT EXISTS chapter.uploaded_files (
  file_path TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_owner_unclaimed
  ON chapter.uploaded_files (owner_id) WHERE claimed_at IS NULL;

-- Per-reader, dismissible onboarding milestones. Content remains in the client.
CREATE TABLE IF NOT EXISTS chapter.onboarding_progress (
  owner_id UUID PRIMARY KEY REFERENCES chapter.users(id) ON DELETE CASCADE,
  dismissed_steps TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration: add summary_lang to existing tables (idempotent; safe to re-run).
ALTER TABLE chapter.books
  ADD COLUMN IF NOT EXISTS summary_lang TEXT NOT NULL DEFAULT 'auto'
  CHECK (summary_lang IN ('auto', 'vi', 'en'));

-- Migration: per-book AI summary depth. Existing books remain Casual.
ALTER TABLE chapter.books
  ADD COLUMN IF NOT EXISTS summary_mode TEXT NOT NULL DEFAULT 'casual';
ALTER TABLE chapter.books DROP CONSTRAINT IF EXISTS books_summary_mode_check;
ALTER TABLE chapter.books ADD CONSTRAINT books_summary_mode_check
  CHECK (summary_mode IN ('casual', 'deep_reading'));

-- Migration: Story is a distinct, immutable reading experience. Existing books
-- remain analytical; summary_mode is meaningful only for analytical books.
ALTER TABLE chapter.books
  ADD COLUMN IF NOT EXISTS reading_experience TEXT NOT NULL DEFAULT 'analytical';
ALTER TABLE chapter.books DROP CONSTRAINT IF EXISTS books_reading_experience_check;
ALTER TABLE chapter.books ADD CONSTRAINT books_reading_experience_check
  CHECK (reading_experience IN ('analytical', 'story'));

-- Migration: one persisted end-of-book reflection per book (idempotent).
ALTER TABLE chapter.books ADD COLUMN IF NOT EXISTS reflection_text TEXT;
ALTER TABLE chapter.books ADD COLUMN IF NOT EXISTS reflection_at TIMESTAMPTZ;

-- Migration: reading queue columns (idempotent).
ALTER TABLE chapter.books
  ADD COLUMN IF NOT EXISTS queue_order INT;
ALTER TABLE chapter.books DROP CONSTRAINT IF EXISTS books_status_check;
ALTER TABLE chapter.books ADD CONSTRAINT books_status_check
  CHECK (status IN ('active', 'paused', 'finished', 'queued'));
CREATE INDEX IF NOT EXISTS idx_books_queue ON chapter.books (queue_order ASC NULLS LAST);

-- ───────────────────────────────────────────────────────────
-- chapter.book_reading_units (stable EPUB reading chunks)
-- ───────────────────────────────────────────────────────────
-- EPUB text reflows by screen and font, so it has no reliable page count.
-- Persist paragraph-aware chunks once per book to keep progress stable.
CREATE TABLE IF NOT EXISTS chapter.book_reading_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID NOT NULL REFERENCES chapter.books (id) ON DELETE CASCADE,
  unit_index  INT NOT NULL,
  title       TEXT,
  spine_index INT,
  chapter_key TEXT,
  raw_text    TEXT NOT NULL,
  char_count  INT NOT NULL,
  UNIQUE (book_id, unit_index)
);
CREATE INDEX IF NOT EXISTS idx_book_reading_units_book_unit
  ON chapter.book_reading_units (book_id, unit_index);
ALTER TABLE chapter.book_reading_units ADD COLUMN IF NOT EXISTS spine_index INT;
ALTER TABLE chapter.book_reading_units ADD COLUMN IF NOT EXISTS chapter_key TEXT;
CREATE INDEX IF NOT EXISTS idx_book_reading_units_book_chapter
  ON chapter.book_reading_units (book_id, chapter_key, unit_index);

-- ───────────────────────────────────────────────────────────
-- chapter.reading_log
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter.reading_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES chapter.books (id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  page_start    INT  NOT NULL DEFAULT 0,
  page_end      INT NOT NULL DEFAULT 0,
  raw_text      TEXT,
  summary       TEXT,
  key_insights  TEXT[] NOT NULL DEFAULT '{}',
  quote         TEXT,
  telegram_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, date)   -- idempotency guard for daily cron
);

CREATE INDEX IF NOT EXISTS idx_reading_log_book_date ON chapter.reading_log (book_id, date DESC);

-- Migration: personal notes on daily summaries (idempotent).
ALTER TABLE chapter.reading_log
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migration: chapter/section title for today's reading (idempotent).
ALTER TABLE chapter.reading_log
  ADD COLUMN IF NOT EXISTS chapter_title TEXT;

-- Migration: multi-session reading (idempotent).
-- Drop old one-per-day constraint; add session column + new composite unique.
ALTER TABLE chapter.reading_log
  DROP CONSTRAINT IF EXISTS reading_log_book_id_date_key;
ALTER TABLE chapter.reading_log
  ADD COLUMN IF NOT EXISTS session INT NOT NULL DEFAULT 1;
-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS. Drop this named constraint
-- before recreating it so startup remains idempotent after a partial deploy.
ALTER TABLE chapter.reading_log
  DROP CONSTRAINT IF EXISTS reading_log_book_id_date_session_key;
ALTER TABLE chapter.reading_log
  ADD CONSTRAINT reading_log_book_id_date_session_key
  UNIQUE (book_id, date, session);
DROP INDEX IF EXISTS idx_reading_log_book_date;
CREATE INDEX IF NOT EXISTS idx_reading_log_book_date
  ON chapter.reading_log (book_id, date DESC, session DESC);

-- Podcast episodes are private owner-scoped jobs. Telegram identifiers stay
-- server-side and are never included in reader-facing API responses. It follows
-- reading_log so the foreign key is valid on a clean database bootstrap.
CREATE TABLE IF NOT EXISTS chapter.podcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  log_id UUID REFERENCES chapter.reading_log(id) ON DELETE SET NULL,
  reading_round INT NOT NULL DEFAULT 1,
  chapter_key TEXT NOT NULL,
  chapter_title TEXT,
  language TEXT NOT NULL CHECK (language IN ('vi', 'en')),
  voice_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'scripting', 'synthesizing', 'archiving', 'archive_pending', 'ready', 'failed')),
  script_text TEXT,
  word_count INT,
  duration_s INT,
  tg_file_id TEXT,
  tg_file_unique_id TEXT,
  tg_chat_id TEXT,
  tg_message_id BIGINT,
  local_cache_path TEXT,
  local_cache_until TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, chapter_key, reading_round)
);
ALTER TABLE chapter.podcasts DROP CONSTRAINT IF EXISTS podcasts_status_check;
ALTER TABLE chapter.podcasts ADD CONSTRAINT podcasts_status_check
  CHECK (status IN ('queued', 'scripting', 'synthesizing', 'archiving', 'archive_pending', 'ready', 'failed'));
CREATE INDEX IF NOT EXISTS idx_podcasts_user_book_created ON chapter.podcasts (user_id, book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_podcasts_cache_expiry ON chapter.podcasts (local_cache_until) WHERE local_cache_until IS NOT NULL;

-- ───────────────────────────────────────────────────────────
-- chapter.reading_lens_analyses (versioned structured session analysis)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter.reading_lens_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  analysis JSONB NOT NULL,
  analyst_summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (log_id, schema_version)
);
CREATE INDEX IF NOT EXISTS idx_reading_lens_analyses_book_generated
  ON chapter.reading_lens_analyses (book_id, generated_at ASC);

-- Story continuity is separate from analytical Reading Lens output.
CREATE TABLE IF NOT EXISTS chapter.story_thread_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  analysis JSONB NOT NULL,
  story_recap TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (log_id, schema_version)
);
CREATE INDEX IF NOT EXISTS idx_story_thread_analyses_book_generated
  ON chapter.story_thread_analyses (book_id, generated_at ASC);

CREATE TABLE IF NOT EXISTS chapter.story_state_snapshots (
  book_id UUID PRIMARY KEY REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL DEFAULT 1,
  last_log_id UUID REFERENCES chapter.reading_log(id) ON DELETE SET NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Reader base tables must be created before their additive fields below.
CREATE TABLE IF NOT EXISTS chapter.ai_reader_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  page_start INT NOT NULL,
  page_end INT NOT NULL,
  chunk_analysis JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (log_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_reader_chunks_book ON chapter.ai_reader_chunks (book_id, processed_at ASC);
CREATE TABLE IF NOT EXISTS chapter.book_wiki (
  book_id UUID PRIMARY KEY REFERENCES chapter.books(id) ON DELETE CASCADE,
  pages_covered INT NOT NULL DEFAULT 0,
  overview TEXT NOT NULL DEFAULT '',
  concepts JSONB NOT NULL DEFAULT '[]', themes JSONB NOT NULL DEFAULT '[]', people JSONB NOT NULL DEFAULT '[]',
  chapter_map JSONB NOT NULL DEFAULT '[]', notable_quotes JSONB NOT NULL DEFAULT '[]', open_questions JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(), generation_ms INT
);

-- Migration: additive AI Reader narrative fields (idempotent).
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS schema_version SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS output_language TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS book_so_far TEXT NOT NULL DEFAULT '';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS current_position JSONB NOT NULL DEFAULT '{}';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS narrative_arc JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS carry_forward_insights JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ALTER COLUMN output_language SET DEFAULT 'en';
UPDATE chapter.book_wiki SET output_language = CASE WHEN overview ~ '[ăâđêôơưĂÂĐÊÔƠƯ]' THEN 'vi' ELSE 'en' END WHERE output_language = 'auto';
ALTER TABLE chapter.book_wiki DROP CONSTRAINT IF EXISTS book_wiki_output_language_check;
ALTER TABLE chapter.book_wiki ADD CONSTRAINT book_wiki_output_language_check
  CHECK (output_language IN ('vi', 'en'));
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS reading_path JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS thread_map JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS entity_map JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS connections JSONB NOT NULL DEFAULT '[]';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS current_reading_state JSONB NOT NULL DEFAULT '{}';
ALTER TABLE chapter.book_wiki ADD COLUMN IF NOT EXISTS next_session_context TEXT NOT NULL DEFAULT '';

-- Durable AI Reader job state. This lets the UI retain an honest “Running”
-- state across page refreshes while generation continues in the background.
CREATE TABLE IF NOT EXISTS chapter.ai_reader_jobs (
  book_id UUID PRIMARY KEY REFERENCES chapter.books(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- ───────────────────────────────────────────────────────────
-- chapter.review_cards (owner derived through the parent book)
-- ───────────────────────────────────────────────────────────
-- Cards are seeded only at new reading-log creation. The source-log/index key
-- prevents retries or duplicate writes from creating duplicate review cards.
CREATE TABLE IF NOT EXISTS chapter.review_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id          UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  log_id           UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  insight_index    INT NOT NULL CHECK (insight_index >= 0),
  insight          TEXT NOT NULL,
  interval_days    INT NOT NULL DEFAULT 1 CHECK (interval_days IN (1, 3, 7, 14, 30)),
  repetitions      INT NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  due_date         DATE NOT NULL,
  last_reviewed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (log_id, insight_index)
);
CREATE INDEX IF NOT EXISTS idx_review_cards_due ON chapter.review_cards (due_date, book_id);

-- ───────────────────────────────────────────────────────────
-- chapter.weekly_reading_goals (one personal target per reader)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter.weekly_reading_goals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  metric     TEXT NOT NULL CHECK (metric IN ('sessions', 'units')),
  target     INT NOT NULL CHECK (target > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);
