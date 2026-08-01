# Chapter Phase 4 — VietQR Static Founding Launch Implementation Plan

> **For Hermes:** Implement only after this revised plan is approved. Keep basic reading and earned achievements permanently free. Do not expose credentials, enable automatic entitlement from a browser redirect, or treat an unverified bank transfer as paid.

**Goal:** Launch a Vietnam-first founding checkout using static VietQR images while retaining a provider-neutral billing core that can later switch to MB Paygate without changing subscriptions, orders, history, or entitlement authorization.

**Architecture:** A server-owned billing order selects an immutable plan SKU and produces a unique transfer reference. The server constructs a static VietQR URL using the configured MB receiving account and exact VND amount. Users scan the QR and transfer manually. The order remains `pending` until an owner-authorized server-side confirmation records a verified receipt/reference and atomically activates or extends the subscription. The browser return page is informational only.

**Payment choice:** Use **MB** as the static VietQR receiver, as explicitly approved by Huy. The receiving account number/name remain server configuration and are never returned as a secret; the public QR and payment instructions naturally include the transfer destination needed for the payer.

**Why this is safe for the interim:** Static VietQR is a payment instruction format, not a payment confirmation API. Therefore no public client route can mark an order paid. The confirmation action is an authenticated owner/admin operation with an auditable receipt reference. A later MB Paygate webhook adapter will call the same `confirmPaidOrder()` domain function.

**Tech stack:** React + TypeScript, Express, PostgreSQL `chapter` schema, existing entitlement policy and usage ledger; VietQR public image URL only.

---

## Product contract

- Launch SKUs: `plus_monthly`, `plus_annual`, `deep_reader_monthly`, `deep_reader_annual`; founding terms are explicitly server-owned.
- Prices: Plus `59,000 VND/month`, `599,000 VND/year`; Deep Reader `149,000 VND/month`, `1,390,000 VND/year` unless Huy changes them before public enablement.
- Founding offer must not be invented: keep it disabled until Huy approves its final discounted amount, quantity and end date.
- QR payload is generated from the exact server SKU amount and unique order transfer reference. The client never sends amount, tier, duration, account number, or payment status.
- Pending payments expire after a configurable interval (default 30 minutes); expired/pending orders grant nothing.
- A confirmation extends `current_period_end` from `max(now(), existing_end)` so a paid period is never shortened.
- Rejected, canceled or expired billing affects only future premium generation; it never deletes books, logs, notes, raw text, analyses, podcast history, or exports.

## Task 1 — Create immutable billing catalog and transfer-reference policy

**Files:**
- Create: `src/billing/catalog.ts`
- Modify: `src/entitlements.ts`
- Create: `scripts/verify-vietqr-billing-catalog.ts`

1. Define an immutable SKU table containing ID, tier, billing period, VND amount, entitlement duration and public availability.
2. Define a compact unique reference such as `CHP-<order token>` that meets bank transfer-content limits and identifies exactly one order.
3. Ensure the founding catalog is unavailable until explicit launch values are configured.
4. Fixture-check malformed SKU, client-supplied amount, unavailable SKU, bad reference length and duplicate request-key behavior.

## Task 2 — Add durable orders, confirmations and transaction history

**Files:**
- Create: `migrations/YYYYMMDD_add_vietqr_billing.sql`
- Modify: `src/db/schema.sql`, `src/db.ts`, `update.sh`
- Create: `scripts/verify-vietqr-billing-schema.ts`

1. Add `chapter.billing_orders`:
   - owner ID, immutable SKU/price/currency/tier/period snapshot;
   - `created|pending|paid|expired|rejected|canceled` status;
   - request key unique per owner; transfer reference globally unique;
   - provider `vietqr_static`, expiry, QR snapshot/meta, timestamps.
2. Add `chapter.billing_confirmations`:
   - order ID unique, confirmer user ID, transfer/receipt reference, received amount, optional received time, safe note, confirmation timestamp;
   - no raw bank statement or unnecessary payer PII.
