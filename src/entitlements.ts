export type Tier = "free" | "plus" | "deep_reader";
export type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due" | "expired";
export type GrantSource = "payment" | "trial" | "admin" | "founding";
export type FeatureKey = "ai_reader_generation" | "reading_lens_generation" | "podcast_chapter_generation" | "podcast_recap_generation" | "markdown_export" | "monthly_review_generation" | "ask_my_reading" | "cross_book_connections" | "priority_ai_queue";

export type SubscriptionRow = { tier: Tier; status: SubscriptionStatus; current_period_end: string | Date | null; granted_by: GrantSource };
export type EffectiveEntitlement = { tier: Tier; status: SubscriptionStatus; active: boolean; source: GrantSource; periodEnd: string | null };
export type Quota = number | "unlimited" | "unavailable";
export type BillingPeriod = "month" | "year";
export type MembershipBenefit = { label: string; availableNow: boolean };
export type MembershipPlan = {
  tier: Tier;
  name: string;
  tagline: string;
  monthlyPrice: string | null;
  annualPrice: string | null;
  annualLabel: string | null;
  benefits: readonly MembershipBenefit[];
  checkoutAvailable: false;
};

const FEATURES: readonly FeatureKey[] = ["ai_reader_generation", "reading_lens_generation", "podcast_chapter_generation", "podcast_recap_generation", "markdown_export", "monthly_review_generation", "ask_my_reading", "cross_book_connections", "priority_ai_queue"];
export const ENTITLEMENT_POLICY_VERSION = 2;

// Phase 0 establishes the contract without changing existing feature behavior.
// Phase 1 replaces these internal limits with approved customer-facing policy.
const QUOTAS: Record<Tier, Record<FeatureKey, Quota>> = {
  // Phase 1 is presentation-only: current generators remain unchanged until a
  // later phase ships feature enforcement and direct API contracts together.
  free: { ai_reader_generation: "unlimited", reading_lens_generation: "unlimited", podcast_chapter_generation: "unlimited", podcast_recap_generation: "unavailable", markdown_export: "unlimited", monthly_review_generation: "unavailable", ask_my_reading: "unavailable", cross_book_connections: "unavailable", priority_ai_queue: "unavailable" },
  plus: { ai_reader_generation: "unlimited", reading_lens_generation: "unlimited", podcast_chapter_generation: "unlimited", podcast_recap_generation: "unavailable", markdown_export: "unlimited", monthly_review_generation: "unavailable", ask_my_reading: "unavailable", cross_book_connections: "unavailable", priority_ai_queue: "unavailable" },
  deep_reader: { ai_reader_generation: 20, reading_lens_generation: 20, podcast_chapter_generation: 10, podcast_recap_generation: 4, markdown_export: "unlimited", monthly_review_generation: 1, ask_my_reading: 30, cross_book_connections: 12, priority_ai_queue: "unlimited" },
};

const MEMBERSHIP_PLANS: readonly MembershipPlan[] = [
  { tier: "free", name: "Free", tagline: "Start Reading", monthlyPrice: null, annualPrice: null, annualLabel: null, checkoutAvailable: false, benefits: [
    { label: "Library, progress, notes and quote archive", availableNow: true },
    { label: "Reading logs, goals, streaks and quiet milestones", availableNow: true },
    { label: "Basic reading summaries", availableNow: true },
  ] },
  { tier: "plus", name: "Reader Plus", tagline: "Read Consistently", monthlyPrice: "59k/month", annualPrice: "599k/year", annualLabel: "Save 109k with annual", checkoutAvailable: false, benefits: [
    { label: "Higher AI and chapter-podcast capacity", availableNow: false },
    { label: "Advanced stats and Markdown export", availableNow: false },
    { label: "Monthly Reading Review and light priority queueing", availableNow: false },
  ] },
  { tier: "deep_reader", name: "Deep Reader", tagline: "Understand What You Read", monthlyPrice: "149k/month", annualPrice: "1.39m/year", annualLabel: "Save 398k with annual", checkoutAvailable: false, benefits: [
    { label: "Everything in Reader Plus", availableNow: false },
    { label: "Full Book Wiki, Reading Lens and Reading Map", availableNow: false },
    { label: "Cross-book connections, sourced questions and recap podcast", availableNow: false },
  ] },
];

export function membershipPlans(): readonly MembershipPlan[] { return MEMBERSHIP_PLANS; }

function validTier(value: unknown): value is Tier { return value === "free" || value === "plus" || value === "deep_reader"; }
function validStatus(value: unknown): value is SubscriptionStatus { return value === "active" || value === "trialing" || value === "canceled" || value === "past_due" || value === "expired"; }
function validSource(value: unknown): value is GrantSource { return value === "payment" || value === "trial" || value === "admin" || value === "founding"; }

export function featureKeys(): readonly FeatureKey[] { return FEATURES; }
export function isFeatureKey(value: unknown): value is FeatureKey { return typeof value === "string" && FEATURES.includes(value as FeatureKey); }

export function effectiveEntitlement(subscription: Partial<SubscriptionRow> | null | undefined, now = new Date()): EffectiveEntitlement {
  const tier = validTier(subscription?.tier) ? subscription.tier : "free";
  const status = validStatus(subscription?.status) ? subscription.status : "expired";
  const source = validSource(subscription?.granted_by) ? subscription.granted_by : "admin";
  const rawEnd = subscription?.current_period_end;
  const end = rawEnd ? new Date(rawEnd) : null;
  const periodEnd = end && !Number.isNaN(end.valueOf()) ? end.toISOString() : null;
  const inPeriod = !end || end > now;
  const active = tier !== "free" && inPeriod && (status === "active" || status === "trialing" || status === "canceled" || status === "past_due");
  return { tier: active ? tier : "free", status, active, source, periodEnd };
}

export function quotaFor(tier: Tier, feature: FeatureKey, _policyVersion = ENTITLEMENT_POLICY_VERSION): Quota { return QUOTAS[tier][feature]; }
export function canUseFeature(entitlement: EffectiveEntitlement, feature: FeatureKey): boolean { return entitlement.active && quotaFor(entitlement.tier, feature) !== "unavailable"; }

export function periodKeyInAppTz(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("could not resolve app billing period");
  return `${year}-${month}`;
}

export class FeatureUnavailableError extends Error { constructor(public readonly feature: FeatureKey, public readonly tier: Tier) { super("This feature is not available on the current plan."); this.name = "FeatureUnavailableError"; } }
export class QuotaExceededError extends Error { constructor(public readonly feature: FeatureKey, public readonly tier: Tier, public readonly used: number, public readonly limit: number, public readonly periodKey: string) { super("Monthly usage limit reached."); this.name = "QuotaExceededError"; } }

export function entitlementFixtureCheck(): void {
  if (effectiveEntitlement(null).tier !== "free") throw new Error("missing subscription must be free");
  if (effectiveEntitlement({ tier: "deep_reader", status: "trialing", current_period_end: "2000-01-01", granted_by: "trial" }).tier !== "free") throw new Error("expired trial must be free");
  if (effectiveEntitlement({ tier: "plus", status: "canceled", current_period_end: "2999-01-01", granted_by: "payment" }).tier !== "plus") throw new Error("canceled in-period subscription must remain active");
  if (periodKeyInAppTz(new Date("2026-07-31T18:00:00.000Z")) !== "2026-08") throw new Error("Bangkok period boundary failed");
  if (featureKeys().includes("priority_ai_queue") && !isFeatureKey("ai_reader_generation")) throw new Error("feature key fixture failed");
}
