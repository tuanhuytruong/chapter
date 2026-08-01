# Chapter Phase 3D — Personalized Next-reading Podcast Recap Implementation Plan

> **For Hermes:** Execute only after Huy approves this plan. Keep scope limited to Personalized Next-reading Podcast Recap; do not begin payment, recap podcast archive redesign, or unrelated membership UX.

**Goal:** Add an owner-scoped, Deep Reader-only podcast recap that helps the reader connect recent reading progress to a gentle next-reading direction, using the existing podcast narrator/voice and persisted reading data without exposing raw source text.

**Architecture:** Add a versioned per-owner recap artifact and durable generation state backed by PostgreSQL. Retrieve only authenticated-owner summaries, insights, notes, quotes, Reading Lens summaries, Book Wiki summaries, and book metadata; do not send `reading_log.raw_text`, EPUB chapter text, full AI Reader chunk JSON, or private Telegram identifiers to the recap prompt/API. Generate a bounded strict-JSON companion brief with the existing `callLLM()` dispatcher, convert it to speech through the existing narrator/voice pipeline, and persist the audio/metadata in a dedicated recap table while reusing the existing private local-cache/Telegram archive lifecycle where safe. Use `reserveUsage` → persist → `consumeUsage`, and `releaseUsage` on every failure path.

**Tech Stack:** React + TypeScript, Express, PostgreSQL `chapter` schema, existing `callLLM()`/JSON mode, existing Podcast TTS/archive helpers, `usage.ts`, `entitlements.ts`, Tailwind UI.

---

## Product and safety contract

- Feature key: `podcast_recap_generation`; only an active `deep_reader` entitlement may generate it; quota remains centrally defined in `entitlements.ts`.
- Reading, progress, achievements, ordinary chapter podcast access, notes, and quotes remain unaffected.
- The server derives owner, tier, quota, period, source IDs, resolved language, and narrator voice. Ignore client owner IDs, tier, usage, period, source records, and voice model for authorization.
- Source retrieval must join through `books.owner_id = $authenticatedOwnerId` for every branch. Never use shared/read-only book endpoints as the privacy boundary.
- Use saved companion data only: reading-log `summary`, `key_insights`, `notes`, `quote`, chapter/book metadata, Reading Lens `analyst_summary`, and bounded Book Wiki narrative fields. Never place full `raw_text`, EPUB `book_reading_units.raw_text`, `ai_reader_chunks.chunk_analysis`, or Telegram IDs in the prompt or public response.
- If there is insufficient recent reading evidence, return `no_source` without an LLM request and without charging quota.
- Preserve the previous valid recap artifact/audio while a refresh is queued or fails. A failed new generation must not delete the prior listenable artifact.
- One narrator voice per user remains immutable after the existing first-podcast voice selection. Recap language follows the resolved recent reading language, while TTS uses the persisted user narrator gender and the existing voice mapping.
- Every returned citation/source reference must be validated against the server-selected source set and owner/book IDs before persistence.
- Existing generated recap remains readable after downgrade; only new generation is gated.

---

## Current audit findings

- Existing chapter podcast generation is chapter-first and uses `book_reading_units.raw_text` in `src/podcast/generate.ts`; it must not be reused as the recap prompt source.
- Existing narrator mapping is in `src/podcast/generate.ts`: Vietnamese female/male and English female/male Edge TTS voices. User preference is stored as `users.podcast_voice_gender` and is set once.
- Existing Podcast persistence is `chapter.podcasts`, unique by `(book_id, chapter_key, reading_round)`; it is not suitable for one owner-level recap, so use a dedicated table rather than overloading chapter rows.
- Existing Podcast routes are in `src/routes/podcasts.ts`, mounted at `/api/podcasts`; chapter generation currently uses `observeEntitledGeneration`, which is telemetry-only. Recap must use the real reservation/consume/release lifecycle.
- Existing strict JSON LLM path is available through `callJsonLLM()`/`callLLM()` and existing companion features provide parser/source-validation patterns.
- Existing UI surfaces are `src/pages/Insights.tsx`, `src/pages/Podcasts.tsx`, and `src/components/PodcastPanel.tsx`. The recap should appear in Insights as a calm card with an audio player and status, while ordinary chapter podcast UI remains unchanged.
- `src/db.ts` startup validation currently lists core feature relations and must include the new recap relation. `update.sh` schema validation also needs the relation if its check is hard-coded.

---

## Implementation tasks

### Task 1: Add schema, migration, and verifiers

