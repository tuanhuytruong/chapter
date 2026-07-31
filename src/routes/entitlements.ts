import { Router, type Request, type Response } from "express";
import { query } from "../db.js";
import { effectiveEntitlement, ENTITLEMENT_POLICY_VERSION, featureKeys, quotaFor, type FeatureKey } from "../entitlements.js";
import { usageSummary } from "../usage.js";
import { requireAuth, userFrom } from "../auth.js";

export const entitlementsRouter = Router();

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
