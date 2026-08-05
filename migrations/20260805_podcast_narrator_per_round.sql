CREATE TABLE IF NOT EXISTS chapter.podcast_narrators (
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK (reading_round >= 1),
  voice_gender TEXT NOT NULL CHECK (voice_gender IN ('female', 'male')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, reading_round)
);

INSERT INTO chapter.podcast_narrators (book_id, reading_round, voice_gender)
SELECT DISTINCT ON (book_id, reading_round)
  book_id, reading_round,
  CASE
    WHEN voice_model LIKE '%HoaiMyNeural' OR voice_model LIKE '%JennyNeural' THEN 'female'
    WHEN voice_model LIKE '%NamMinhNeural' OR voice_model LIKE '%ChristopherNeural' THEN 'male'
  END
FROM chapter.podcasts
WHERE voice_model LIKE '%HoaiMyNeural'
   OR voice_model LIKE '%JennyNeural'
   OR voice_model LIKE '%NamMinhNeural'
   OR voice_model LIKE '%ChristopherNeural'
ORDER BY book_id, reading_round, created_at ASC
ON CONFLICT (book_id, reading_round) DO NOTHING;
