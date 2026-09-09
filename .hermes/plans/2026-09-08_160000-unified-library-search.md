# Unified Library Search Implementation Plan

> **For Hermes:** Implement task-by-task with deterministic fixtures and preserve owner-only privacy boundaries.

**Goal:** Let a reader search their own books, generated knowledge, saved quotes, session notes, reflections, and Story Memory from the Library without any LLM or embedding request.

**Architecture:** Store compact owner-scoped searchable artifacts in `chapter.search_documents`. A Postgres GIN `tsvector` index handles ranked phrase/token search; a normalized unaccented text column plus trigram index handles Vietnamese accent-insensitive and near-name matching. Source writes call a narrow upsert/delete helper; one bounded owner-only backfill builds documents for existing artifacts. The Library debounces an owner-scoped API query and renders grouped, cited result cards that navigate to Book Detail.

**Tech stack:** PostgreSQL (`unaccent`, `pg_trgm`, GIN), Express/TypeScript, React/Vite, existing Chapter auth/API.

---

## Product and privacy contract

- Search is strictly owner-scoped. It never returns another reader’s book, notes, reflection, raw text, prompt, or source excerpt.
- Phase 1 indexes only user-owned/generated artifacts: book title/author, BookWiki, saved daily quotes, session notes, owner reflection, Story Thread session recap/inner movement, and Story Memory state/events.
- Do **not** index `reading_log.raw_text`, uploaded books, full prompts, credentials, or shared readers’ content.
- Search makes no LLM, embedding, cron, or background-provider call. It is a bounded DB query after a 180–250ms client debounce.
- Results use a sanitized indexed excerpt (max 320 chars), not `ts_headline` over raw text.
- “Search your library” only appears in **My Shelf**. All Readers keeps its existing book-title browsing semantics.
- Keep current shelf filtering/sorting behavior when query is empty. Search results replace—not mingle with—the shelf grid while a non-empty global query is active.

## Schema and query model

Create `chapter.search_documents`:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
  UNIQUE (owner_id, kind, source_key)
);
CREATE INDEX IF NOT EXISTS idx_search_documents_owner_vector
  ON chapter.search_documents USING GIN (owner_id, search_vector);
