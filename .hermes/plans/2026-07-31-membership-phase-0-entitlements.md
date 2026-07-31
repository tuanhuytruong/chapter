# Chapter Phase 0 — Entitlement & Quota Foundation

> **For Hermes:** Implement only after Huy explicitly approves this phase.

**Goal:** Establish secure, centrally enforced membership and monthly AI-usage foundations without exposing a pricing page or integrating payments.

**Architecture:** A single server-side entitlement service derives an effective plan from an owner’s subscription record, status and period. Premium generators ask this service to atomically reserve quota before work, then finalize or release that reservation. Admin/founding/trial grants use the same subscription state—not separate feature flags.

**Out of scope:** checkout, real payment provider calls/webhooks, public upgrade prompts, changing achievement logic, deleting/hiding existing user artifacts.

---

## Product policy to encode

### Tier and status vocabulary
- Tier: `free | plus | deep_reader`.
- Status: `active | trialing | canceled | past_due | expired`.
- Sources: `payment | trial | admin | founding`.
- `active` and unexpired `trialing` are entitled. `canceled` stays entitled only through `current_period_end`; `past_due` grace length is configured but activation policy must be explicit and surfaced later; `expired` falls to Free.
- Every user has an effective Free entitlement even with no subscription row.

### Feature categories
Define stable string keys rather than scattering tier comparisons:
- Existing/near-term: `ai_reader_generation`, `reading_lens_generation`, `podcast_chapter_generation`, `podcast_recap_generation`, `markdown_export`, `monthly_review_generation`, `ask_my_reading`, `cross_book_connections`, `priority_ai_queue`.
- Phase 0 marks keys as known policy surface; it does **not** enable unreleased endpoints.

### Quota semantics
- Maintain monthly quotas per owner + feature + `period_key` (`YYYY-MM` in Asia/Bangkok).
- A quota event is one `reserved | consumed | released | adjustment` record, carrying `request_key` to make retries/double-clicks idempotent.
- Reserve before billable generation; consume only after durable output succeeds; release when upstream failure, cancellation or parser failure means no user-facing artifact is saved.
- Do not retroactively charge existing data. Current unmetered artifacts remain viewable.

---

## Tasks

### Task P0-1: Inventory and classify existing AI/action paths

**Objective:** Identify every current route that can generate premium-cost work, including retries and background jobs.

**Files:**
- Inspect: `server.ts`, `src/routes/books.ts`, `src/podcast.ts`, `src/aiReader.ts`, `src/llm.ts`, Reading Lens/Story route modules.
- Create: `scripts/verify-entitlement-wiring.ts`.

**Steps:**
1. Document each route/job, owner authorization point, action key candidate and whether it is interactive/background.
2. Explicitly keep primary Read Today summary behavior separate from gated enrichments.
3. Add a static fixture verifier which asserts known generation entrypoints import/use the shared guard before Phase 1 begins.
4. Run `tsx scripts/verify-entitlement-wiring.ts`.

**Acceptance:** No existing cost-bearing generation path is forgotten; direct route, retry route and background launch paths are each classified.

### Task P0-2: Add idempotent subscription and usage schema

**Objective:** Persist provider-neutral plan state and auditable monthly quota events.

**Files:**
- Modify: `src/db/schema.sql`.
- Modify: `src/types.ts`.
- Create: `scripts/verify-entitlement-schema.ts` (fixture/SQL-shape verifier; real PostgreSQL handoff remains required).

**Schema design:**
```sql
CREATE TABLE IF NOT EXISTS chapter.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES chapter.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free','plus','deep_reader')) DEFAULT 'free',
  status TEXT NOT NULL CHECK (status IN ('active','trialing','canceled','past_due','expired')) DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  granted_by TEXT NOT NULL CHECK (granted_by IN ('payment','trial','admin','founding')) DEFAULT 'admin',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_unique
  ON chapter.subscriptions (provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS chapter.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('reserved','consumed','released','adjustment')),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  request_key TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key, period_key, event_type, request_key)
);
CREATE INDEX IF NOT EXISTS usage_events_owner_period_feature
  ON chapter.usage_events (user_id, period_key, feature_key);
```

**Rules:**
- Review existing table naming/search-path style before insertion.
- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` only when migrating a pre-existing table.
- Do not add a redundant `owner_id` to books/logs.

**Production migration handoff before deploy:**
```sql
BEGIN;
-- Copy exactly the idempotent subscriptions and usage_events migration block
-- from the deployed src/db/schema.sql.
COMMIT;

SELECT to_regclass('chapter.subscriptions'), to_regclass('chapter.usage_events');
```

**Acceptance:** Re-running the migration is safe; all user-owned subscription/usage records cascade correctly; provider identity cannot collide.

### Task P0-3: Build pure entitlement policy

**Objective:** Make plan, feature and quota rules testable in one dependency-free module.

**Files:**
- Create: `src/entitlements.ts`.
- Create: `scripts/verify-entitlements.ts`.

**Required exports:**
```ts
type Tier = 'free' | 'plus' | 'deep_reader';
type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due' | 'expired';
type FeatureKey = /* stable union */;

