import { Router, type Request, type Response } from "express";
import { query } from "../db.js";
import { effectiveEntitlement, ENTITLEMENT_POLICY_VERSION, featureKeys, membershipPlans, quotaFor, type FeatureKey } from "../entitlements.js";
import { usageSummary } from "../usage.js";
import { requireAuth, userFrom } from "../auth.js";
import { selectUpgradePrompt, type UpgradePromptKey } from "../upgrade-prompts.js";

export const entitlementsRouter = Router();

// Database result interfaces for type safety
interface SubscriptionRow {
  tier: "free" | "plus" | "deep_reader";
  status: "active" | "canceled" | "expired";
  current_period_end: string | null;
  granted_by: "payment" | "trial" | "admin" | "founding" | null;
}

interface PromptStateRow {
  prompt_key: string;
  shown_at: Date | null;
  dismissed_at: Date | null;
}

entitlementsRouter.get("/plans", (_req: Request, res: Response) => {
  res.json({ policyVersion: ENTITLEMENT_POLICY_VERSION, checkoutAvailable: false, plans: membershipPlans() });
});

entitlementsRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = userFrom(req).id;
    const subscription = (await query<SubscriptionRow>("SELECT tier,status,current_period_end,granted_by FROM subscriptions WHERE user_id=$1", [userId])).rows[0];
    const entitlement = effectiveEntitlement(subscription);
    const usage = await usageSummary(userId);
    const features = Object.fromEntries(featureKeys().map((feature: FeatureKey) => {
      const limit = quotaFor(entitlement.tier, feature);
      const current = usage[feature] || { used: 0, reserved: 0 };
      return [feature, { available: limit !== "unavailable", usage: { used: current.used, reserved: current.reserved, limit, remaining: typeof limit === "number" ? Math.max(0, limit - current.used - current.reserved) : null } }];
    }));
    res.json({ subscription: entitlement, features, policyVersion: ENTITLEMENT_POLICY_VERSION });
  } catch (error: unknown) { 
    console.error("[entitlements] /me error:", error);
    res.status(503).json({ error: "membership status unavailable" }); 
  }
});

// GET /api/entitlements/prompts?bookId=<uuid> — owner-scoped upgrade prompt
entitlementsRouter.get("/prompts", requireAuth, async (req: Request, res: Response) => {
  const { bookId } = req.query;
  if (typeof bookId !== "string") return res.status(400).json({ error: "bookId query parameter required" });

  try {
    const userId = userFrom(req).id;

    // Validate book ownership
    const bookCheck = await query<{ exists: number }>("SELECT 1 AS exists FROM books WHERE id=$1 AND owner_id=$2", [bookId, userId]);
    if (!bookCheck.rows.length) return res.status(404).json({ error: "book not found" });

    // Gather owner-scoped aggregate facts
    const [subscription, sessionCount, wikiCheck, promptStates, usage] = await Promise.all([
      query<SubscriptionRow>("SELECT tier,status,current_period_end,granted_by FROM subscriptions WHERE user_id=$1", [userId]),
      query<{ c: number }>("SELECT count(*)::int AS c FROM reading_log WHERE book_id=$1 AND raw_text IS NOT NULL", [bookId]),
      query<{ exists: number }>("SELECT 1 AS exists FROM book_wiki WHERE book_id=$1", [bookId]),
      query<PromptStateRow>("SELECT prompt_key, shown_at, dismissed_at FROM membership_prompt_state WHERE owner_id=$1", [userId]),
      usageSummary(userId),
    ]);

    const entitlement = effectiveEntitlement(subscription.rows[0]);
    const baseFacts = {
      tier: entitlement.tier,
      active: entitlement.active,
      sessionCount: sessionCount.rows[0]?.c || 0,
      hasWiki: wikiCheck.rows.length > 0,
      usage,
    };

    // Each prompt has its own cooldown; one dismissal must not hide another.
    const dismissedAtByKey = Object.fromEntries(promptStates.rows.map((row: PromptStateRow) => [row.prompt_key, row.dismissed_at || null]));
    const prompt = selectUpgradePrompt({ ...baseFacts, dismissedAtByKey }, bookId);

    if (!prompt) return res.json({ prompt: null });

    // Record shown_at server-side for observability
    await query(
      "INSERT INTO membership_prompt_state (owner_id, prompt_key, shown_at, updated_at) VALUES ($1,$2,now(),now()) ON CONFLICT (owner_id, prompt_key) DO UPDATE SET shown_at=now(), updated_at=now()",
      [userId, prompt.key]
    );

    res.json({ prompt });
  } catch (error: unknown) {
    console.error("[entitlements] /prompts error:", error);
    res.status(500).json({ error: "prompt unavailable" });
  }
});

// PATCH /api/entitlements/prompts/:key — dismiss an upgrade prompt
entitlementsRouter.patch("/prompts/:key", requireAuth, async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!key) return res.status(400).json({ error: "prompt key required" });

  try {
    const userId = userFrom(req).id;
    const result = await query(
      "UPDATE membership_prompt_state SET dismissed_at = now(), updated_at = now() WHERE owner_id=$1 AND prompt_key=$2 AND shown_at IS NOT NULL RETURNING prompt_key",
      [userId, key]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "prompt not shown or already dismissed" });
    }
    res.json({ success: true, key: result.rows[0].prompt_key });
  } catch (error: unknown) {
    console.error("[entitlements] /prompts/:key error:", error);
    res.status(500).json({ error: "dismiss failed" });
  }
});
