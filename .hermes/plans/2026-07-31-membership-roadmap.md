# Chapter Membership Roadmap

> **For Hermes:** Execute only an approved phase at a time. Keep reading habit and reading achievements separate from paid membership.

**Goal:** Add a calm, Vietnam-first membership model that charges for deeper AI companionship—not for basic reading or reader status.

**Product contract:**
- **Reading Level / achievements** remain earned from reading behavior and are never purchasable.
- **Membership** adds AI capacity, podcast capacity, exports, storage/backup and premium synthesis.
- Downgrade or billing failure never deletes user books, logs, notes, raw text, analyses, podcast history, or exports. It blocks new premium generation while preserving permitted read-only views.
- Every server-side feature check goes through one entitlement service; frontend conditions are display hints only.

**Approved commercial model:**
- Tiers: `free`, `plus`, `deep_reader`.
- Suggested launch pricing: Plus `59,000 VND/month` or `599,000 VND/year`; Deep Reader `149,000 VND/month` or `1,390,000 VND/year`.
- Trial: 7-day Deep Reader only after the account has at least 2–3 completed reading sessions.
- Initial market: Vietnam; payment provider selected in Phase 4 (MB VietQR Paygate is the current preferred candidate).

**Shared architecture:** React + TypeScript, Express, PostgreSQL `chapter` schema, existing owner-scoped books/logs, NineRouter AI dispatcher, podcast subsystem.

---

## Delivery sequence

1. **Phase 0 — Entitlement & quota foundation**
   - Durable subscription state, monthly usage ledger, pure entitlement policy, admin grants and API enforcement.
   - No public checkout and no payment provider credentials.
2. **Phase 1 — Tiers, pricing and usage UX**
   - Pricing page, current-plan screen, contextual usage meters and controlled server/frontend feature gating.
3. **Phase 2 — Contextual upgrade moments**
   - Calm previews and upgrade prompts after real value appears; never urgent/countdown/gamified copy.
4. **Phase 3 — Premium capability delivery**
   - Monthly Review, Ask My Reading, Cross-book Connections and personalized next-reading podcast recap in dependency-safe slices.
5. **Phase 4 — Payment & founding launch**
   - Checkout, provider webhook reconciliation, billing management/history, grace behavior, annual founding offer, launch gates.

## Non-negotiable technical rules

- The authenticated server derives tier from persisted subscription state; clients never submit a tier or remaining quota to authorize work.
- Usage consumption is atomic and idempotent, attributed to a concrete feature and resource/action key; failed work must release/refund a reservation according to the documented policy.
- A request that creates a durable primary reading log remains usable when a gated background enrichment is declined or quota-exhausted.
- Preserve existing owner/read-only access policy for books and derived data. Entitlements add generation capacity; they must not accidentally widen cross-user data access.
- All SQL is idempotent in `src/db/schema.sql`; every deployment receives an exact migration handoff before code relies on new tables.
- Do not stage `.hermes/` plans or `workspace/` runtime artifacts in product commits.

## Repository touchpoints expected across phases

- `src/db/schema.sql` — subscription, entitlement, monthly usage and payment tables.
- `src/entitlements.ts` (new) — tier matrix, active-status normalization, feature checks and quota definitions.
- `src/routes/entitlements.ts` (new) — authenticated self-service entitlement/usage read API.
- `server.ts` — mount entitlement, billing and premium-feature routes.
- `src/api.ts`, `src/types.ts`, `src/AuthContext.tsx` — typed client entitlement state.
- `src/components/`, `src/pages/` — pricing, plan status, meters, previews and upgrade dialogs.
- Existing generation paths: `src/routes/books.ts`, `src/aiReader.ts`, `src/podcast.ts`, Reading Lens / Story routes and LLM dispatcher.

## Global acceptance gates for every phase

- Unit/fixture coverage for entitlement status and quota boundary behavior.
- `npm run lint`, focused verifier scripts, `npm run build`, `git diff --check`.
- Actual authenticated browser checks: Library → real BookDetail → relevant premium/usage state at 320/375/430px and desktop; inspect console, root rendering, overflow, contrast and tap targets.
- Server API checks prove non-owner protections remain intact and a crafted client cannot bypass quota/tier checks.
- Commit/push one verified phase to `dev` only; do not include plans/workspace in commits.

## Phase plans

- `2026-07-31-membership-phase-0-entitlements.md`
- `2026-07-31-membership-phase-1-pricing-usage.md`
- `2026-07-31-membership-phase-2-upgrade-moments.md`
- `2026-07-31-membership-phase-3-premium-features.md`
- `2026-07-31-membership-phase-4-payment-launch.md`

## Deferred decisions

- Exact quota counts are deliberately configuration/policy values and must be approved before Phase 1 launches; Phase 0 will make them versioned and centrally editable, without inventing limits.
- Provider-specific webhook schema, signatures, payment expiry/refund behavior and credentials wait for MB’s approved Paygate documentation in Phase 4.
- International currency/tax/invoice support is outside Vietnam-first launch scope.
