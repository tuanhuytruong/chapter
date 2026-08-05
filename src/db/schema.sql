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
  environment TEXT NOT NULL DEFAULT 'prd' CHECK (environment IN ('prd', 'dev')),
  password_hash TEXT,
  email TEXT,
  google_sub TEXT,
  email_verified_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  telegram_chat_id TEXT,
  podcast_voice_gender TEXT CHECK (podcast_voice_gender IS NULL OR podcast_voice_gender IN ('female', 'male')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS podcast_voice_gender TEXT;
-- Runtime APP_ENV is enforced at authentication; legacy accounts remain production.
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'prd';
ALTER TABLE chapter.users DROP CONSTRAINT IF EXISTS users_environment_check;
ALTER TABLE chapter.users ADD CONSTRAINT users_environment_check CHECK (environment IN ('prd', 'dev'));
CREATE INDEX IF NOT EXISTS idx_users_environment ON chapter.users (environment);
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE chapter.users ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique
  ON chapter.users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique
  ON chapter.users (google_sub) WHERE google_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS chapter.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_active_lookup
  ON chapter.password_reset_tokens (user_id, expires_at DESC) WHERE used_at IS NULL;

-- Durable, privacy-preserving counters for sensitive authentication routes.
-- rate_key is a SHA-256 hash of proxy-trusted IP plus normalized identifier.
CREATE TABLE IF NOT EXISTS chapter.auth_rate_limits (
  scope TEXT NOT NULL CHECK (scope IN ('login','forgot_password','reset_password','oauth')),
  rate_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, rate_key, window_started_at)
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_window_cleanup_idx
  ON chapter.auth_rate_limits (window_started_at);
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
  current_reading_round INT NOT NULL DEFAULT 1,
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

-- Reading rounds preserve every completed pass through a book. `books` stores
-- only the active cursor; this table is the lifecycle/history source of truth.
ALTER TABLE chapter.books ADD COLUMN IF NOT EXISTS current_reading_round INT NOT NULL DEFAULT 1;
-- Earlier DEV deployments used this temporary name. Preserve its value while
-- converging source and deployed schemas on current_reading_round.
ALTER TABLE chapter.books ADD COLUMN IF NOT EXISTS reading_round INT NOT NULL DEFAULT 1;
UPDATE chapter.books SET current_reading_round = GREATEST(current_reading_round, reading_round, 1);

CREATE TABLE IF NOT EXISTS chapter.book_reading_rounds (
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK (reading_round >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished', 'queued')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  final_page INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, reading_round)
);
INSERT INTO chapter.book_reading_rounds (book_id, reading_round, status, final_page, started_at, finished_at)
SELECT id, current_reading_round, status, current_page, created_at,
       CASE WHEN status='finished' THEN COALESCE(reflection_at, created_at) END
FROM chapter.books
ON CONFLICT (book_id, reading_round) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_book_reading_rounds_book_status ON chapter.book_reading_rounds (book_id, status, reading_round DESC);

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
ALTER TABLE chapter.book_reading_units ADD COLUMN IF NOT EXISTS page_label INT;
CREATE INDEX IF NOT EXISTS idx_book_reading_units_book_chapter
  ON chapter.book_reading_units (book_id, chapter_key, unit_index);

-- ───────────────────────────────────────────────────────────
-- chapter.reading_log
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter.reading_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES chapter.books (id) ON DELETE CASCADE,
  reading_round INT NOT NULL DEFAULT 1,
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
  ADD COLUMN IF NOT EXISTS reading_round INT NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_reading_log_book_round_date
  ON chapter.reading_log (book_id, reading_round, date DESC, session DESC);

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

-- One listener-owned resume marker per book and reading round. Episodes remain
-- generated/owned as before; this stores only playback state, never audio data.
CREATE TABLE IF NOT EXISTS chapter.podcast_playback_progress (
  user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK (reading_round >= 1),
  podcast_id UUID REFERENCES chapter.podcasts(id) ON DELETE SET NULL,
  current_time_seconds REAL NOT NULL DEFAULT 0 CHECK (current_time_seconds >= 0),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id, reading_round)
);
CREATE INDEX IF NOT EXISTS idx_podcast_playback_progress_book
  ON chapter.podcast_playback_progress (book_id, reading_round, updated_at DESC);

-- Podcast narrator is chosen per Book and per reading round. A re-read round
-- is a new session: it may pick a different voice, so the user-level default
-- (users.podcast_voice_gender) is NOT consulted for generation. Note: the
-- backfill of existing (book, round) pairs lives in the deployment migration
-- (migrations/20260805_podcast_narrator_per_round.sql), not here, because the
-- app bootstrap splits statements on ";" and LIKE patterns with % would break.
CREATE TABLE IF NOT EXISTS chapter.podcast_narrators (
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK (reading_round >= 1),
  voice_gender TEXT NOT NULL CHECK (voice_gender IN (female, male)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, reading_round)
);

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
-- Membership entitlement and auditable AI usage (Phase 0)
-- Provider-neutral state: payment integration is intentionally deferred.
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES chapter.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free','plus','deep_reader')) DEFAULT 'free',
  status TEXT NOT NULL CHECK (status IN ('active','trialing','canceled','past_due','expired')) DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  granted_by TEXT NOT NULL CHECK (granted_by IN ('payment','trial','admin','founding')) DEFAULT 'admin',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_unique
  ON chapter.subscriptions (provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS chapter.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('reserved','consumed','released')),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  request_key TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key, period_key, event_type, request_key)
);
CREATE INDEX IF NOT EXISTS usage_events_owner_period_feature
  ON chapter.usage_events (user_id, period_key, feature_key);