**Files:**
- Modify: `src/db/schema.sql`
- Create: `migrations/20260801_add_podcast_recaps.sql`
- Modify: `src/db.ts`
- Modify: `update.sh` if its schema check is explicit
- Create: `scripts/verify-podcast-recap-schema.ts`
- Create: `scripts/verify-podcast-recap.ts`

Add an idempotent `chapter.podcast_recaps` table with:

- `id UUID PRIMARY KEY`
- `owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE`
- `request_key TEXT NOT NULL`
- `schema_version SMALLINT NOT NULL`
- `status` constrained to `queued`, `scripting`, `synthesizing`, `archiving`, `archive_pending`, `ready`, `failed`
- `output_language` constrained to `vi`/`en`
- `voice_model TEXT NOT NULL`
- bounded JSONB `payload` containing title/opening/summary/next-direction/source refs
- `source_book_count`, `source_session_count` with non-negative checks
- `script_text`, `word_count`, `duration_s`
- the same private audio/archive fields needed for playback (`tg_file_id`, `tg_file_unique_id`, `tg_chat_id`, `tg_message_id`, `local_cache_path`, `local_cache_until`, `error_message`)
- timestamps and a unique owner-level current artifact constraint, e.g. `UNIQUE(owner_id)`

Add fixtures for: schema tokens, two-owner source isolation, insufficient-source no-charge behavior, citation rejection, request-key idempotency, and valid bounded output parsing.

### Task 2: Implement owner-scoped retrieval, prompt, parser, and generation lifecycle

**Files:**
- Create: `src/podcastRecap.ts`
- Create or modify: `src/podcast/recap.ts`
- Reuse without changing semantics: `src/podcast/tts.ts`, `src/podcast/telegram.ts`, existing archive/cache helpers where appropriate

Implement:

1. `getPodcastRecapSource(ownerId)` joining every source branch through `books.owner_id=$1`.
2. Deterministic recent-source selection with bounded rows and no raw-text fields.
3. `hasRecapSource()` requiring enough saved evidence for a useful recap, preferably at least one recent session and one next-reading signal; no AI/quota use when false.
4. `resolveRecapLanguage()` from concrete saved evidence; never persist `auto`.
5. `buildPodcastRecapPrompt()` with strict output schema and explicit “do not invent / do not reveal future chapters / do not include raw source text or unsupported citations” rules.
6. `parsePodcastRecap()` with field bounds, allowed source-reference validation, cross-source/owner validation, and safe fallback rejection.
7. Request-key lookup before provider work; same key returns `existing` and never reserves or calls LLM again.
8. Reserve usage only after source eligibility and entitlement have been validated; persist durable structured recap; consume only after persistence; release on LLM/parser/TTS/archive failure.
9. Keep prior ready/audio artifact available during refresh. If archive fails after audio succeeds, retain `archive_pending` with private local playback and retryable state.
10. Use the existing persisted `users.podcast_voice_gender`; if no voice has been selected, return a clear `voice_required` state without consuming quota.

Do not mutate `reading_log`, `books`, achievements, goals, or chapter podcast rows.

### Task 3: Add authenticated API and typed client

**Files:**
- Create: `src/routes/podcast-recap.ts`
- Modify: `server.ts`
- Modify: `src/api.ts`

Add authenticated endpoints:

- `GET /api/podcast-recap/current` — returns the owner-scoped artifact/status, `available`, source counts, and usage state; public payload excludes raw text and Telegram IDs.
- `POST /api/podcast-recap/generate` — accepts only a bounded `requestKey`; server derives all authorization/source/voice/language fields.
- `GET /api/podcast-recap/audio` or an owner-scoped `/api/podcast-recap/:id/audio` — serves only the authenticated owner’s valid local/archive audio with private cache headers and range support if practical.

Map entitlement and quota errors to 403/429, insufficient source to 200 `no_source`, and provider failure to a safe 502. Add typed `PodcastRecapArtifact`/response/client methods.

### Task 4: Add Insights UI

**Files:**
- Create: `src/components/PodcastRecapCard.tsx`
- Modify: `src/pages/Insights.tsx`

Add a calm reading-first card with:

- server-authoritative unavailable/upgrade state
- no-source state
- queued/generating state without global loader
- ready state with title, short grounded description, source/book count, audio controls, and bounded transcript/details if product contract permits
- refresh/regenerate action using a unique request key
- failed/archive-pending state retaining the previous valid artifact/audio
- responsive 320/375/430px and desktop layout, no horizontal overflow, accessible tap targets and contrast

Do not alter the existing Podcasts chapter library or Book Detail action-row behavior.

