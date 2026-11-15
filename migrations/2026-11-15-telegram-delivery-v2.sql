-- MANUAL ONLY. Never called by startup. PostgreSQL 13+. Runtime switches remain OFF.
-- Additive objects only; short lock timeout avoids waiting on shared application tables.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE UNIQUE INDEX IF NOT EXISTS telegram_users_environment_id ON chapter.users(environment,id);
CREATE UNIQUE INDEX IF NOT EXISTS telegram_books_owner_id ON chapter.books(owner_id,id);
CREATE TABLE IF NOT EXISTS chapter.telegram_identities (
 environment text NOT NULL CHECK(environment IN ('dev','prd')), id uuid NOT NULL DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE, telegram_user_id text NOT NULL CHECK(telegram_user_id ~ '^[0-9]+$'), private_chat_id text NOT NULL,
 revoked_at timestamptz, linked_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(environment,id), FOREIGN KEY(environment,user_id) REFERENCES chapter.users(environment,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS telegram_identity_user ON chapter.telegram_identities(environment,user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS telegram_identity_sender ON chapter.telegram_identities(environment,telegram_user_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS chapter.telegram_link_requests (
 environment text NOT NULL CHECK(environment IN ('dev','prd')), id uuid NOT NULL DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE, purpose text NOT NULL CHECK(purpose IN ('identity','destination','channel')),
 token_hash text NOT NULL CHECK(length(token_hash)=64), candidate jsonb, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(environment,id), FOREIGN KEY(environment,user_id) REFERENCES chapter.users(environment,id) ON DELETE CASCADE, UNIQUE(environment,token_hash)
);
CREATE TABLE IF NOT EXISTS chapter.telegram_destinations (
 environment text NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), manager_user_id uuid NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
 identity_id uuid NOT NULL, chat_id text NOT NULL, thread_id bigint NOT NULL DEFAULT 0 CHECK(thread_id>=0),
 type text NOT NULL CHECK(type IN ('private','group','supergroup','channel')), label text NOT NULL,
 state text NOT NULL DEFAULT 'paused' CHECK(state IN ('active','paused','revoked','error')), activated_at timestamptz NOT NULL DEFAULT now(), permissions_checked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(environment,id), FOREIGN KEY(environment,manager_user_id) REFERENCES chapter.users(environment,id) ON DELETE CASCADE, FOREIGN KEY(environment,identity_id) REFERENCES chapter.telegram_identities(environment,id) ON DELETE CASCADE, UNIQUE(environment,chat_id,thread_id), CHECK(type IN ('group','supergroup') OR thread_id=0)
);
CREATE TABLE IF NOT EXISTS chapter.telegram_book_grants (
 environment text NOT NULL, destination_id uuid NOT NULL, book_id uuid NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
 code text NOT NULL DEFAULT substr(replace(gen_random_uuid()::text,'-',''),1,12), granted_by uuid NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
 granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 PRIMARY KEY(environment,destination_id,book_id), FOREIGN KEY(environment,granted_by) REFERENCES chapter.users(environment,id) ON DELETE CASCADE, FOREIGN KEY(granted_by,book_id) REFERENCES chapter.books(owner_id,id) ON DELETE CASCADE, FOREIGN KEY(environment,destination_id) REFERENCES chapter.telegram_destinations(environment,id) ON DELETE CASCADE, UNIQUE(environment,destination_id,code)
);
CREATE TABLE IF NOT EXISTS chapter.telegram_subscriptions (
 environment text NOT NULL, destination_id uuid NOT NULL, local_time text NOT NULL CHECK(local_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), timezone text NOT NULL DEFAULT 'Asia/Bangkok', enabled boolean NOT NULL DEFAULT false,
 next_run_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(environment,destination_id), FOREIGN KEY(environment,destination_id) REFERENCES chapter.telegram_destinations(environment,id) ON DELETE CASCADE
);
-- Ledger survives destination recreation. Canonical chat/topic, never destination UUID, owns dedupe.
CREATE TABLE IF NOT EXISTS chapter.telegram_deliveries (
 environment text NOT NULL CHECK(environment IN ('dev','prd')), id uuid NOT NULL DEFAULT gen_random_uuid(), owner_id uuid REFERENCES chapter.users(id) ON DELETE CASCADE,
 destination_id uuid NOT NULL, canonical_destination text NOT NULL, reading_log_id uuid NOT NULL, reading_round integer NOT NULL, book_id uuid REFERENCES chapter.books(id) ON DELETE CASCADE,
 kind text NOT NULL DEFAULT 'summary' CHECK(kind='summary'), local_date date NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','sending','sent','retry_wait','failed','unknown','canceled','expired')),
 attempt_count integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), lease_token uuid, lease_until timestamptz, safe_error_code text,
 content_hash text NOT NULL, renderer_version integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(environment,id), FOREIGN KEY(environment,owner_id) REFERENCES chapter.users(environment,id) ON DELETE CASCADE, UNIQUE(environment,canonical_destination,reading_log_id,reading_round,kind)
);
CREATE INDEX IF NOT EXISTS telegram_delivery_due ON chapter.telegram_deliveries(environment,next_attempt_at) WHERE state IN ('pending','retry_wait','leased','sending');
CREATE TABLE IF NOT EXISTS chapter.telegram_delivery_parts (
 environment text NOT NULL, delivery_id uuid NOT NULL, part_index integer NOT NULL CHECK(part_index>=0), html text,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed','unknown','canceled')), telegram_message_id text, acknowledged_at timestamptz, attempt_count integer NOT NULL DEFAULT 0, sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(environment,delivery_id,part_index), FOREIGN KEY(environment,delivery_id) REFERENCES chapter.telegram_deliveries(environment,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chapter.telegram_webhook_updates (
 environment text NOT NULL CHECK(environment IN ('dev','prd')), bot_key text NOT NULL, update_id bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(environment,bot_key,update_id)
);
-- Deliberately bot-scoped, NOT environment-scoped: one bot shares quotas across releases.
CREATE TABLE IF NOT EXISTS chapter.telegram_rate_limits (
 bot_key text NOT NULL, scope text NOT NULL, next_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(bot_key,scope)
);
COMMIT;
-- Rollback: disable sender/scheduler/enqueue, retain all ledger/tables. Never DROP/reset sent history.
-- Preflight: SELECT to_regclass('chapter.telegram_deliveries');
