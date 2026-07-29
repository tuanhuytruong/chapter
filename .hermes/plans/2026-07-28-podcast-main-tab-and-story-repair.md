# Chapter — Podcast Main Tab & Story Thread Repair

## Reported symptoms

1. Account `dev` receives `503 {"error":"story thread unavailable","detail":"column \"story\" does not exist"}`.
2. The current Podcast UI offers one `Create episode` control per reading session. This is both misleading and functionally blocked for older EPUBs whose stored reading units do not yet have `chapter_key`.
3. Podcast should be independent of the read-session timeline: users browse actual EPUB chapters and create one episode per chapter.

## Proposed approach

### 1. Diagnose and repair Story Thread schema drift

- Reproduce the deployed endpoint with the `dev` session and inspect the exact failing SQL in production logs/database, rather than guessing from the UI error.
- Compare the deployed `chapter.story_thread_analyses` / `chapter.story_state_snapshots` definitions against `src/db/schema.sql` and the idempotent Story Thread migration.
- Add a safe, idempotent repair migration only for the proven schema mismatch, then make the affected endpoint return a truthful local unavailable state rather than exposing raw database detail.
- Add a regression fixture covering the legacy schema shape that triggered the issue.

### 2. Make Podcast chapter-first, not session-first

- Replace the `log_id`-driven create contract with a chapter selection contract: `{ book_id, chapter_key }`.
- Add an owner-protected endpoint that returns the complete ordered EPUB chapter catalog from `book_reading_units`, grouped by stable `chapter_key` (spine identity), with title, range, and existing episode status.
- Keep the episode `log_id` nullable/optional as provenance only; do not use it for dedupe, creation, or UI labels.
- On first access for legacy EPUB rows without `chapter_key`, safely rebuild the book’s reading-unit index from its local EPUB file (or return a precise actionable indexing error if source file is unavailable). Never fall back to globally matching titles.
- Preserve existing episode dedupe: `book_id + chapter_key + reading_round`.

### 3. Move Podcast to a top-level product tab

- Add `/podcasts` as a first-class main navigation item for desktop and mobile.
- Add a `Podcasts` page that lists the owner’s EPUB books and their chapter catalog/episode state; a book can be expanded to choose a chapter and create/play an episode.
- Move the current player, polling, transcript, voice setup, and error UI into reusable chapter-based components.
- Remove Podcast from Book Detail’s List / Journey / AI Reader view strip so it no longer appears coupled to reading sessions.
- Keep audio endpoints owner/session protected and Telegram/cache metadata server-only.

### 4. Verification

- Add deterministic route tests for chapter catalog grouping, legacy re-index behavior, chapter-based creation, immutable voice selection, dedupe, metadata privacy, and Range playback.
- Run Story Thread regression fixture, Podcast verifier, phase-1 verifier, lint, build, and whitespace checks.
- Browser-smoke production/local flow: login → Podcast main tab → choose an EPUB → create chapter episode → observe queued state/voice selection; and open the affected Story Thread book to confirm no 503/raw DB leak.
- Rebase if `dev` advanced, commit only scoped files, and push validated work to `dev`.

## SQL deployment handoff

The exact Story Thread repair SQL will be provided only after querying the actual deployed table definition and identifying the source of the `story` reference. This avoids applying speculative schema changes.

## Acceptance criteria

- Story Thread no longer returns the reported `column "story" does not exist` error.
- Podcast has a dedicated main tab and one create/play action per actual EPUB chapter, never per reading session.
- Existing/legacy EPUBs are supported through stable spine-key indexing or receive a specific remediation message.
- Creation immediately returns persisted `queued` state, then transitions asynchronously to ready/failed with a visible reason.
- Telegram remains invisible to users; all listening stays in the web player.
- All stated verification gates pass before commit/push.
