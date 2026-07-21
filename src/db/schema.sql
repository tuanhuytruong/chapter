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
-- chapter.books
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter.books (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  author        TEXT NOT NULL DEFAULT 'Unknown',
  file_path     TEXT NOT NULL,
  file_type     TEXT NOT NULL CHECK (file_type IN ('pdf', 'epub')),
  total_pages   INT NOT NULL DEFAULT 0,
  daily_pages   INT NOT NULL DEFAULT 20,
  current_page  INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished')),
  summary_lang  TEXT NOT NULL DEFAULT 'auto' CHECK (summary_lang IN ('auto', 'vi', 'en')),
  cover_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_status ON chapter.books (status);

-- Migration: add summary_lang to existing tables (idempotent; safe to re-run).
ALTER TABLE chapter.books
  ADD COLUMN IF NOT EXISTS summary_lang TEXT NOT NULL DEFAULT 'auto'
  CHECK (summary_lang IN ('auto', 'vi', 'en'));

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
