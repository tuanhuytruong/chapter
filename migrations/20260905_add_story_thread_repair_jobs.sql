CREATE TABLE IF NOT EXISTS chapter.story_thread_repair_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INTEGER NOT NULL,
  first_log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('single_session','continuity')),
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed','awaiting_confirmation')),
  first_session INTEGER NOT NULL,
  current_session INTEGER,
  target_session INTEGER NOT NULL,
  rebuilt_sessions INTEGER NOT NULL DEFAULT 0,
  max_sessions INTEGER NOT NULL DEFAULT 15,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_story_thread_repair_jobs_book_round ON chapter.story_thread_repair_jobs (book_id, reading_round, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_story_thread_repair_jobs_active ON chapter.story_thread_repair_jobs (book_id, reading_round) WHERE status='running';