effectiveEntitlement(subscription, now): { tier: Tier; active: boolean; source: string; periodEnd: string | null };
quotaFor(tier, feature, policyVersion): number | 'unlimited' | 'unavailable';
canUseFeature(entitlement, feature): boolean;
periodKeyInAppTz(date): string;
```

**Steps:**
1. Create an explicit policy matrix keyed by tier and feature. Use placeholder policy values only for internal testing; Phase 1 receives approved customer-facing limits.
2. Normalize expiration/status entirely in this module; never duplicate it in UI/routes.
3. Assert boundary fixtures: absent subscription → Free; expired trial → Free; canceled future period stays active; status/tier invalid values fail closed; Bangkok month boundary produces correct `period_key`.
4. Add a fixture that proves achievements do not appear in `FeatureKey` or entitlement calculations.

**Acceptance:** A feature route can make one typed policy query, and client display cannot alter result.

### Task P0-4: Add transactional usage reservation service

**Objective:** Prevent quota bypass under concurrent requests and retry storms.

**Files:**
- Create: `src/usage.ts`.
- Modify: `src/db.ts` only if its transaction helper is inadequate.
- Extend: `scripts/verify-entitlements.ts` or create `scripts/verify-usage.ts`.

**Service contract:**
```ts
reserveUsage({ userId, featureKey, requestKey, resource }): Promise<{ reservationId; remaining; limit }>;
consumeUsage(reservationId): Promise<void>;
releaseUsage(reservationId, reason): Promise<void>;
usageSummary(userId): Promise<Record<FeatureKey, { used: number; reserved: number; limit: number | 'unlimited' | 'unavailable'; remaining: number | null }>>;
```

**Implementation details:**
1. Lock the owner’s subscription row or use an advisory/per-owner transactional serialization strategy before computing quota and inserting a reservation.
2. Count `consumed + reserved` for the current feature/period. Do not rely on client state.
3. Duplicate request keys return the existing logical reservation/result rather than incrementing usage.
4. A failure to reserve returns a typed `QuotaExceededError` including safe display facts: tier, feature, used, limit, reset period.
5. Release in a `finally` path unless generation has persisted a valid durable artifact and consumption has committed.
6. Preserve upstream scheduler semantics; quota reservation is not a substitute for provider concurrency/rate limits.

**Test fixtures:** double concurrent reservations at final available unit; repeat request key; successful consume; provider/parser error releases; prior-month events excluded; no subscription uses Free limits.

### Task P0-5: Expose authenticated plan and usage read API

**Objective:** Give current user a typed source of truth for later pricing/meters.

**Files:**
- Create: `src/routes/entitlements.ts`.
- Modify: `server.ts`.
- Modify: `src/api.ts`, `src/types.ts`.

**API:** `GET /api/entitlements/me`

**Response shape:**
```json
{
  "subscription": { "tier": "free", "status": "active", "source": "admin", "currentPeriodEnd": null },
  "features": { "ai_reader_generation": { "available": false, "usage": { "used": 0, "limit": 0, "remaining": 0, "periodKey": "2026-07" } } },
  "policyVersion": 1
}
```

**Requirements:**
- Must use `requireAuth` and `userFrom(req)`; no user ID query parameter.
- Return safe presentation facts only—never provider secret metadata, payment details or raw usage-event detail.
- Tests prove one user cannot request another user’s entitlement/usage.

### Task P0-6: Add limited admin/test grant command

**Objective:** Safely grant/revoke test, trial, admin and founding tiers before payment exists.

**Files:**
- Modify: `scripts/user.ts` or create `scripts/subscription.ts`.
- Modify: `package.json` with documented `grant-subscription` / `expire-subscription` scripts.
- Add: `scripts/verify-subscription-admin.ts`.

**CLI contract:**
```bash
npm run grant-subscription -- --username <name> --tier plus --status active --source admin --until 2026-12-31
npm run grant-subscription -- --username <name> --tier deep_reader --status trialing --source trial --until 2026-08-07
npm run expire-subscription -- --username <name>
```

**Rules:**
- DB-only operator command, never a browser-admin endpoint in this phase.
- Validate all enum/date inputs, resolve username deterministically, print only safe final status, and upsert one subscription row.
- Use the same tables/policy as payment will later use.

### Task P0-7: Wire guard hooks but preserve current behavior until Phase 1 activation

**Objective:** Introduce one reusable guard to existing generation code without accidentally breaking already-shipped flows.

**Files:**
- Modify relevant known entrypoints from P0-1.
- Create: `src/requireEntitlement.ts` if a narrow Express helper improves consistency.

**Approach:**
1. Add `ensureEntitledGeneration({ ownerId, featureKey, requestKey, resource })` to one shared boundary.
2. Stage it initially in observe-only/test mode backed by a policy flag; log only feature/result/count, never raw reading text or credentials.
3. Ensure new user-facing 402/403/429-style quota behavior is not exposed until Phase 1 acceptance makes a feature gated.
4. Preserve the existing primary summary; apply hooks first to standalone expensive generations/retries.

### Task P0-8: Verify, review and hand off migration

**Commands:**
```bash
npm run lint
npx tsx scripts/verify-entitlements.ts
npx tsx scripts/verify-usage.ts
npx tsx scripts/verify-entitlement-wiring.ts
npm run build
git diff --check
```

**Browser/API proof:**
- Login as Free and a manually granted Deep Reader test account; call `/api/entitlements/me` and confirm different server-derived response.
- Exercise a metered test action twice plus a duplicate retry; inspect safe usage response for one consumption only.
- Attempt a crafted client request with a fake `tier: deep_reader`; confirm the server ignores it.
- Walk Library → a real BookDetail on 375px and desktop; existing summaries/logs/podcasts render without regression.

**Commit:** `feat: add entitlement and quota foundation`

**Delivery note:** Before DEV deployment, provide Huy the exact additive SQL extracted from the finished schema. Do not run production DB migration without his explicit execution/deployment instruction.

---

## Exit criteria

- Operators can safely grant/revoke a tier using one CLI.
- Any future feature can ask one service for access and monthly usage.
- Quota checks are atomic, idempotent and auditable.
- No public pricing/payment UX is present yet.
- Existing reading history and feature access behavior remain intact until Phase 1’s deliberate gating rollout.
