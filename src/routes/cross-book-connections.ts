import { Router, Request, Response } from "express";
import { requireAuth, userFrom } from "../auth.js";
import { effectiveEntitlement, quotaFor } from "../entitlements.js";
import { query } from "../db.js";
import { usageSummary } from "../usage.js";
import { generateCrossBookConnections, getCrossBookConnections, getCrossBookSource, hasConnectionSource } from "../crossBookConnections.js";

export const crossBookConnectionsRouter = Router();
crossBookConnectionsRouter.use(requireAuth);

crossBookConnectionsRouter.get("/current", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    const [connection, sources, subscription, usage] = await Promise.all([
      getCrossBookConnections(ownerId), getCrossBookSource(ownerId),
      query<any>("SELECT tier,status,current_period_end,granted_by FROM subscriptions WHERE user_id=$1", [ownerId]), usageSummary(ownerId),
    ]);
    const entitlement = effectiveEntitlement(subscription.rows[0]);
    const limit = quotaFor(entitlement.tier, "cross_book_connections");
    const current = usage.cross_book_connections || { used: 0, reserved: 0 };
    res.json({
      connection,
      sourceBookCount: new Set(sources.map((source) => source.bookId)).size,
      sourceSessionCount: sources.filter((source) => source.sourceType === "log").length,
      hasSource: hasConnectionSource(sources),
      available: entitlement.active && limit !== "unavailable" && (limit === "unlimited" || current.used + current.reserved < limit),
      usage: { used: current.used, reserved: current.reserved, limit },
    });
  } catch { res.status(503).json({ error: "cross-book connections unavailable" }); }
});

crossBookConnectionsRouter.post("/generate", async (req: Request, res: Response) => {
  try { res.json(await generateCrossBookConnections(userFrom(req).id, req.body?.requestKey)); }
  catch (error: any) {
    if (error?.name === "FeatureUnavailableError") return res.status(403).json({ error: "Cross-book Connections is unavailable on the current plan" });
    if (error?.name === "QuotaExceededError") return res.status(429).json({ error: "Cross-book Connections quota reached" });
    res.status(502).json({ error: "Cross-book Connections failed" });
  }
});