-- ───────────────────────────────────────────────────────────
-- chapter.membership_prompt_state (owner-scoped prompt dismissals)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter.membership_prompt_state (
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL CHECK (prompt_key IN ('reading_map_depth', 'book_wiki_depth', 'quota_reached')),
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, prompt_key)
);
CREATE INDEX IF NOT EXISTS idx_membership_prompt_state_owner
  ON chapter.membership_prompt_state (owner_id);

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


-- chapter.monthly_reviews (owner-scoped premium reading synthesis)
CREATE TABLE IF NOT EXISTS chapter.monthly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL CHECK (period_key ~ '^\d{4}-(0[1-9]|1[0-2])$'), schema_version SMALLINT NOT NULL,
  output_language TEXT NOT NULL CHECK (output_language IN ('vi','en')), payload JSONB NOT NULL,
  source_session_count INT NOT NULL CHECK (source_session_count >= 0), generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(owner_id,period_key)
);
CREATE INDEX IF NOT EXISTS idx_monthly_reviews_owner_generated ON chapter.monthly_reviews(owner_id,generated_at DESC);


-- chapter.ask_reading_answers (private durable grounded Q&A)
CREATE TABLE IF NOT EXISTS chapter.ask_reading_answers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, question TEXT NOT NULL, output_language TEXT NOT NULL CHECK(output_language IN ('vi','en')),
 answer TEXT NOT NULL, source_refs JSONB NOT NULL DEFAULT '[]'::jsonb, source_count INT NOT NULL CHECK(source_count>=0), schema_version SMALLINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(owner_id,request_key)
);
CREATE INDEX IF NOT EXISTS idx_ask_reading_answers_owner_created ON chapter.ask_reading_answers(owner_id,created_at DESC);

-- chapter.cross_book_connections (owner-scoped current premium artifact)
CREATE TABLE IF NOT EXISTS chapter.cross_book_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  schema_version SMALLINT NOT NULL,
  output_language TEXT NOT NULL CHECK (output_language IN ('vi','en')),
  payload JSONB NOT NULL,
  source_book_count INT NOT NULL CHECK (source_book_count >= 0),
  source_session_count INT NOT NULL CHECK (source_session_count >= 0),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);
ALTER TABLE chapter.cross_book_connections ADD COLUMN IF NOT EXISTS request_key TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_cross_book_connections_owner_generated
  ON chapter.cross_book_connections(owner_id, generated_at DESC);

