# Chapter Quality, Security & Cleanup Implementation Plan

> **For Hermes:** Use task-by-task execution with verification after every batch.

**Goal:** Remove only confirmed obsolete repository artifacts and fix verified Chapter authorization, billing, UX, and high-impact request-efficiency defects without changing the product’s shared-reading policy.

**Architecture:** Preserve public/read-only book sharing while separating safe companion metadata from private source material. Centralize safe `reading_log` projection for shared endpoints, enforce podcast ownership at the query layer, retain the user’s higher paid entitlement when a lower tier is purchased, and show billing history from the existing owner-scoped API. Performance work replaces per-book full-log fetching with bounded aggregate data and makes polling single-flight/visibility-aware.

**Tech stack:** Express + PostgreSQL, TypeScript, React, Vite, PM2 DEV deployment.

---

## Confirmed findings

1. **High – raw uploaded/extracted book text disclosure:** `src/routes/books.ts:412-423` returns `SELECT * FROM reading_log` for All Readers, including `raw_text`.
2. **High – private podcast audio IDOR:** `src/routes/podcasts.ts:90-107` selects by episode ID without requiring `p.user_id` to match the current authenticated user.
3. **Functional – paid-tier downgrade:** `src/billing/service.ts` overwrites an active `deep_reader` entitlement with `plus` when a lower SKU is confirmed.
4. **Functional – billing history invisible:** server/client already provide `/api/billing/me`, but `src/pages/Account.tsx` does not render it.
5. **Performance – N+1 full-log reads:** `src/pages/Library.tsx` and `src/pages/Insights.tsx` call `getLog(book.id)` for every book, retaining all logs for small aggregates.
6. **Performance – polling overlaps/background load:** enrichment polling uses `setInterval(async ...)`, including on hidden tabs.

## Explicit non-goals

- Do not expose any public HTTP payment-confirm endpoint.
- Do not activate MB billing on DEV/PRD or read/print receiver secrets.
- Do not change which book-level companion summaries are intentionally shared; only prevent raw text/private audio disclosure.
- Do not add speculative database indexes without DEV `EXPLAIN (ANALYZE, BUFFERS)` evidence.
- Do not delete committed membership or podcast delivery history plans.

---

### Task 1: Remove only confirmed scratch artifacts

**Objective:** Keep useful plans/roadmap and remove the four OpenWiki files with no operational or historical value.

**Files:**
- Delete: `openwiki/a.txt`
- Delete: `openwiki/b.txt`
- Delete: `openwiki/c.txt`
- Delete: `openwiki/todo.md`

**Steps:**
1. Reconfirm each file is only referenced by the four-file scratch set.
2. Delete all four together; retain `openwiki/index.md`, architecture/operations docs, and `.hermes/plans/**` delivery history.
3. Run `git diff --check` and `git status --short`.

**Acceptance:** No live code/documentation references a removed artifact; all roadmap and Phase 0/3C/3D/4 plans remain.

### Task 2: Stop shared raw-text disclosure

**Objective:** Preserve shared reading timeline UI while never returning `reading_log.raw_text` (or private operational columns) to a non-owner.

**Files:**
- Modify: `src/routes/books.ts` (`GET /:id/log`)
- Modify/create: focused API/service fixture under `scripts/verify-*` following existing verifier patterns.

**Steps:**
1. Define an explicit shared reading-log column list used by the endpoint; exclude `raw_text`, local paths, and internal job/error fields.
2. Return owner-safe/full fields only where necessary; for shared readers return the whitelist projection. Keep ordering/date/session contract stable for existing clients.
3. Add a fixture/assertion that response SQL does not use `SELECT *` and does not include `raw_text`.
4. Authenticate two isolated test users against DEV: owner can load their history; non-owner sees normal timeline fields but no raw text key/value.

**Acceptance:** A known book ID from the All Readers API cannot expose raw source text in `/api/books/:id/log` to another user.

### Task 3: Enforce podcast audio ownership

**Objective:** Ensure an authenticated account can stream only its own podcast episode audio.

**Files:**
- Modify: `src/routes/podcasts.ts` (`GET /:id/audio`)
- Modify/create: podcast route verifier/fixture.

**Steps:**
1. Bind the audio episode query to both `p.id` and `p.user_id = userFrom(req).id`.
2. Preserve existing ready/archive/range response behavior for the owner.
3. Add two-user fixture: owner receives eligible audio response; another session receives `404` and no audio bytes.
4. Re-run current podcast verifier.

**Acceptance:** UUID knowledge alone is insufficient to retrieve another reader’s audio.

### Task 4: Make paid tier extension monotonic

**Objective:** Prevent a lower paid SKU confirmation from reducing an active higher entitlement.

**Files:**
- Modify: `src/billing/service.ts`
- Modify: service fixture in the same file or dedicated billing verifier.

**Steps:**
1. Make tier precedence explicit (`deep_reader > plus > free`) in the server-only catalog/service layer.
2. In the confirmation transaction, preserve the higher active paid tier while extending from the existing expiry; do not allow a lower purchase to overwrite it.
3. Define expected policy in code comments/fixture: `deep_reader` + `plus_monthly` keeps `deep_reader`; same/higher tier purchases extend/upgrade correctly.
4. Add transaction fixture for downgrade attempt, same-tier extension, and free-to-paid confirmation.

**Acceptance:** Confirming a valid lower SKU never removes access that the payer still owns.

### Task 5: Complete Account billing history UX

**Objective:** Let users reliably retrieve pending transfer reference, QR instructions when available, paid status, and history from Account.

