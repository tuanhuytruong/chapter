# Chapter Podcast Implementation Plan

> **For Hermes:** Implement task-by-task under the Chapter delivery workflow; verify each backend/UI slice before moving on.

**Goal:** Add an EPUB-only, chapter-based Podcast tab where Chapter generates a spoiler-aware narrated episode through 9router, archives audio privately in Telegram, and streams it only in the authenticated web app.

**Architecture:** A persisted podcast job assembles one complete EPUB chapter from stable spine-derived identities, asks the 9router LLM for a narration script, calls the 9router OpenAI-compatible speech endpoint for MP3, uploads the final audio to a private Telegram archive chat, and keeps a 48-hour local cache. The browser never receives Telegram IDs, Bot credentials, or Telegram URLs; it listens through an owner-checked HTTP Range streaming route.

**Tech stack:** Express + TypeScript, PostgreSQL (`chapter` schema), existing generic `callLLM()` 9router scheduler, 9router `/v1/audio/speech`, Telegram Bot API, React/Vite native `<audio>` player.

---

## Final product decisions

### Scope and UX

- **EPUB only in V1.** PDFs do not enter the Podcast UI or generation API.
- One episode covers **one full EPUB chapter**, not one daily reading session.
- A single narrator voice is used throughout every episode. No multi-character voices, emotional voice switching, or SSML work in V1.
- Podcast is **web-only**. Telegram is an invisible storage/transport layer; users do not link, message, or listen through the bot.
- The Book Detail gains a **Podcast** tab beside existing reading views.
- Recommended labels:
  - Tab: `Podcast`
  - Completed current chapter: `Create chapter episode` / `Listen to this chapter`
  - Unread next chapter: `Preview next chapter` with spoiler confirmation.
- No automatic generation after `Read next session` in V1. Generation is an explicit owner action so a full-chapter episode cannot unintentionally spoil unread content.

### Voice setup and language

- At the first attempted podcast generation, the user must choose a narrator gender: `Female` or `Male`.
- This preference is stored on `chapter.users` and becomes immutable through normal UI/API flows. If missing, generate returns `409 podcast voice preference required`.
- The model resolves from the book’s concrete/resolved language:
  - Vietnamese female: `edge-tts/vi-VN-HoaiMyNeural`
  - Vietnamese male: `edge-tts/vi-VN-NamMinhNeural`
  - English female: `edge-tts/en-US-JennyNeural`
  - English male: `edge-tts/en-US-ChristopherNeural`
- `summary_lang=auto` must resolve to a concrete `vi` or `en` before speech generation. If the book has no safe resolved language, generation fails with an actionable owner message rather than silently changing voice/language.

### Audio and storage lifecycle

1. Generate narration script from chapter raw text only.
2. Synthesize MP3 via 9router:
   ```http
   POST /v1/audio/speech
   Authorization: Bearer $NINE_ROUTER_API_KEY
   Content-Type: application/json

   { "model": "edge-tts/<voice>", "input": "..." }
   ```
3. Upload MP3 to a bot-controlled **private Telegram archive chat**.
4. Store `tg_file_id` and archive metadata in Postgres.
5. Retain the local MP3 cache for **48 hours after successful archive upload**.
6. A cleanup job removes expired cache files. Later playback obtains the audio server-side from Telegram and proxies it to the authenticated browser.

Telegram must never be used as a user-facing player, and `tg_file_id` must never be returned by a browser API.

### Concurrency and lifecycle

- `POST` generation endpoints only enqueue/claim a job and return `202`; they never wait for LLM, TTS, Telegram upload, or proxy download.
- The background runner uses the existing priority-aware 9router scheduler with `background` priority and strict errors.
- Use an idempotent durable state machine: `queued → scripting → synthesizing → archiving → ready`, with terminal `failed` and explicit owner retry/regenerate.
- Deduplicate by `(book_id, chapter_key, reading_round)` rather than date. One chapter can span multiple reading sessions/days; re-reading uses the existing reading-round identity.

---

## Data model and migration

### `chapter.users`

Add:

```sql
ALTER TABLE chapter.users
  ADD COLUMN IF NOT EXISTS podcast_voice_gender TEXT;
ALTER TABLE chapter.users
  DROP CONSTRAINT IF EXISTS users_podcast_voice_gender_check;
ALTER TABLE chapter.users
  ADD CONSTRAINT users_podcast_voice_gender_check
  CHECK (podcast_voice_gender IS NULL OR podcast_voice_gender IN ('female', 'male'));
```

