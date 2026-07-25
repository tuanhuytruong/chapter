-- Chapter multi-user migration. Review then run manually with psql "$DATABASE_URL" -f migrations/20260723_multi_user.sql
-- This is intentionally idempotent. It does not make ownership NOT NULL: create users and
-- backfill records first, then enforce that constraint in a separate migration.
CREATE SCHEMA IF NOT EXISTS chapter;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS chapter.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL, avatar_url TEXT, telegram_chat_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE chapter.books ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES chapter.users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_books_owner ON chapter.books(owner_id);
-- Backfill procedure (run after creating the intended owner):
-- UPDATE chapter.books SET owner_id='<user uuid>' WHERE owner_id IS NULL;
-- Do not add a NOT NULL constraint until every book/log owner has been audited and backfilled.
