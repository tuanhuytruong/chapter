import { Router, type Request, type Response } from "express";
import { query } from "../db.js";
import { effectiveEntitlement, ENTITLEMENT_POLICY_VERSION, featureKeys, membershipPlans, quotaFor, type FeatureKey } from "../entitlements.js";
import { usageSummary } from "../usage.js";
import { requireAuth, userFrom } from "../auth.js";
import { selectUpgradePrompt, type UpgradePromptKey } from "../upgrade-prompts.js";

export const entitlementsRouter = Router();

entitlementsRouter.get("/plans", (_req: Request, res: Response) => {
  res.json({ policyVersion: ENTITLEMENT_POLICY_VERSION, checkoutAvailable: false, plans: membershipPlans() });
});

entitlementsRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = userFrom(req).id;
    const subscription = (await query<any>("SELECT tier,status,current_period_end,granted_by FROM subscriptions WHERE user_id=$1", [userId])).rows[0];
    const entitlement = effectiveEntitlement(subscription);
    const usage = await usageSummary(userId);
    const features = Object.fromEntries(featureKeys().map((feature: FeatureKey) => {
      const limit = quotaFor(entitlement.tier, feature);
      const current = usage[feature] || { used: 0, reserved: 0 };
      return [feature, { available: limit !== "unavailable", usage: { used: current.used, reserved: current.reserved, limit, remaining: typeof limit === "number" ? Math.max(0, limit - current.used - current.reserved) : null } }];
    }));
    res.json({ subscription: entitlement, features, policyVersion: ENTITLEMENT_POLICY_VERSION });
  } catch (error: any) { res.status(503).json({ error: "membership status unavailable" }); }
});

// GET /api/entitlements/prompts?bookId=<uuid> — owner-scoped upgrade prompt
entitlementsRouter.get("/prompts", requireAuth, async (req: Request, res: Response) => {
  const { bookId } = req.query;
  if (typeof bookId !== "string") return res.status(400).json({ error: "bookId query parameter required" });

  try {
    const userId = userFrom(req).id;

    // Validate book ownership
    const bookCheck = await query<any>("SELECT 1 FROM books WHERE id=$1 AND owner_id=$2", [bookId, userId]);
    if (!bookCheck.rows.length) return res.status(404).json({ error: "book not found" });

    // Gather owner-scoped aggregate facts
    const [subscription, sessionCount, wikiCheck, promptStates, usage] = await Promise.all([
      query<any>("SELECT tier,status,current_period_end,granted_by FROM subscriptions WHERE user_id=$1", [userId]),
      query<any>("SELECT count(*)::int AS c FROM reading_log WHERE book_id=$1 AND raw_text IS NOT NULL", [bookId]),
      query<any>("SELECT 1 FROM book_wiki WHERE book_id=$1", [bookId]),
      query<any>("SELECT prompt_key, shown_at, dismissed_at FROM membership_prompt_state WHERE owner_id=$1", [userId]),
      usageSummary(userId),
    ]);

    const entitlement = effectiveEntitlement(subscription.rows[0]);
    const baseFacts = {
      tier: entitlement.tier,
      active: entitlement.active,
      sessionCount: sessionCount.rows[0]?.c || 0,
      hasWiki: wikiCheck.rows.length > 0,
    };

    // Normalize dismissal timestamps and filter invalid keys
    const validKeys: UpgradePromptKey[] = ["reading_map_depth", "book_wiki_depth", "quota_reached"];
    const dismissedAtByKey = Object.fromEntries(
      promptStates.rows
        .filter((row: any) => validKeys.includes(row.prompt_key))
        .map((row: any) => {
          const dismissedAt = row.dismissed_at ? new Date(row.dismissed_at) : null;
          return [row.prompt_key, dismissedAt && !Number.isNaN(dismissedAt.getTime()) ? dismissedAt : null];
        })
    ) as Partial<Record<UpgradePromptKey, Date | null>>;

    const prompt = selectUpgradePrompt({ ...baseFacts, dismissedAtByKey }, bookId);

    // Record shown_at atomically when returning a prompt
    if (prompt) {
      await query(
        "INSERT INTO membership_prompt_state (owner_id, prompt_key, shown_at, updated_at) VALUES ($1, $2, now(), now()) ON CONFLICT (owner_id, prompt_key) DO UPDATE SET shown_at = COALESCE(membership_prompt_state.shown_at, now()), updated_at = now()",
        [userId, prompt.key]
      );
    }

    res.json({ prompt });
  } catch (error: any) {
    console.error("[entitlements] prompt fetch failed:", error.message);
    res.status(503).json({ error: "upgrade prompts unavailable" });
  }
});

// PATCH /api/entitlements/prompts/:key — dismiss an upgrade prompt
entitlementsRouter.patch("/prompts/:key", requireAuth, async (req: Request, res: Response) => {
  const { key } = req.params;
  const { action } = req.body || {};

  if (action !== "dismiss") return res.status(400).json({ error: "action must be 'dismiss'" });

  // Validate prompt key against server union
  const validKeys: UpgradePromptKey[] = ["reading_map_depth", "book_wiki_depth", "quota_reached"];
  if (!validKeys.includes(key as UpgradePromptKey)) {
    return res.status(400).json({ error: "invalid prompt key" });
  }

  try {
    const userId = userFrom(req).id;
    const result = await query(
      "UPDATE membership_prompt_state SET dismissed_at = now(), updated_at = now() WHERE owner_id=$1 AND prompt_key=$2 AND shown_at IS NOT NULL RETURNING prompt_key",
      [userId, key]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "prompt not shown or already dismissed" });
    }
    res.status(204).end();
  } catch (error: any) {
    console.error("[entitlements] prompt dismiss failed:", error.message);
    res.status(503).json({ error: "dismiss failed" });
  }
});