3. Add `chapter.billing_transactions`:
   - owner/order unique, amount/currency, activated period bounds, source `vietqr_static`, timestamp.
4. Add indexes for owner history, transfer-reference lookup, pending expiration and admin confirmation review.
5. Keep SQL bootstrap compatible: do not put PL/pgSQL functions/triggers into `src/db/schema.sql` because the existing bootstrap splits on semicolons.

## Task 3 — Implement provider-neutral static VietQR billing service

**Files:**
- Create: `src/billing/types.ts`, `src/billing/service.ts`, `src/billing/vietqr.ts`
- Test: `scripts/verify-vietqr-billing-service.ts`

1. Load only non-secret public receiving account fields from server config: bank BIN, account number, account name and QR template. Defaults match the MB profile in the approved skill.
2. Build a QR URL only in this format:
   `https://api.vietqr.io/image/<BIN>-<ACCOUNT>-<TEMPLATE>.jpg?accountName=<encoded>&amount=<integer>&addInfo=<encoded-reference>`.
3. `createBillingOrder(ownerId, sku, requestKey)` atomically creates or returns the same pending order; derives amount/term/reference entirely server-side.
4. `getBillingOrder(ownerId, orderId)` is strictly owner-scoped and exposes only the payer-facing order/QR fields.
5. `expirePendingOrders()` updates only past-expiry pending orders and grants nothing.
6. `confirmPaidOrder({ orderId, confirmerId, receiptRef, receivedAmount })` locks the order, validates pending status, exact VND amount, confirmation idempotency and then atomically writes confirmation/transaction and activates/extends subscription using `granted_by='payment'`, `provider='vietqr_static'`.
7. Implement a disabled mode (`BILLING_VIETQR_ENABLED=false`) that returns a safe unavailable state and never creates payable orders.
8. Fixtures prove: owner isolation, idempotency, exact-amount enforcement, expired-order rejection, confirmation replay, active-period extension and no automatic confirmation from a QR URL.

## Task 4 — Add authenticated payer API and tightly scoped confirmation API

**Files:**
- Create: `src/routes/billing.ts`
- Modify: `server.ts`, `src/api.ts`
- Create: `scripts/verify-vietqr-billing-routes.ts`

1. Payer endpoints:
   - `GET /api/billing/catalog` — server-owned plans and enabled state.
   - `GET /api/billing/me` — authenticated owner subscription, current pending order and transaction history.
   - `POST /api/billing/orders` — authenticated, only `{ sku, requestKey }`; creates/returns pending order and QR details only when enabled.
   - `GET /api/billing/orders/:id` — owner scope required.
2. Confirmation endpoint is intentionally **not** exposed to normal users. Choose one secure interim mechanism:
   - a local CLI `scripts/confirm-vietqr-payment.ts` executed on DEV/PRD by Huy, requiring exact order ID, receipt reference and exact amount; or
   - an existing owner/admin-only authenticated route only if the app has a verified administrator authorization model.
3. Never infer confirmation from `?success=true`, transfer-reference text in a client request, a browser return URL, or a user-provided screenshot.
4. Return non-sensitive errors and never leak another owner’s order existence.

## Task 5 — Build calm static-QR checkout and billing history UI

**Files:**
- Modify: `src/pages/Pricing.tsx`, `src/pages/Account.tsx`, `src/components/PricingCard.tsx`, `src/components/MembershipStatusCard.tsx`, `src/api.ts`
- Create: `src/components/VietQrCheckoutSheet.tsx`, `src/components/BillingHistoryCard.tsx`

1. Pricing shows a “Pay by bank transfer” CTA only when catalog says VietQR billing is enabled.
2. Opening checkout creates/reuses one server-owned order, then displays the native QR image from its server-provided URL, exact VND amount, bank name, account name/number and copyable unique transfer content.
3. Clearly state: “Payment is confirmed after the transfer is matched; please keep this page open or check Account later.” Do not claim instant activation.
4. Show pending, expired, paid and rejected states; allow the user to generate a new order only after expiry/cancellation, preserving idempotent retry behavior.
5. Account shows current plan/end date and concise transaction history; no billing controls obscure reading controls.
6. Verify 320/375/430px and desktop: QR fits card, no horizontal overflow, transfer content can be copied, 44px targets, calm status/contrast, console clean.

