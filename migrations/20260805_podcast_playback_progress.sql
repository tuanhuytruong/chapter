-- Continuous book podcast playlists: one resume marker per book + reading round.
CREATE TABLE IF NOT EXISTS chapter.podcast_playback_progress (
  user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK (reading_round >= 1),
  podcast_id UUID NOT NULL REFERENCES chapter.podcasts(id) ON DELETE CASCADE,
  current_time_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id, reading_round)
);

CREATE INDEX IF NOT EXISTS idx_podcast_playback_progress_round
  ON chapter.podcast_playback_progress (book_id, reading_round);
