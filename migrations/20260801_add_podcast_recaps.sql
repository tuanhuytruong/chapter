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
CREATE OR REPLACE FUNCTION chapter.podcast_recaps_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS podcast_recaps_touch_updated_at ON chapter.podcast_recaps;
CREATE TRIGGER podcast_recaps_touch_updated_at BEFORE UPDATE ON chapter.podcast_recaps FOR EACH ROW EXECUTE FUNCTION chapter.podcast_recaps_touch_updated_at();

-- Keep the artifact table idempotent in bootstrap and deployment migration paths.