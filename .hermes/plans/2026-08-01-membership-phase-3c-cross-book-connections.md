# Chapter Phase 3C — Cross-book Connections Implementation Plan

> **For Hermes:** Execute only after Huy approves this plan. Use Plan → Kanban → Execute → Verify → Report. Keep scope limited to Cross-book Connections; do not begin recap podcast, payment, or unrelated membership UX.

**Goal:** Add an owner-scoped, source-grounded Cross-book Connections artifact that identifies meaningful recurring ideas across the reader’s own books, with server-side entitlement/quota enforcement and safe read-only access after downgrade.

**Architecture:** Build a versioned per-owner artifact for the current reading corpus, backed by PostgreSQL and generated through the existing strict JSON LLM dispatcher. Source retrieval is deterministic and owner-scoped across persisted summaries, insights, notes, quotes, Reading Lens, AI Reader chunks, and Book Wiki data; model output is accepted only after source-reference validation. Generation uses the existing atomic reservation/consume/release lifecycle for `cross_book_connections` and is exposed through authenticated API routes plus an Insights card.

**Tech Stack:** React + TypeScript, Express, PostgreSQL `chapter` schema, existing `callLLM()`/JSON mode, `usage.ts`, `entitlements.ts`, Tailwind UI.

---

## Product and safety contract

- Connections are premium AI companionship; reading, progress, notes, quotes, review cards, and achievements remain free.
- The server derives owner, entitlement, quota, source IDs, and language. Ignore client `ownerId`, `tier`, `periodKey`, usage, and source IDs for authorization.
- Only records owned by the authenticated user may enter retrieval or prompts. Every source branch must join through `books.owner_id = $1` or an equivalent explicit owner predicate.
- Do not pass full `raw_text` by default and never return it in the connection artifact/API.
- Each generated artifact contains bounded connection groups with source references pointing only to server-supplied source IDs. No fabricated books, quotes, dates, or citations.
- Empty/insufficient corpus returns a clear no-source state without LLM invocation or quota charge.
- Provider, parser, or persistence failure releases the reservation and preserves the previous artifact.
- Duplicate request keys are idempotent per owner; retries do not double-charge.
- Downgrade blocks new generation but preserves the last successful artifact as read-only.
- Generation is explicit from Insights; ordinary reading completion remains independent and usable.

## Proposed response shape

```ts
interface CrossBookConnections {
  id: string;
  schemaVersion: number;
  outputLanguage: "vi" | "en";
  corpusLabel: string;
  opening: string;
  connections: Array<{
    title: string;
    synthesis: string;
    books: Array<{ bookId: string; title: string; contribution: string }>;
    evidence: string[];
    sourceRefs: Array<{
      sourceId: string;
      bookId: string;
      bookTitle: string;
      sourceType: string;
      occurredAt: string;
    }>;
  }>;
  carryForward: string[];
  sourceBookCount: number;
  sourceSessionCount: number;
  generatedAt: string;
}
```

Persist the normalized payload in a single per-owner artifact row. The server supplies `sourceBookCount`, `sourceSessionCount`, and validated source references; never trust model-generated counts or IDs.

---

## Sequential implementation tasks

### Task 1: Inventory current schemas and generation conventions

**Inspect:** `src/db/schema.sql`, `src/monthlyReview.ts`, `src/askMyReading.ts`, `src/usage.ts`, `src/entitlements.ts`, `src/routes/entitlements.ts`, `src/api.ts`, `src/pages/Insights.tsx`, `src/ReadingLens*`, `src/aiReader.ts`, `server.ts`, and existing migrations/verifiers.

Confirm exact columns and optional-table availability for `books`, `reading_log`, Reading Lens, AI Reader, and Book Wiki. Confirm whether the repository prefers one current artifact per owner or versioned history. Document source IDs and deterministic Bangkok timestamps before coding.

**Acceptance:** no guessed table/column names; retrieval design has explicit owner predicates, bounded ordering, and a maximum prompt budget.

### Task 2: Add idempotent artifact schema and migration

**Modify:** `src/db/schema.sql`.
**Create:** `migrations/<date>_add_cross_book_connections.sql`.
**Create/modify:** `scripts/verify-cross-book-connections-schema.ts`.

Create `chapter.cross_book_connections` with:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE`
- `schema_version SMALLINT NOT NULL`
- `output_language TEXT NOT NULL CHECK (output_language IN ('vi','en'))`
- `payload JSONB NOT NULL`
- `source_book_count INT NOT NULL CHECK (source_book_count >= 0)`
- `source_session_count INT NOT NULL CHECK (source_session_count >= 0)`
- `generated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `UNIQUE (owner_id)`

