-- Listening rhythm — twin-track view (listening days / streak / book audio completion).
-- One row per (user, episode, day), idempotent when an episode is re-listened in a day.
CREATE TABLE IF NOT EXISTS chapter.podcast_listen_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  book_id         UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  podcast_id      UUID REFERENCES chapter.podcasts(id) ON DELETE SET NULL,
  chapter_key     TEXT NOT NULL,
  reading_round   INT NOT NULL DEFAULT 1 CHECK (reading_round >= 1),
  listened_on     DATE NOT NULL,
  seconds_heard   REAL NOT NULL DEFAULT 0 CHECK (seconds_heard >= 0),
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, podcast_id, listened_on)
);
CREATE INDEX IF NOT EXISTS idx_listen_events_user_day
  ON chapter.podcast_listen_events (user_id, listened_on);
CREATE INDEX IF NOT EXISTS idx_listen_events_user_book_round
  ON chapter.podcast_listen_events (user_id, book_id, reading_round);