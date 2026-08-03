# Chapter — Membership Conversion Pricing Page

## Intent
Make `/pricing` a clear, credible decision page that helps a reader understand what becomes deeper with membership and how payment works—without gamification, fake urgency, feature promises that do not exist, or a public payment-confirmation path.

## Research direction
The supplied Claude/Google references establish transferable patterns only: a value-first opening, an easy-to-scan plan comparison, one clearly recommended decision path, transparent payment/cancellation answers, and progressive disclosure through FAQ. Their copy, brand, and proprietary design will not be copied. Direct extraction was blocked by the fetch provider's unavailable API credential, so this plan relies on those general public patterns plus Chapter's live product contract.

## Truthful product boundary found in code
- Free reading stays free: Library, progress, notes, goals, streaks, quote archive, basic summaries.
- Deep Reader is implemented and server-gated: Book Wiki / Reading Lens capacity, chapter podcast capacity, Podcast Recap, Monthly Reading Review, Ask My Reading, Cross-book Connections, and priority queue; current quotas are enforced in `src/entitlements.ts`.
- Reader Plus does **not** currently have differentiated enforced entitlement benefits. Do not sell it as "higher AI capacity", advanced stats, Markdown export, review, or priority queue until each is implemented and gated.
- Static MB checkout is only actionable when the server returns `billing.enabled: true`. Current DEV is intentionally disabled; page must remain informative, not fake a purchase button.

## UX / visual structure

### 1. Decision-led hero
- Eyebrow: `Membership`.
- Heading: **Keep the habit free. Go deeper when a book asks for more.**
- Two concise value lines: free foundation always stays free; membership adds source-grounded companionship around the reader's own sessions.
- A restrained `See what changes` anchor link scrolls to comparison; checkout action appears only where billing is enabled.

### 2. Featured Deep Reader decision card
- Deep Reader appears visually featured—not oversized—with `Most complete reading companion` label.
- Show monthly and annual prices sourced from billing catalog (not duplicated hard-coded values); annual saving calculated only from those values.
- Three concrete outcome blocks, all tied to implemented features:
  1. **Return to the book** — Book Wiki, Reading Lens, Reading Map.
  2. **Ask across your sessions** — Ask My Reading and cross-book connections, grounded only in saved reading material.
  3. **Hear the thread again** — recap podcast and monthly review.
- Primary CTA opens the server-owned checkout sheet only when `billing.enabled`; otherwise a calm `Checkout is being prepared` state.

### 3. Clear plan comparison benchmark
- Replace vague benefits / "coming later" cards with a compact accessible comparison section:
  - Rows: core reading foundation, book-level companion, advanced session questions, connected ideas across books, recap audio, monthly review, source/data boundaries.
  - Columns: Free / Reader Plus / Deep Reader.
  - Use truthful visual `Included`, `Not included`, `Coming next` only for Plus (or render Plus as an *early membership / future tier* explicitly—not falsely feature-complete).
- Add a short capacity benchmark for Deep Reader from server contract, labeled `Current monthly capacity` rather than unlimited claim:
  - 20 Book Wiki / Reading Lens analyses
  - 10 chapter podcasts
  - 4 recap podcasts
  - 1 monthly reading review
  - 30 Ask My Reading questions
  - 12 cross-book connection requests
- Keep quotas secondary below outcomes; no meter/pressure language.

### 4. Payment clarity section
- A 3-step process with exact truthful state:
  1. choose a plan,
  2. receive a unique MB QR and transfer reference,
  3. payment is reviewed through the internal payment process and access is applied to the order.
- Explain: no card is stored, QR/reference are unique per order, do not alter the transfer content, payment history lives in Account.
- When billing disabled: say checkout is not open yet; do not name bank/account or leak receiver/QR details.
- Do not state instant auto-activation: confirmation is CLI/operator-reviewed by current design.

### 5. FAQ accordion (semantic buttons)
Questions:
1. What stays free forever?
2. What does Deep Reader add today?
3. How do the monthly capacities work?
4. How does MB bank transfer work?
5. When will access appear after I transfer?
6. Can I keep using my notes and reading history if I do not renew?
7. Where are my reading materials used?

Answers must reflect implemented policy: only persisted reading material grounds companion answers; raw session text is private; no external book knowledge is claimed; expiration returns entitlement to Free but leaves reader-owned library/progress/notes intact.

### 6. Footer conversion close
- A quiet closing statement and one Deep Reader action (or disabled checkout explanation).
- No countdown, artificial scarcity, modal auto-open, or repeated purchase CTA.

## Implementation design
1. Replace `Pricing.tsx` composition with feature-level components/data rather than hard-coded promises.
2. Update `PricingCard` or replace it with a responsive `PlanComparison` + feature card composition.
3. Derive displayed SKU pricing/savings and checkout actions from `BillingCatalogResponse`; preserve server-owned SKU only.
4. Add `PricingFaq` component with keyboard-safe accordions (`button`, `aria-expanded`, `aria-controls`), single/multiple expansion intentionally chosen (multiple open by default for scanning is recommended).
5. Add `id="comparison"` anchor and scroll-safe link.
6. Add a deterministic source fixture asserting:
   - no “Coming in a later chapter” as an available paid benefit;
   - Deep Reader quotas match the current entitlement contract;
   - checkout can only open through billing-enabled branch;
   - FAQs include privacy, payment-review, and free-data-retention truths.
7. Keep API/schema/billing confirmation lifecycle untouched.

## Files likely touched
- `src/pages/Pricing.tsx`
- `src/components/PricingCard.tsx` (refactor or retire)
- `src/components/PricingComparison.tsx` (new)
- `src/components/PricingFaq.tsx` (new)
- narrow source fixture/check script if needed
- `.hermes/plans/2026-08-01-membership-pricing-conversion-ux.md`

## Verification
- `npx tsc --noEmit`, `npm run build`, `git diff --check`.
- Unit/source fixture validates prices/quota claims and checkout guard.
- Authenticated DEV browser using a fixture Free account, desktop + ~390px:
  - scan/order, no overflow;
  - comparison anchor;
  - FAQ keyboard/open-close;
  - billing-disabled appearance does not leak bank/QR details;
  - conditional billing-enabled behavior via existing safe API fixture only, never a real transfer.
- Console clean, health check, cleanup fixture user, commit/push `dev`, deploy DEV.

## Typography alignment (approved addition)
- Convert the authenticated app shell default from `font-serif` to `font-sans`.
- Replace remaining user-facing `font-serif` utility usage in source with `font-sans` so headings, cards, forms, and Membership share one type family.
- Preserve hierarchy through size, weight, tracking, spacing, and restrained color; do not introduce a new font or alter API/business behavior.
- Search all `src/**/*.tsx` for `font-serif`; source fixture must require zero remaining user-facing `font-serif` utilities.

## Explicit out of scope
- Enabling real checkout, changing MB account details, auto-confirmation/webhooks, price changes, Plus entitlement implementation, subscription/refund policy changes, and PRD deploy.

## Decision required
The plan makes **Deep Reader** the featured, buy-now value tier because it has real implemented features. Reader Plus is retained as transparent `Early membership` / `A lighter tier is being prepared` at its existing server price, not sold as fully-featured. If Reader Plus should become sellable today, define actual enforceable benefits first; do not use aspirational copy.