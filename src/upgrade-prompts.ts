import type { Tier, FeatureKey } from "./entitlements.js";

/**
 * Phase 2: Contextual upgrade prompt keys.
 * Closed union — never accept arbitrary strings from the client.
 */
export type UpgradePromptKey = "reading_map_depth" | "book_wiki_depth" | "quota_reached";

/**
 * Safe input facts for prompt policy. No book title, notes, raw text, quotes,
 * or client-provided marketing text — only server-owned aggregates and tier state.
 */
export interface PromptPolicyInput {
  tier: Tier;
  active: boolean;
  sessionCount: number;
  hasWiki: boolean;
  quotaFact?: {
    feature: FeatureKey;
    used: number;
    limit: number;
    periodKey: string;
  };
  /** Per-prompt server-persisted dismissals; prevents one dismissal suppressing another prompt. */
  dismissedAtByKey?: Partial<Record<UpgradePromptKey, Date | null>>;
}

/**
 * A selected upgrade prompt, or null if none match policy.
 */
export interface UpgradePrompt {
  key: UpgradePromptKey;
  targetTier: Tier;
  message: string;
  feature?: FeatureKey;
  context: {
    bookId: string;
  };
}

const DISMISS_COOLDOWN_DAYS = 30;

/**
 * Pure prompt selection policy. Returns at most one prompt, or null.
 * Priority: quota → reading map → wiki.
 */
export function selectUpgradePrompt(
  input: PromptPolicyInput,
  bookId: string
): UpgradePrompt | null {
  // No prompts for active deep_reader tier
  if (input.tier === "deep_reader" && input.active) {
    return null;
  }

  const isDismissed = (key: UpgradePromptKey) => {
    const dismissedAt = input.dismissedAtByKey?.[key];
    return !!dismissedAt && (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24) < DISMISS_COOLDOWN_DAYS;
  };

  // Priority 1: Quota exhaustion (from trusted server facts only)
  if (input.quotaFact) {
    const { feature, used, limit } = input.quotaFact;
    if (used >= limit && !isDismissed("quota_reached")) {
      return {
        key: "quota_reached",
        targetTier: "plus",
        message: `You've used ${used} of ${limit} ${feature} this month. Upgrade to continue.`,
        feature,
        context: { bookId },
      };
    }
  }

  // Priority 2: Reading Map depth (3+ sessions with raw text)
  if (input.sessionCount >= 3 && !isDismissed("reading_map_depth")) {
    return {
      key: "reading_map_depth",
      targetTier: "deep_reader",
      message: "Bạn đã có đủ giá trị từ các buổi đọc… nối chúng thành Reading Map riêng để những điều đã đọc không bị trôi đi.",
      context: { bookId },
    };
  }

  // Priority 3: Book Wiki depth (only if wiki exists and map prompt not selected)
  if (input.hasWiki && !isDismissed("book_wiki_depth")) {
    return {
      key: "book_wiki_depth",
      targetTier: "deep_reader",
      message: "Your AI Reader map is ready. Unlock deeper drillable connections and context.",
      context: { bookId },
    };
  }

  return null;
}

/**
 * Fixture validation for prompt policy.
 */
export function upgradePromptFixtureCheck(): void {
  const baseInput: PromptPolicyInput = {
    tier: "free",
    active: true,
    sessionCount: 0,
    hasWiki: false,
  };

  // Fixture 1: No prompt before value exists
  const noValue = selectUpgradePrompt(baseInput, "book-1");
  if (noValue !== null) throw new Error("Expected no prompt with 0 sessions and no wiki");

  // Fixture 2: Reading map prompt at 3+ sessions
  const threeSessions = selectUpgradePrompt({ ...baseInput, sessionCount: 3 }, "book-2");
  if (threeSessions?.key !== "reading_map_depth") throw new Error("Expected reading_map_depth at 3 sessions");

  // Fixture 3: Wiki prompt when wiki exists (and sessions < 3)
  const wikiOnly = selectUpgradePrompt({ ...baseInput, sessionCount: 2, hasWiki: true }, "book-3");
  if (wikiOnly?.key !== "book_wiki_depth") throw new Error("Expected book_wiki_depth when wiki exists");

  // Fixture 4: Quota takes precedence over previews
  const quotaFirst = selectUpgradePrompt(
    {
      ...baseInput,
      sessionCount: 5,
      hasWiki: true,
      quotaFact: { feature: "podcast_chapter_generation", used: 10, limit: 10, periodKey: "2026-07" },
    },
    "book-4"
  );
  if (quotaFirst?.key !== "quota_reached") throw new Error("Expected quota_reached to take precedence");

  // Fixture 5: Deep reader suppression
  const deepReaderActive = selectUpgradePrompt(
    { ...baseInput, tier: "deep_reader", sessionCount: 5, hasWiki: true },
    "book-5"
  );
  if (deepReaderActive !== null) throw new Error("Expected no prompt for active deep_reader");

  // Fixture 6: Dismiss cooldown
  const recentDismiss = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
  const coolingDown = selectUpgradePrompt(
    { ...baseInput, sessionCount: 5, dismissedAtByKey: { reading_map_depth: recentDismiss } },
    "book-6"
  );
  if (coolingDown !== null) throw new Error("Expected no prompt during 30-day cooldown");

  // Fixture 7: Cooldown expired
  const oldDismiss = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
  const cooldownExpired = selectUpgradePrompt(
    { ...baseInput, sessionCount: 5, dismissedAtByKey: { reading_map_depth: oldDismiss } },
    "book-7"
  );
  if (cooldownExpired?.key !== "reading_map_depth") throw new Error("Expected prompt after cooldown expires");

  console.log("[upgrade-prompts] UPGRADE_PROMPT_FIXTURES_OK");
}