CREATE INDEX IF NOT EXISTS idx_search_documents_owner_normalized_trgm
  ON chapter.search_documents USING GIN (normalized_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_documents_owner_kind_updated
  ON chapter.search_documents (owner_id, kind, updated_at DESC);
```

`search_vector` is maintained by the app’s upsert helper using `to_tsvector('simple', normalized_text)`, not triggers, so source serialisation remains explicit and testable. `normalized_text` uses `unaccent(lower(coalesce(text,'')))` in SQL and NUL-strips/bounds text in TypeScript.

## Implementation tasks

### Task 1: Add migration, types, and pure document builder

**Files:**
- Create: `migrations/20260908_add_unified_library_search.sql`
- Modify: `src/db/schema.sql`
- Create: `src/librarySearch.ts`
- Create: `scripts/verify-library-search.ts`

**Steps:**
1. Add idempotent migration/table/extensions/indexes above.
2. Define `SearchDocumentKind`, `SearchDocumentInput`, `LibrarySearchResult`, and `buildSearchDocument()`.
3. Bound title to 220 chars/body to 4,000 chars and index excerpt to 320 chars; strip NUL and omit empty artifacts.
4. Fixture: Vietnamese `cô đơn` normalizes to `co don`; raw text is not accepted as a document kind; title/body bounds hold.
5. Do **not deploy/use** the table until Huy applies the migration to shared DB and it is probed.

### Task 2: Build repository/query boundary

**Files:**
- Create: `src/librarySearchRepository.ts`
- Modify: `src/routes/books.ts`
- Test: `scripts/verify-library-search.ts`

**Steps:**
1. Implement idempotent `upsertSearchDocument`, `deleteSearchDocuments`, and owner-only `searchLibrary`.
2. Query accepts `q` 2–120 chars, optional kind, optional book id, limit 1–30; reject invalid limits/UUIDs.
3. Rank exact normalized substring first, then `ts_rank_cd`, then trigram similarity; results max 24 and grouped client-side.
4. Return only: kind/title/excerpt/book metadata/round/log/page references—never raw text or source JSON.
5. Add `GET /api/books/search?q=&kind=&bookId=` behind existing auth. Require `scope=mine`; no shared endpoint.
6. Fixture static contract: owner predicate, `search_vector` + normalized fallback, no raw_text selection, bounded limit.

### Task 3: Index all write paths and existing records

**Files:**
- Modify: `src/routes/books.ts`
- Modify: `src/aiReader.ts`
- Modify: `src/storyThread.ts`
- Create: `scripts/backfill-library-search.ts`
- Test: `scripts/verify-library-search.ts`

**Steps:**
1. Upsert book document on create/update; delete cascades via book FK.
2. Upsert quote/note document after saved session and `PATCH .../logs/:logId`; delete note document when blank.
3. Upsert reflection after it is generated; delete/refesh it on reread reset.
4. Upsert one BookWiki document after successful final wiki upsert.
5. Upsert Story Thread session document after ready analysis; upsert Story Memory current snapshot/events after ready snapshot write.
6. Backfill CLI requires `--owner-id`; optional `--book-id`; refuses all-user mode; batches 50; logs only IDs/counts/kinds.
7. Existing outputs are serialised deliberately from their structured JSON fields; no raw source copy is ever read.
8. Fixture asserts all producer hooks and blank-note delete behavior.

### Task 4: API client and Library results UI

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api.ts`
- Modify: `src/pages/Library.tsx`
- Create: `src/components/LibrarySearchResults.tsx`
- Test: `scripts/verify-library-search-ui.ts`

**Steps:**
1. Add typed `api.searchLibrary()`.
2. Add Search your library input above the existing shelf controls only in My Shelf.
3. Debounce 220ms, cancel stale responses with request-generation guard, require two characters, maintain loading/empty/error state without blocking shelf load.
4. Render editorial groups: Books, Ideas, Quotes, Notes, Story. Results show book, artifact label, excerpt, and session/page or chunk reference.
5. Navigate book results to `/books/:id`; session/story result to `/books/:id?log=:logId&view=story-thread`; wiki to `/books/:id?tab=ai-reader`; quote/note to `/books/:id?log=:logId`.
6. Add scope filter chips (All, Books, Ideas, Quotes, Notes, Story), keyboard list navigation, accessible result count/live region, clear button, and 390px no-overflow coverage.
7. Maintain current library `q` behavior only for global search; when empty use the previous client-side title/author filter and shelf grid.

### Task 5: Backfill, regression, DEV verification

**Files:**
- Modify: `package.json` for verifier aliases only if needed
- Modify: `scripts/verify-library-search.ts`
- Modify: `scripts/verify-library-search-ui.ts`

**Steps:**
1. Apply migration manually to shared DB; run transaction-safe existence/index probe before app rollout.
2. Run owner-scoped DEV backfill for the approved test account only, then query known terms such as `cô đơn`, a note word, quote phrase, and a wiki concept.
3. Assert navigation URLs and client DOM after authenticated DEV browser search; test 390px and keyboard navigation.
4. Run `npm run lint`, focused verifiers, existing Story Thread/AI Reader verifiers, `git diff --check`, production build, and `npm run perf:audit:assets`.
5. Push/deploy DEV only after migration/probe/full gate. PRD remains untouched pending visual review and separate approval.

## Risks and mitigations

- **Vietnamese tokenization:** normalized accent-insensitive substring and trigram fallback supplement `simple` FTS; no false promise of semantic recall.
- **Index drift:** upsert all owned artifact writes plus explicit owner-only backfill; no nightly reindex needed.
- **Search leakage:** owner ID is mandatory in every query and notes/reflections are never exposed to shared reads.
- **DB size:** store compact generated/user artifacts only; no raw EPUB/PDF or raw session text.
- **Large Library UI:** debounce, cancel stale request results, limit result payload/query to 24, and avoid reloading shelf data for every keystroke.

## Acceptance criteria

- Searching an accented/unaccented Vietnamese term returns only the owner’s relevant indexed documents.
- Searching an AI Reader, Story Memory, quote, note, or reflection term produces a labeled result that opens its book/context.
- Empty query leaves Library shelf behavior unchanged.
- No search interaction calls an LLM endpoint.
- API response does not contain raw_text, prompts, credentials, or another user’s notes.
- Search result requests remain bounded and indexed; `EXPLAIN` uses the owner/vector index on representative query.
