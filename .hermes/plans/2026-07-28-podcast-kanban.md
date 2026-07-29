# Chapter Podcast — Delivery Kanban

**Approved:** 2026-07-28
**Branch:** `dev`
**Scope:** EPUB-only chapter podcast generation, private Telegram archive, web-only playback.

## Phase board

| ID | Task | Status | Verification criterion |
|---|---|---|---|
| P0 | Inspect integration points and create delivery contract | done | Existing schema, extractor, auth, routes, config, UI patterns mapped |
| P1 | Add schema, migration, and EPUB chapter identity | done | Idempotent migration + extraction/persistence verifier pass |
| P2 | Add narration, TTS, archive, range-stream, and async runner | done | Podcast privacy/range verifier pass |
| P3 | Add Podcast API client and Book Detail tab | done | Typecheck/build and state fixtures pass |
| P4 | Full QA, review, commit, and push `dev` | in_progress | Tests/build/diff pass; browser check if local auth/data available |
| K1 | Keep existing PDFs, AI Reader, Lens, Story, Telegram delivery unchanged | pending | Diff and source review show no unwanted behavior changes |

## Per-task checklist

### P0 — Discovery
- [ ] Read repository instructions and OpenWiki quickstart
- [ ] Inspect migrations/schema/users/reading units and extractor persistence
- [ ] Inspect server auth/mount order, existing route patterns, and Telegram helper
- [ ] Inspect Book Detail tabs and types/API patterns

### P1 — Storage and EPUB identity
- [ ] Add standalone idempotent production migration
- [ ] Add schema bootstrap definitions
- [ ] Persist `spine_index` and `chapter_key` for EPUB units
- [ ] Prevent unit chunks from crossing an EPUB spine boundary
- [ ] Add `podcast_voice_gender` lock and `podcasts` state table
- [ ] Update core schema validation
- [ ] Add deterministic schema/extraction verifier

### P2 — Backend pipeline
- [ ] Add prompt, generation, state transitions, and chapter selection
- [ ] Add 9router TTS client and safe audio chunking/merge strategy
- [ ] Add Telegram private archive upload/retrieval
- [ ] Add owner-checked audio range proxy
- [ ] Add podcast routes and background job runner
- [ ] Add safe cache cleanup
- [ ] Add deterministic provider/route/privacy/range verifiers

### P3 — Podcast UI
- [ ] Add typed safe Podcast API client
- [ ] Add first-use immutable narrator choice
- [ ] Add Podcast tab states, native audio player, transcript, retry, spoiler confirmation
- [ ] Keep PDF UI unchanged and preserve Book Detail tab state

### P4 — Delivery
- [ ] Run tests/typecheck/build/diff review
- [ ] Run available local route/browser checks; document any auth/DB limitation honestly
- [ ] Provide idempotent production migration + verification SQL
- [ ] Commit verified work and push to `dev`

### Keep as-is
- [ ] PDF reading behavior
- [ ] AI Reader, Reading Lens, Story Thread behavior
- [ ] Existing Telegram daily-summary delivery
- [ ] Existing auth ownership model
