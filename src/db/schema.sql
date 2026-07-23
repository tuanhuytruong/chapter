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
  cover_url     TEXT,
  reflection_text TEXT,
  reflection_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_status ON chapter.books (status);

-- Migration: add summary_lang to existing tables (idempotent; safe to re-run).
ALTER TABLE chapter.books
  ADD COLUMN IF NOT EXISTS summary_lang TEXT NOT NULL DEFAULT 'auto'
  CHECK (summary_lang IN ('auto', 'vi', 'en'));

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
  raw_text    TEXT NOT NULL,
  char_count  INT NOT NULL,
  UNIQUE (book_id, unit_index)
);
CREATE INDEX IF NOT EXISTS idx_book_reading_units_book_unit
  ON chapter.book_reading_units (book_id, unit_index);

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
ALTER TABLE chapter.reading_log
  ADD CONSTRAINT reading_log_book_id_date_session_key
  UNIQUE (book_id, date, session);
DROP INDEX IF EXISTS idx_reading_log_book_date;
CREATE INDEX IF NOT EXISTS idx_reading_log_book_date
  ON chapter.reading_log (book_id, date DESC, session DESC);

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
-- chapter.community_posts (persistent book club)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter.community_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name   TEXT NOT NULL,
  author_avatar TEXT NOT NULL,
  author_bio    TEXT NOT NULL DEFAULT 'Book Enthusiast',
  book_title    TEXT NOT NULL,
  book_author   TEXT NOT NULL,
  book_id       UUID REFERENCES chapter.books(id) ON DELETE SET NULL,
  summary       TEXT NOT NULL,
  content       TEXT NOT NULL,
  likes         INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chapter.community_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES chapter.community_posts(id) ON DELETE CASCADE,
  author_name   TEXT NOT NULL,
  author_avatar TEXT NOT NULL,
  author_bio    TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created ON chapter.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON chapter.community_comments (post_id, created_at ASC);
