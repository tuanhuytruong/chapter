-- AI Reader: chunk-level processing log and synthesised book wiki
-- Each reading_log session the AI has processed gets one row in ai_reader_chunks.
-- The synthesised wiki for the whole book lives in book_wiki (upserted on each run).

CREATE TABLE IF NOT EXISTS chapter.ai_reader_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  log_id          UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  page_start      INT NOT NULL,
  page_end        INT NOT NULL,
  chunk_analysis  JSONB NOT NULL,  -- {concepts, themes, people, notable_quotes, chunk_summary}
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (log_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_reader_chunks_book
  ON chapter.ai_reader_chunks (book_id, processed_at ASC);

CREATE TABLE IF NOT EXISTS chapter.book_wiki (
  book_id         UUID PRIMARY KEY REFERENCES chapter.books(id) ON DELETE CASCADE,
  pages_covered   INT NOT NULL DEFAULT 0,
  overview        TEXT NOT NULL DEFAULT '',
  concepts        JSONB NOT NULL DEFAULT '[]',   -- [{name, definition}]
  themes          JSONB NOT NULL DEFAULT '[]',   -- [{name, description}]
  people          JSONB NOT NULL DEFAULT '[]',   -- [{name, pulse}]
  chapter_map     JSONB NOT NULL DEFAULT '[]',   -- [{page_start, page_end, title, summary}]
  notable_quotes  JSONB NOT NULL DEFAULT '[]',   -- [{text, page_start}]
  open_questions  JSONB NOT NULL DEFAULT '[]',   -- [string]
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  generation_ms   INT
);
