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