The API accepts the value only if currently null. A later mutation returns `409 podcast voice preference is locked`.

### Stable EPUB chapter identity

Current `book_reading_units` keeps `title` but not a durable spine/chapter identity; grouping all equal titles can accidentally merge non-contiguous sections. Extend extraction and persistence with a stable chapter boundary key derived from the EPUB spine item (for example `idref`/`href`) and its sequence:

```sql
ALTER TABLE chapter.book_reading_units
  ADD COLUMN IF NOT EXISTS spine_index INT;
ALTER TABLE chapter.book_reading_units
  ADD COLUMN IF NOT EXISTS chapter_key TEXT;
CREATE INDEX IF NOT EXISTS idx_book_reading_units_book_chapter
  ON chapter.book_reading_units (book_id, chapter_key, unit_index);
```

New EPUB units must populate both values. Existing EPUB units with null `chapter_key` must have an explicit safe fallback: only a contiguous bounded window around the current session may be used, with UI title `Section units X–Y`; no global `title` grouping.

### `chapter.podcasts`

Create an episode/job record with durable state and storage references:

```sql
CREATE TABLE IF NOT EXISTS chapter.podcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  log_id UUID REFERENCES chapter.reading_log(id) ON DELETE SET NULL,
  reading_round INT NOT NULL DEFAULT 1,
  chapter_key TEXT NOT NULL,
  chapter_title TEXT,
  language TEXT NOT NULL CHECK (language IN ('vi', 'en')),
  voice_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'scripting', 'synthesizing', 'archiving', 'ready', 'failed')),
  script_text TEXT,
  word_count INT,
  duration_s INT,
  tg_file_id TEXT,
  tg_file_unique_id TEXT,
  tg_chat_id TEXT,
  tg_message_id BIGINT,
  local_cache_path TEXT,
  local_cache_until TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, chapter_key, reading_round)
);
CREATE INDEX IF NOT EXISTS idx_podcasts_user_book_created
  ON chapter.podcasts (user_id, book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_podcasts_cache_expiry
  ON chapter.podcasts (local_cache_until)
  WHERE local_cache_until IS NOT NULL;
```

`tg_file_id` remains nullable until archival succeeds; failed jobs retain a bounded safe error, never raw chapter text or provider response.

---

## Implementation tasks

### Task 1: Add schema, config, and startup validation

**Files**
- Modify: `src/db/schema.sql`, `src/db.ts`, `src/config.ts`, `.env.example`
- Create: `migrations/20260728_add_podcast.sql`

**Work**
- Add the user voice field, EPUB chapter identity columns, and `podcasts` relation.
- Add `PODCAST_TELEGRAM_ARCHIVE_CHAT_ID`, cache directory, 48-hour TTL, and explicit TTS endpoint/model configuration. Reuse `NINE_ROUTER_API_KEY`; do not create/commit secrets.
- Extend `verifyCoreSchema()` to require `chapter.podcasts` only once the deployment migration is part of the released feature.
- Add a safe cache directory under app-controlled storage; never accept client-provided paths.

**Verify**
- Idempotent SQL runs twice in a PostgreSQL-compatible verifier.
- Startup verification identifies a deliberately absent `chapter.podcasts` relation.
- `.env.example` contains placeholders only.

### Task 2: Preserve EPUB chapter identity during extraction

**Files**
- Modify: `src/extractor.ts`, `src/routes/books.ts`, `src/db/schema.sql`
- Test: focused EPUB extractor fixture/verifier under `scripts/`

**Work**
- Extend `EpubReadingUnit` with `spineIndex` and `chapterKey`.
- Flush reading chunks at each spine boundary so a chunk can never cross from one chapter/spine item into another.
- Use a deterministic `chapterKey` based on EPUB spine identity; preserve the human title separately.
- Persist new fields when `ensureEpubReadingUnits()` creates units.
- Make chapter assembly select one exact `chapter_key`, ordered by `unit_index`.

**Verify**
- A fixture with repeated/empty titles produces distinct contiguous chapter keys.
- No assembled chapter contains units from two different keys.
- Existing EPUB progress behavior remains intact.

### Task 3: Add podcast domain modules and strict LLM script generation

**Files**
- Create: `src/podcast/prompt.ts`, `src/podcast/generate.ts`, `src/podcast/types.ts`
- Modify: `src/llm.ts`
- Test: `scripts/verify-podcast.ts` or equivalent deterministic tests

