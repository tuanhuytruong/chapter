
CREATE TABLE IF NOT EXISTS chapter.generation_progress (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE, book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE, reading_round INTEGER NOT NULL CHECK (reading_round >= 1), resource_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('read_now','podcast')), status TEXT NOT NULL CHECK (status IN ('queued','running','retrying','ready','failed','interrupted')), stage TEXT NOT NULL, percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100), error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ, CHECK ((status='ready' AND percent=100) OR status<>'ready')
);
CREATE INDEX IF NOT EXISTS generation_progress_owner_book_active_idx ON chapter.generation_progress(owner_id,book_id,reading_round,updated_at DESC) WHERE status IN ('queued','running','retrying');
CREATE UNIQUE INDEX IF NOT EXISTS generation_progress_active_scope_idx ON chapter.generation_progress(owner_id,book_id,reading_round,kind,COALESCE(resource_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE status IN ('queued','running','retrying');
ALTER TABLE chapter.podcasts ADD COLUMN IF NOT EXISTS tts_retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chapter.podcasts ADD COLUMN IF NOT EXISTS tts_next_retry_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS podcasts_tts_retry_due_idx ON chapter.podcasts(tts_next_retry_at) WHERE status='synthesizing' AND tts_next_retry_at IS NOT NULL;