**Files:**
- Modify: `src/pages/Account.tsx`
- Modify/create: `src/components/BillingHistoryCard.tsx`
- Use existing: `src/api.ts` billing contracts/client methods.

**Steps:**
1. Load `api.getBillingMe()` separately from Telegram/entitlement so a billing read failure cannot blank Account.
2. Render pending/paid/expired statuses, server-issued reference, amount/currency, expiry, and paid timestamp; show QR only when API returns it.
3. Make status language unambiguous: displaying a QR is payment instruction, not automatic upgrade; pending order must instruct users to transfer the exact amount/reference and await confirmation.
4. Add refresh/retry state; avoid duplicate order creation from Account.
5. Browser-check Account authenticated at desktop/mobile, including no-history, disabled billing, and fixture pending/paid states.

**Acceptance:** Checkout copy “check Account later” is true, owner-only, and no account/bank secret is rendered beyond server-provided safe payment instructions.

### Task 6: Replace N+1 full reading-log loads with bounded aggregates

**Objective:** Avoid one full `reading_log` response per book on Library/Insights.

**Files:**
- Modify: relevant list/stats query in `src/routes/books.ts` and/or `src/routes/stats.ts` after inspecting current contracts.
- Modify: `src/api.ts` types.
- Modify: `src/pages/Library.tsx`
- Modify: `src/pages/Insights.tsx`

**Steps:**
1. Document exactly which UI values currently require logs (streak/last-read/chart inputs).
2. Extend the existing list/stats query with parameterized, aggregate-only fields (e.g. `current_streak`, `last_read_at`) rather than fetching raw/full logs per book.
3. Update both pages to consume aggregate values and remove redundant `getLog` fan-out/state.
4. Use DEV browser network evidence to compare request count for a library with multiple books.
5. Run `EXPLAIN (ANALYZE, BUFFERS)` for changed SQL. Add a composite index only if the plan proves a missing index is a material cost and migration is justified.

**Acceptance:** Initial Library/Insights load has no per-book `/log` N+1 burst and preserves displayed counts/streak behavior.

### Task 7: Make pending-enrichment polling single-flight and visibility-aware

**Objective:** Stop overlapping polling requests and pause work in background tabs.

**Files:**
- Modify: `src/components/PodcastPanel.tsx`
- Modify: `src/pages/Podcasts.tsx`
- Modify: `src/components/BookWiki.tsx`
- Modify: `src/pages/BookDetail.tsx`
- Create (if beneficial): `src/hooks/usePolling.ts`

**Steps:**
1. Extract a small reusable polling hook with `inFlight` guard, recursive `setTimeout`, cleanup, and `document.visibilityState` pause/resume.
2. Preserve feature-specific intervals and stop conditions; do not poll after terminal ready/error state.
3. Ensure a closed/unmounted component cannot set state after response completion.
4. Unit/fixture-check timer cleanup and single-flight behavior; browser-check a pending fixture while switching visibility where browser tooling permits.

**Acceptance:** Each component has at most one pending poll request, and hidden tabs do not repeatedly call enrichment endpoints.

### Task 8: Hardening and final delivery gates

**Objective:** Address low-risk configuration/error hardening only after the confirmed defects above.

**Files:**
- Modify: `server.ts` (production `SESSION_SECRET` fail-fast)
- Modify: `src/config.ts` (finite, bounded billing expiry parsing)
- Modify selected route error boundaries to return stable public errors while server logs retain diagnostics.

**Steps:**
1. Fail startup in production if `SESSION_SECRET` is absent; retain a clearly isolated local-development fallback only if existing local workflow requires it.
2. Parse billing expiry with `Number.isFinite`, integer/range validation, and safe default.
3. Replace confirmed client-facing raw error messages in touched critical routes with generic stable errors; do not perform an unbounded repo-wide stylistic rewrite.
4. Run all existing focused verifiers, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check`.
5. Run DEV HTTPS two-user security E2E with tagged fixtures and cleanup. Validate billing fixture lifecycle/replay, health endpoint, and actual authenticated Library → Book Detail → Account browser flow.
6. Commit only validated cleanup/remediation source and required migration(s), push `dev`, deploy with `chmod +x update.sh && ./update.sh`, verify public health and exact DEV revision.

**Acceptance:** No temporary user/artifact/entitlement/payment data remains; DEV health is 200; build/verifiers/E2E are backed by actual output.

## Risks and decisions

- Shared-reading policy needs a safe-field whitelist, not blanket owner-only history, so existing All Readers timeline remains useful.
- Subscription downgrade behavior will preserve the higher tier; no refund/credit system is introduced.
- Query/index optimization is evidence-driven to avoid write overhead and migration bloat.
- Legacy podcast plans remain because they document implemented deliveries; only verified scratch OpenWiki files are removed.

## Expected commits

1. `chore: remove obsolete OpenWiki scratch artifacts`
2. `fix: protect shared reading text and podcast audio`
3. `fix: preserve higher billing tier and show order history`
4. `perf: reduce reading log fan-out and polling overlap`
5. Optional narrow hardening commit if validated independently.

## Validation commands

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run verify:entitlements
npm run verify:podcast
npm run verify:auth
RUN_BILLING_SERVICE_FIXTURE=1 npx tsx src/billing/service.ts
npx tsx scripts/verify-mb-vietqr-billing-schema.ts
git diff --check
```

Then run a cleanup-safe, HTTPS-authenticated DEV two-user E2E for the authorization/billing cases, followed by browser flow verification.