-- Phase 3D: owner-scoped personalized next-reading podcast recap.
CREATE TABLE IF NOT EXISTS chapter.podcast_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'queued',
  output_language TEXT NOT NULL CHECK (output_language IN ('vi','en')),
  voice_model TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_book_count INT NOT NULL DEFAULT 0 CHECK (source_book_count >= 0),
  source_session_count INT NOT NULL DEFAULT 0 CHECK (source_session_count >= 0),
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
  CONSTRAINT podcast_recaps_status_check CHECK (status IN ('queued','scripting','synthesizing','archiving','archive_pending','ready','failed')),
  CONSTRAINT podcast_recaps_owner_unique UNIQUE (owner_id)
);
CREATE INDEX IF NOT EXISTS idx_podcast_recaps_owner_updated ON chapter.podcast_recaps(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_podcast_recaps_cache_expiry ON chapter.podcast_recaps(local_cache_until) WHERE local_cache_until IS NOT NULL;
ALTER TABLE chapter.podcast_recaps ADD COLUMN IF NOT EXISTS request_key TEXT NOT NULL DEFAULT '';
ALTER TABLE chapter.podcast_recaps ADD COLUMN IF NOT EXISTS schema_version SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE chapter.podcast_recaps DROP CONSTRAINT IF EXISTS podcast_recaps_status_check;
ALTER TABLE chapter.podcast_recaps ADD CONSTRAINT podcast_recaps_status_check CHECK (status IN ('queued','scripting','synthesizing','archiving','archive_pending','ready','failed'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_podcast_recaps_owner_request ON chapter.podcast_recaps(owner_id, request_key);
-- Keep the artifact table idempotent in bootstrap and deployment migration paths.
-- Phase 4: provider-neutral static MB VietQR billing.
CREATE TABLE IF NOT EXISTS chapter.billing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  transfer_reference TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('vietqr_static')),
  sku TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('plus','deep_reader')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('month','year')),
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd > 0),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  status TEXT NOT NULL CHECK (status IN ('created','pending','paid','expired','rejected','canceled')) DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, request_key),
  UNIQUE(transfer_reference)
);
CREATE INDEX IF NOT EXISTS billing_orders_owner_history_idx ON chapter.billing_orders(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_orders_pending_expiry_idx ON chapter.billing_orders(status, expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS chapter.billing_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES chapter.billing_orders(id) ON DELETE CASCADE,
  confirmer_id UUID REFERENCES chapter.users(id) ON DELETE SET NULL,
  receipt_reference TEXT NOT NULL,
  received_amount_vnd INTEGER NOT NULL CHECK (received_amount_vnd > 0),
  received_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(receipt_reference)
);

CREATE TABLE IF NOT EXISTS chapter.billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE REFERENCES chapter.billing_orders(id) ON DELETE RESTRICT,
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd > 0),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  provider TEXT NOT NULL CHECK (provider IN ('vietqr_static')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_transactions_owner_history_idx ON chapter.billing_transactions(owner_id, created_at DESC);


-- chapter.reading_lens_synthesis (one persisted journey per book)
CREATE TABLE IF NOT EXISTS chapter.reading_lens_synthesis (
  book_id UUID PRIMARY KEY REFERENCES chapter.books(id) ON DELETE CASCADE,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  through_line TEXT NOT NULL DEFAULT '',
  evolving_concepts JSONB NOT NULL DEFAULT '[]',
  resolved_questions JSONB NOT NULL DEFAULT '[]',
  open_questions JSONB NOT NULL DEFAULT '[]',
  tensions JSONB NOT NULL DEFAULT '[]',
  confidence_notes JSONB NOT NULL DEFAULT '[]',
  output_language TEXT NOT NULL DEFAULT 'en',
  sessions_covered INT NOT NULL DEFAULT 0,
  last_log_id UUID REFERENCES chapter.reading_log(id),
  last_log_date DATE,
  last_log_session INT,
  source_revision BIGINT NOT NULL DEFAULT 0,
  stale BOOLEAN NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reading_lens_synthesis_language_check CHECK (output_language IN ('vi','en'))
);