### Task 5: Validate locally

Run on DEV repo:

```bash
npx tsc --noEmit
npx tsx scripts/verify-podcast-recap-schema.ts
npx tsx scripts/verify-podcast-recap.ts
npm run lint
npm run build
git diff --check
```

Also inspect changed source to confirm no recap prompt/API path references `raw_text`, `book_reading_units`, `ai_reader_chunks`, `tg_file_id`, or client-supplied owner/tier authorization. Test that existing chapter podcast routes still typecheck and build.

### Task 6: Deploy and run real authenticated E2E

Before code relies on the new table, provide the exact migration SQL handoff and run it on DEV. Then:

1. Push only verified Phase 3D product files to `dev`; do not include unrelated `.hermes` plans or workspace artifacts.
2. Run `chmod +x update.sh && ./update.sh`; verify PM2 online, schema relation present, and `/health` HTTP 200.
3. Through `https://chapter-dev.mrl.asia` with `DEV_TEST_PASSWORD` loaded only from remote `.env.local`, verify Free returns unavailable/403 and does not create usage.
4. Create a temporary Deep Reader grant and minimal owner-owned reading fixtures with at least two recent evidence records/books if the account lacks sufficient source. Do not print credentials or raw source text.
5. Verify generate, persistence/reload, valid citations, concrete voice/language, audio/status behavior, same-request idempotency, quota count, and owner isolation.
6. Verify insufficient-source returns no-source without provider/quota activity.
7. Delete temporary recap, usage events, fixtures, and grant; verify cleanup counts are zero.
8. Run authenticated browser checks on Insights at desktop and narrow mobile widths, inspect console/root rendering, visible card states, audio control overflow, and tap targets. If authenticated browser login cannot be completed safely, report API/runtime proof separately and do not claim browser E2E.

### Task 7: Commit, push, and report

Create focused commits only after all verification passes. Push to `dev`, deploy, and report:

- commit SHA(s)
- exact migration path/SQL handoff
- validation commands and real outputs
- authenticated E2E gate/idempotency/quota/owner-isolation results
- browser result and any limitation
- cleanup counts and final health status

---

## Acceptance checklist

- [ ] Free/Plus cannot generate; Deep Reader can generate within quota.
- [ ] No source means no LLM call and no quota charge.
- [ ] Every source branch is owner-scoped through `books.owner_id`.
- [ ] Prompt/API never contains or returns raw text, EPUB text, full AI Reader chunk JSON, or Telegram identifiers.
- [ ] Output citations are validated against the selected owner source set.
- [ ] Same request key returns existing output without duplicate provider/quota work.
- [ ] Reservation/consume/release lifecycle is complete on success and every failure path.
- [ ] Existing valid recap/audio survives refresh failure and downgrade.
- [ ] Narrator gender remains immutable and language resolves to concrete `vi`/`en`.
- [ ] Reading progress, achievements, goals, and ordinary chapter podcast behavior are unchanged.
- [ ] Typecheck, fixtures, lint, build, diff check, authenticated E2E, browser checks, deployment health, and cleanup all pass.

## Risks and guardrails

- Existing chapter podcast generation reads raw EPUB text by design; keep recap code in a separate module and never call chapter-text helpers for recap retrieval.
- Reusing the `chapter.podcasts` table would mix chapter-level uniqueness with owner-level recap idempotency; use a dedicated table.
- Archive/Telegram outages must not delete a locally playable generated recap; preserve `archive_pending` and retry.
- Do not add a second narrator preference; read the existing immutable user preference.
- Do not stage unrelated pre-existing `.hermes/plans/` files or `package-lock.json` changes produced by deployment npm install.
- Quota policy currently defines Deep Reader `podcast_recap_generation: 4`; keep the central entitlement value and do not duplicate it in routes/UI.

## Exact migration handoff

At implementation time, hand off the generated file:

```text
migrations/20260801_add_podcast_recaps.sql
```

The migration must be additive and idempotent. Verify with:

```sql
SELECT to_regclass('chapter.podcast_recaps');
```

before deploying code that serves the new API.

---

**Plan status:** Audit complete. Awaiting Huy approval before Kanban execution and source changes.

eof
```
  (The literal `eof` marker above is explanatory only; the actual plan file must not include shell wrapper text.)

---

## Recommended implementation order

Schema/verifiers → source/parser/lifecycle → API/client → Insights card → local validation → DEV migration/deploy → authenticated E2E/browser → cleanup → commit/push/report.

This order keeps the new route unavailable until its schema and owner/quota boundaries are verified.