## Task 6 — Configuration and operator confirmation workflow

**Files:**
- Modify: `.env.example`
- Create: `scripts/confirm-vietqr-payment.ts`, `scripts/verify-vietqr-billing-config.ts`

1. Commit placeholders only:
   - `BILLING_VIETQR_ENABLED=false`
   - `BILLING_VIETQR_BANK_BIN=970422`
   - `BILLING_VIETQR_ACCOUNT_NUMBER=`
   - `BILLING_VIETQR_ACCOUNT_NAME=`
   - `BILLING_VIETQR_TEMPLATE=IuPsscp`
   - `BILLING_ORDER_EXPIRY_MINUTES=30`
2. DEV/PRD `.env.local` holds the real MB account values; never print them in logs or source.
3. The confirmation CLI reads credentials/config locally and requires explicit `--order`, `--amount`, `--receipt-ref`; display a redacted review and require an interactive typed confirmation before mutation.
4. Document that Huy must match the bank transaction independently before running confirmation; the CLI cannot and must not claim bank-statement verification.

## Task 7 — DEV E2E and cleanup

**Files:**
- Create: `scripts/e2e-vietqr-billing-dev.sh`

1. Run catalog/schema/service/route fixtures, `npx tsc --noEmit`, `npm run build`, `git diff --check`.
2. Authenticated HTTPS E2E:
   - disabled mode shows catalog/history but cannot create payment order;
   - enabled test mode creates exactly one pending order; replay same request key returns it;
   - verify generated QR URL uses `api.vietqr.io/image`, MB BIN, exact server amount and unique encoded transfer reference;
   - crafted client requests cannot change amount/tier or confirm payment;
   - operator test command with exact amount confirms once; same command/replay cannot create a second transaction or extend again;
   - wrong amount and expired order fail with no entitlement change;
   - clean all temporary order/confirmation/transaction/subscription records and verify zero counts.
3. Browser test `https://chapter-dev.mrl.asia`: Account → Pricing → QR checkout sheet → pending/paid/expired history at mobile and desktop; inspect console/root/overflow/contrast.
4. Confirm PM2 and `/health` HTTP 200 after deploy.

## Task 8 — Commit, deploy and transition to MB Paygate

1. Commit only verified billing source/migrations/verifiers to `dev`; do not stage `.hermes/` plans or runtime workspace.
2. Deploy with `BILLING_VIETQR_ENABLED=false` by default. Enable DEV test mode only after Huy has placed receiving-account config in DEV `.env.local`.
3. Before public enablement, Huy explicitly verifies: account details, SKU prices, founding terms, transfer expiry, manual reconciliation owner, support/refund wording and a real small-value test transfer.
4. When MB Paygate arrives, implement a signed provider adapter that feeds normalized verified events into the same `confirmPaidOrder()` service; retain VietQR orders/history unchanged.

## Acceptance criteria

- QR amount/reference derive only from server-owned pending order data.
- A scan, transfer-message guess, redirect, or browser request cannot grant membership.
- One manually verified exact payment creates one confirmation, one transaction and one correct entitlement extension exactly once.
- Wrong amount, stale order, cross-owner order, confirmation replay and disabled billing cause no entitlement change.
- QR checkout UI is calm, responsive and unambiguous about pending confirmation.
- All DEV fixtures/E2E/browser checks pass and temporary payment data is cleaned up.

## Approval to proceed

This plan uses MB static VietQR (the established default) and starts with billing disabled until real receiving details are configured in DEV `.env.local`. After approval, em will copy the plan to the repo, create the Kanban, implement task-by-task, verify, push `dev` and deploy DEV.