**Work**
- Build a spoiler-aware, warm narrated-script prompt grounded solely in full-chapter `book_reading_units.raw_text`.
- Request plain spoken prose; validate minimum meaningful length and reject Markdown headings, lists, and formatting artifacts.
- Use strict `callLLM()` with a podcast-specific background timeout and an explicit per-call model override from `PODCAST_LLM_MODEL`.
- Retry one time only after validation failure; retain no silent prose fallback.
- Resolve concrete language and locked user voice before generation.
- Claim/upsert the episode before starting work; persist status transitions and bounded errors.

**Verify**
- Prompt and validation fixtures cover plain prose, too-short text, Markdown artifacts, retry, and strict LLM failure.
- Source inspection/test proves only raw chapter text reaches the podcast prompt.
- Duplicate requests for the same chapter/round result in one episode/job.

### Task 4: Add 9router TTS client and MP3 composition

**Files**
- Create: `src/podcast/tts.ts`
- Modify: `src/config.ts`, `.env.example`
- Test: deterministic request/response and chunk-planning verifier

**Work**
- Call `${NINE_ROUTER_BASE}/audio/speech` (or configured equivalent) with Bearer auth and `{ model, input }`; validate binary MP3 response and content type.
- Bound each request by a configurable character limit, split only on natural paragraph/sentence boundaries, and merge chunks into one final MP3 using a verified available tool/library.
- Ensure all temporary input/chunk files are removed in `finally` on success and failure.
- Estimate or inspect duration without trusting a hard-coded bitrate alone; keep duration nullable if provider/media metadata cannot supply a reliable value.

**Verify**
- Local HTTP stub confirms auth, model, payload, timeout, non-2xx handling, and binary writes.
- Chunk planner preserves input order and text content across boundaries.
- Temp-file cleanup runs after a simulated failure.
- Before implementation chooses a merger, confirm the production host supports the required dependency (for example `ffmpeg`) or use a Node-compatible alternative.

### Task 5: Add Telegram archive and protected playback proxy

**Files**
- Create: `src/podcast/telegram.ts`, `src/podcast/audioStream.ts`
- Modify: `src/telegram.ts` only for shared safe primitives if useful
- Test: Telegram/API stub plus Range-response tests

**Work**
- Upload completed MP3 to `PODCAST_TELEGRAM_ARCHIVE_CHAT_ID` using `sendAudio`; store `file_id`, unique ID, archive chat ID, and message ID.
- Never use per-user `telegram_chat_id` for this feature.
- Implement archive retrieval: `getFile(tg_file_id)` server-side then download via Bot API without exposing the Bot token or file path to the browser.
- Implement `GET /api/podcast/:id/audio` with session + owner check and correct `Accept-Ranges`, `Range`, `Content-Range`, `206`, and `416` behavior.
- Serve the unexpired local cache first; otherwise fetch/cache from Telegram while honoring the 48-hour cache policy.

**Verify**
- Test upload response extraction and provider error handling with fake Bot API responses.
- Verify owner can fetch a byte range and receives a correct 206 response.
- Verify unauthenticated access is 401 and a second user is denied.
- Verify API JSON/history payload never includes Telegram IDs, archive chat IDs, cache paths, or bot data.

### Task 6: Add background runner, cache cleanup, and podcast routes

**Files**
- Create: `src/routes/podcast.ts`, `src/podcast/runner.ts`, `scripts/cleanup-podcast-cache.ts`
- Modify: `server.ts`, `src/api.ts`

**Routes**
- `POST /api/podcast/voice` — set initial gender only; reject later updates.
- `POST /api/podcast/books/:bookId/generate` — owner-only, EPUB-only, spoiler-aware chapter selection; returns `202` job/episode state.
- `POST /api/podcast/books/:bookId/preview-next` — owner-only, exact next chapter; requires explicit `confirm_spoilers: true`.
- `GET /api/podcast/books/:bookId/history` — owner-only safe episode metadata.
- `GET /api/podcast/:id` — owner-only status, safe metadata, transcript availability.
- `GET /api/podcast/:id/audio` — owner-only Range stream.
- `POST /api/podcast/:id/regenerate` — owner-only explicit retry/regeneration.

**Work**
- Mount router after app authentication middleware.
- Detach runner work from request lifecycle with `.catch()` telemetry; ensure no unhandled rejection can crash the process.
- Add a cron/scheduled cleanup invocation appropriate to the deployment environment; it deletes only expired paths located beneath the controlled podcast cache root.
- n8n integration is deferred in V1 because creation is user-triggered; no long-running n8n HTTP node is required.