Add an owner index if required by the read path. Migration must be additive, rerunnable, and safe against an already-created relation. Add the relation to DB bootstrap/required-relation checks.

### Task 3: Implement pure source retrieval, prompt, and parser contracts

**Create:** `src/crossBookConnections.ts`.
**Create/modify:** `scripts/verify-cross-book-connections.ts`.

Export:

- `CROSS_BOOK_CONNECTIONS_SCHEMA_VERSION`
- `getCrossBookSource(ownerId)`
- `hasConnectionSource(source)`
- `resolveOutputLanguage(questionOrSources)` or equivalent deterministic language helper
- `buildCrossBookConnectionsPrompt(input)`
- `parseCrossBookConnections(raw, expectedLanguage, allowedSources)`

Retrieval must:

- collect only persisted owner-owned source material;
- include stable source IDs, book IDs/titles, source type, date/session context;
- prefer summaries/insights/notes/quotes/Lens/Wiki/chunks over raw text;
- use deterministic relevance/grouping and bounded fallback sources;
- require at least two distinct books before generation;
- cap books, sessions, source items, characters, output groups, evidence strings, and source references.

Prompt must require strict JSON, direct warm prose, cross-book synthesis rather than unrelated book summaries, explicit uncertainty when evidence is weak, exact `vi`/`en`, and source IDs only from the supplied source manifest.

Parser must reject malformed JSON, missing/empty required fields, unknown source IDs, duplicate or over-limit refs, fabricated book IDs, wrong language, and unsupported claims. Server-derived counts and IDs must override model output.

### Task 4: Add repository/service and quota lifecycle

**Create/modify:** `src/crossBookConnectionsRepository.ts` or keep service/repository functions in `src/crossBookConnections.ts` according to existing conventions.

Implement:

- `getCrossBookConnections(ownerId)`
- `getCrossBookConnectionSource(ownerId)`
- `generateCrossBookConnections(ownerId, requestKey)`

Flow:

1. Load owner-scoped source and require at least two books.
2. Return `no_source` without reservation when insufficient.
3. Return an existing artifact for a safe idempotent read/retry path where applicable.
4. Reserve `cross_book_connections` with bounded owner-scoped request key.
5. Call strict JSON LLM and parse against the server manifest.
6. Upsert the owner artifact only after complete validation.
7. Consume exactly once after persistence.
8. Release reservation on every failure path and leave the prior artifact untouched.

Keep concurrent generation safe using the existing usage uniqueness and an owner-level artifact write invariant.

### Task 5: Add authenticated API and typed client methods

**Create:** `src/routes/cross-book-connections.ts`.
**Modify:** `server.ts`, `src/api.ts`, and relevant shared types.

Add:

- `GET /api/cross-book-connections/current` — returns the current owner artifact, source availability, book/session counts, feature availability, and safe usage facts.
- `POST /api/cross-book-connections/generate` — derives owner and current source server-side; accepts only a bounded request key if needed.

Use `requireAuth` and `userFrom(req)`. Return safe statuses for unavailable feature, quota reached, no source, and provider/parser failure. Do not leak SQL/provider errors or raw source data.

Add route/verifier coverage for unauthenticated rejection, crafted owner/tier/period ignored, non-owner isolation, free-user denial, successful usage consumption, failed generation release, insufficient-source no-charge, and duplicate request idempotency.

### Task 6: Add Insights UI card

**Create:** `src/components/CrossBookConnectionsCard.tsx`.
**Modify:** `src/pages/Insights.tsx` and any typed API state helpers.

UI requirements:

- Calm card near the existing Monthly Review / Ask My Reading cards.
- Display generated timestamp, source book/session counts, opening, connection groups, evidence, and source book/date references.
- Show `Generate connections` only when the API reports feature availability and at least two source books.
- Show an honest no-source state without an upgrade CTA when fewer than two books are available.
- Show a quiet membership/usage message when unavailable due to entitlement/quota.
- Keep the previous artifact visible during regeneration; no global Insights loader.
- Use server response as entitlement truth; do not infer access from local tier state.
- Verify 320/375/430px and desktop: no horizontal overflow, readable evidence, accessible buttons, stable layout, and no console errors.

### Task 7: Run deterministic gates and focused runtime checks

Run locally:

