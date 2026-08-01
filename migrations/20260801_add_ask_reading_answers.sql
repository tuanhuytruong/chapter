
-- chapter.ask_reading_answers (private durable grounded Q&A)
CREATE TABLE IF NOT EXISTS chapter.ask_reading_answers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, question TEXT NOT NULL, output_language TEXT NOT NULL CHECK(output_language IN ('vi','en')),
 answer TEXT NOT NULL, source_refs JSONB NOT NULL DEFAULT '[]'::jsonb, source_count INT NOT NULL CHECK(source_count>=0), schema_version SMALLINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(owner_id,request_key)
);
CREATE INDEX IF NOT EXISTS idx_ask_reading_answers_owner_created ON chapter.ask_reading_answers(owner_id,created_at DESC);
