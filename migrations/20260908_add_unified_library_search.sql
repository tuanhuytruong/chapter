-- Unified Library Search indexes compact generated/user artifacts only; never raw reading text.
-- No extension is required: Vietnamese accent-insensitive matching is normalized in app code.
CREATE TABLE IF NOT EXISTS chapter.search_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  reading_round INTEGER,
  log_id UUID REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('book','wiki','quote','note','reflection','story_session','story_memory')),
  source_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  search_vector tsvector NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id,kind,source_key)
);
CREATE INDEX IF NOT EXISTS idx_search_documents_owner_vector ON chapter.search_documents USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_search_documents_owner_kind_updated ON chapter.search_documents (owner_id,kind,updated_at DESC);

-- Initial compact backfill. Keep normalization expression in SQL dependency-free;
-- new writes use the app's Unicode normalization, including Vietnamese accents.
INSERT INTO chapter.search_documents (owner_id,book_id,reading_round,kind,source_key,title,body,normalized_text,search_vector,updated_at)
SELECT b.owner_id,b.id,b.current_reading_round,'book',b.id::text,b.title,
  concat_ws(E'\n',b.title,b.author),
  lower(translate(concat_ws(E'\n',b.title,b.author),'đĐ','dD')),
  to_tsvector('simple',lower(translate(concat_ws(E'\n',b.title,b.author),'đĐ','dD'))),now()
FROM chapter.books b
ON CONFLICT (owner_id,kind,source_key) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,normalized_text=EXCLUDED.normalized_text,search_vector=EXCLUDED.search_vector,updated_at=now();

INSERT INTO chapter.search_documents (owner_id,book_id,reading_round,kind,source_key,title,body,normalized_text,search_vector,updated_at)
SELECT b.owner_id,b.id,b.current_reading_round,'wiki',b.id::text,'BookWiki · '||b.title,
  concat_ws(E'\n',w.overview,w.book_so_far,w.current_position,w.narrative_arc,w.concepts::text,w.themes::text,w.people::text,w.open_questions::text,w.carry_forward_insights::text),
  lower(translate(concat_ws(E'\n',w.overview,w.book_so_far,w.current_position,w.narrative_arc,w.concepts::text,w.themes::text,w.people::text,w.open_questions::text,w.carry_forward_insights::text),'đĐ','dD')),
  to_tsvector('simple',lower(translate(concat_ws(E'\n',w.overview,w.book_so_far,w.current_position,w.narrative_arc,w.concepts::text,w.themes::text,w.people::text,w.open_questions::text,w.carry_forward_insights::text),'đĐ','dD'))),now()
FROM chapter.book_wiki w JOIN chapter.books b ON b.id=w.book_id
ON CONFLICT (owner_id,kind,source_key) DO UPDATE SET body=EXCLUDED.body,normalized_text=EXCLUDED.normalized_text,search_vector=EXCLUDED.search_vector,updated_at=now();

INSERT INTO chapter.search_documents (owner_id,book_id,reading_round,log_id,kind,source_key,title,body,normalized_text,page_start,page_end,search_vector,updated_at)
SELECT b.owner_id,rl.book_id,rl.reading_round,rl.id,'note',rl.id::text,'Note · '||b.title,rl.notes,
  lower(translate(rl.notes,'đĐ','dD')),rl.page_start,rl.page_end,to_tsvector('simple',lower(translate(rl.notes,'đĐ','dD'))),now()
FROM chapter.reading_log rl JOIN chapter.books b ON b.id=rl.book_id WHERE nullif(btrim(rl.notes),'') IS NOT NULL
ON CONFLICT (owner_id,kind,source_key) DO UPDATE SET body=EXCLUDED.body,normalized_text=EXCLUDED.normalized_text,search_vector=EXCLUDED.search_vector,updated_at=now();

INSERT INTO chapter.search_documents (owner_id,book_id,reading_round,kind,source_key,title,body,normalized_text,search_vector,updated_at)
SELECT b.owner_id,b.id,b.current_reading_round,'reflection',b.id::text,'Reflection · '||b.title,b.reflection_text,
  lower(translate(b.reflection_text,'đĐ','dD')),to_tsvector('simple',lower(translate(b.reflection_text,'đĐ','dD'))),now()
FROM chapter.books b WHERE nullif(btrim(b.reflection_text),'') IS NOT NULL
ON CONFLICT (owner_id,kind,source_key) DO UPDATE SET body=EXCLUDED.body,normalized_text=EXCLUDED.normalized_text,search_vector=EXCLUDED.search_vector,updated_at=now();

INSERT INTO chapter.search_documents (owner_id,book_id,reading_round,log_id,kind,source_key,title,body,normalized_text,page_start,page_end,search_vector,updated_at)
SELECT b.owner_id,rl.book_id,rl.reading_round,rl.id,'quote',rl.id::text,'Quote · '||b.title,rl.quote,
  lower(translate(rl.quote,'đĐ','dD')),rl.page_start,rl.page_end,to_tsvector('simple',lower(translate(rl.quote,'đĐ','dD'))),now()
FROM chapter.reading_log rl JOIN chapter.books b ON b.id=rl.book_id WHERE nullif(btrim(rl.quote),'') IS NOT NULL
ON CONFLICT (owner_id,kind,source_key) DO UPDATE SET body=EXCLUDED.body,normalized_text=EXCLUDED.normalized_text,search_vector=EXCLUDED.search_vector,updated_at=now();

INSERT INTO chapter.search_documents (owner_id,book_id,reading_round,log_id,kind,source_key,title,body,normalized_text,page_start,page_end,search_vector,updated_at)
SELECT b.owner_id,sta.book_id,rl.reading_round,rl.id,'story_session',rl.id::text,'Story Thread · '||b.title,
  concat_ws(E'\n',sta.story_recap,sta.analysis::text),lower(translate(concat_ws(E'\n',sta.story_recap,sta.analysis::text),'đĐ','dD')),rl.page_start,rl.page_end,
  to_tsvector('simple',lower(translate(concat_ws(E'\n',sta.story_recap,sta.analysis::text),'đĐ','dD'))),now()
FROM chapter.story_thread_analyses sta JOIN chapter.reading_log rl ON rl.id=sta.log_id JOIN chapter.books b ON b.id=sta.book_id
ON CONFLICT (owner_id,kind,source_key) DO UPDATE SET body=EXCLUDED.body,normalized_text=EXCLUDED.normalized_text,search_vector=EXCLUDED.search_vector,updated_at=now();

INSERT INTO chapter.search_documents (owner_id,book_id,reading_round,log_id,kind,source_key,title,body,normalized_text,page_start,page_end,search_vector,updated_at)
SELECT b.owner_id,s.book_id,s.reading_round,s.covered_log_id,'story_memory',s.book_id::text||':'||s.reading_round,'Story Memory · '||b.title,
  s.state::text,lower(translate(s.state::text,'đĐ','dD')),NULL,NULL,to_tsvector('simple',lower(translate(s.state::text,'đĐ','dD'))),now()
FROM chapter.story_memory_snapshots s JOIN chapter.books b ON b.id=s.book_id WHERE s.status='ready'
ON CONFLICT (owner_id,kind,source_key) DO UPDATE SET body=EXCLUDED.body,normalized_text=EXCLUDED.normalized_text,search_vector=EXCLUDED.search_vector,updated_at=now();