```bash
npm run lint
npm run verify:entitlements
npm run verify:upgrade-prompts
npx tsx scripts/verify-cross-book-connections.ts
npm run build
git diff --check
```

On DEV, present and apply only the exact additive migration SQL, then verify:

```sql
SELECT to_regclass('chapter.cross_book_connections');
```

Authenticated DEV checks with temporary Deep Reader grant:

1. Login with `dev` using `DEV_TEST_PASSWORD` from `/opt/chapter-dev/.env.local` without printing it.
2. Confirm Free/expired entitlement denies generation.
3. Grant temporary `deep_reader` and confirm availability.
4. Generate using real data from at least two owned books.
5. Verify non-empty connections and source refs map to the owner’s books.
6. Refresh/reload and confirm persistence.
7. Repeat request key and verify no extra usage event.
8. Force/fixture a failed generation and verify reservation release plus prior artifact preservation.
9. Verify a no-source scenario does not charge quota.
10. Browser-check Insights at desktop and 320/375/430px, including console/root rendering and document overflow.
11. Delete test artifact/usage and temporary subscription grant; assert cleanup counts are zero.

### Task 8: Review, commit, push, and report

Before commit, inspect `git status`, `git diff`, and `git diff --check`. Stage only product source, migration, verifier, and required package files. Exclude `.hermes/`, workspace/runtime artifacts, `.env*`, and unrelated lockfile changes.

Commit message:

```text
feat: add cross-book connections
```

Push the verified commit to `dev`, fetch/compare the remote branch, and report the commit, migration handoff, validation output, authenticated E2E evidence, and any known limitations.

---

## Risks and decisions

- Do not invent cross-book links from title similarity alone; require at least two source-backed contributions and preserve evidence refs.
- Optional Reading Lens/AI Reader/Book Wiki data may be absent or schema-specific; core persisted reading data must remain a functional fallback.
- A per-owner current artifact is sufficient for v1; do not add history/version browsing unless product asks for it.
- The current entitlement policy gives `cross_book_connections` only to `deep_reader`; do not widen Plus/free access without explicit approval.
- Keep source retrieval and prompt size bounded; do not pass full `raw_text` or entire JSON blobs.
- Payment, checkout, webhook, recap podcast, and pricing changes are explicitly out of scope.

## Definition of done

- Schema and migration are additive/idempotent and verified on DEV.
- Retrieval, parser, API, quota lifecycle, and owner isolation have deterministic checks.
- Insights card is browser-verified at mobile and desktop sizes with no overflow/console errors.
- Real authenticated generation, persistence, idempotency, denial, failure release, and cleanup are verified.
- Only scoped product files are committed and pushed to `dev`.

---

## Approval gate

After Huy approves this plan, create the Kanban checklist and execute task-by-task. Do not implement source files or apply the migration before approval.

---

## Suggested follow-up decisions during implementation

1. Whether to expose one current artifact per owner (recommended for v1) or preserve generated history.
2. Whether `source_refs` should be nested under each connection only (recommended) or duplicated in a top-level manifest.
3. Whether no-source means fewer than two distinct books (recommended) or at least two persisted source items regardless of book count.
4. Whether the first UI should show all groups or only the top three with an expand control (recommended: top three initially, all persisted data available on expand).

These are implementation details; the existing product contract and entitlement policy remain authoritative.

---

## Exact DEV migration handoff (to be prepared after source/schema confirmation)

The final SQL must be generated from the committed migration file and presented before execution. It must be rerunnable with `CREATE TABLE IF NOT EXISTS`, required checks/indexes, and the owner uniqueness invariant. Do not rely on an ad hoc SQL statement that diverges from `src/db/schema.sql`.

## Existing artifacts to reuse

- `src/entitlements.ts` — authoritative tier/quota matrix.
- `src/usage.ts` — reservation/consume/release lifecycle.
- `src/llm.ts` — shared NineRouter dispatcher and strict JSON mode.
- `src/pages/Insights.tsx` — existing Insights surface.
- `src/monthlyReview.ts` and `src/askMyReading.ts` — proven structured-artifact and source-grounding patterns.
- `src/db.ts` — required relation/bootstrap verification.
- `scripts/verify-*` — repository verifier convention.

## Out of scope

- Cross-user/public connections.
- Raw-text export.
- Payment provider integration or checkout.
- Podcast recap.
- Changes to free reading/progress/achievement rules.
- Telegram/Hermes notifications.
- Historical artifact browser.
- Automatic generation during ordinary reading.