**Verify**
- Route ordering/source verifier confirms static routes precede dynamic `/:id` paths.
- API tests cover 401, non-owner 403/404 policy, non-EPUB 400, missing voice 409, spoiler confirmation 400, enqueue 202, and failed-job retry.
- Cache cleanup fixture cannot delete a path outside the cache root.

### Task 7: Build the Book Detail Podcast tab

**Files**
- Create: `src/components/PodcastTab.tsx`, optional small `PodcastVoiceSetup.tsx`
- Modify: `src/pages/BookDetail.tsx`, `src/api.ts`, `src/types.ts`

**Work**
- Render Podcast only for EPUB books; leave PDF Book Detail unchanged.
- First-use voice selector clearly states that the choice is permanent; once saved, render selected voice as read-only metadata rather than an editable setting.
- Render safe states: no episode, ready player, queued/script/TTS/archive progress, retryable failure, transcript disclosure, current chapter action, spoiler-confirmed next-chapter preview.
- Use native `<audio controls src="/api/podcast/:id/audio">` so browser range requests work naturally. Do not download/handle Telegram files in client code.
- Poll only non-terminal episode states; preserve the active Book Detail tab, scroll, and player state across status refreshes.
- Keep controls owner-only and touch-safe; do not let optional podcast load failures make Book Detail unavailable.

**Verify**
- Component/API fixtures cover every state and immutable voice setup.
- Typecheck, build, and an authenticated actual Library → EPUB Book Detail → Podcast desktop + ~390px mobile browser smoke.
- Check console, player controls, no viewport overflow, and that no Telegram language/UI leaks into the screen.

### Task 8: Delivery and production validation

**Files**
- Modify: deployment verification/config documentation only if required by existing project conventions.

**Production prerequisites**
- Create/confirm private Telegram archive chat and add the bot with permission to post audio.
- Set production env: `PODCAST_TELEGRAM_ARCHIVE_CHAT_ID`, cache root/TTL, LLM/TTS model/timeouts, and existing 9router/Telegram secrets.
- Run the standalone idempotent migration before application deploy.

**Production smoke checks**
1. First-use voice selection locks correctly; a second update is rejected.
2. Create an episode from a known completed EPUB chapter and verify state progresses to `ready`.
3. Confirm the MP3 is present in the private archive chat while user sees no Telegram integration.
4. Listen through web at desktop/mobile; seek to a later timestamp and verify a `206` Range response.
5. After cache expiry/forced local-cache removal, replay succeeds by server-side Telegram fetch.
6. Confirm a non-owner and anonymous request cannot retrieve metadata, script, or audio.

---

## Explicit non-goals for V1

- Multiple character voices, inferred gender, emotional prosody, SSML, or narrator/character switching.
- PDF podcast support.
- Automatic generation after every reading advance.
- Telegram user linking, Telegram DMs, bot commands, or Telegram-based listening.
- Public/shareable podcast URLs.
- A download/export button; streaming only.

## Important risks and guards

- **Spoilers:** full chapters can extend beyond a daily session. Default to completed/current chapter; require explicit confirmation before generating the next unread chapter.
- **EPUB structure:** never group globally by display title. Use stable spine/chapter keys and contiguous units.
- **Long TTS input:** chunk at provider-safe natural boundaries and merge deterministically.
- **Provider capacity:** route LLM work through the existing global scheduler at background priority; retain explicit timeouts/retry bounds.
- **Storage privacy:** Telegram is private archive only; never expose archive metadata or bot tokens. Playback remains owner-checked and proxied.
- **Schema rollout:** `chapter.podcasts` is a migration gate; health/lint alone cannot prove it exists.

---

## Final approval checklist

- [ ] Explicit owner action, no automatic post-read generation in V1.
- [ ] Full chapter means spine-derived `chapter_key`, not shared display title.
- [ ] One immutable user narrator gender and the four specified language/voice mappings.
- [ ] Telegram private archive only; web-only playback via protected Range streaming.
- [ ] Archive immediately after synthesis, local cache retained 48 hours.
- [ ] Episode/job state is durable and async; dedupe is `(book, chapter_key, reading_round)`.
- [ ] V1 excludes multi-voice/emotion, PDFs, Telegram UX, and public/download links.
- [ ] Approved plan proceeds via Kanban → implementation → real verification → auto commit/push to `dev`.
