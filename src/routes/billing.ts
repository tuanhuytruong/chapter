import { Router, type Request, type Response } from "express";
import { requireAuth, userFrom } from "../auth.js";
import { billingCatalog } from "../billing/catalog.js";
import { billingMe, createBillingOrder, getBillingOrder } from "../billing/service.js";
import { vietQrConfig } from "../billing/vietqr.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

billingRouter.get("/catalog", (_req: Request, res: Response) => {
  const cfg = vietQrConfig();
  res.json({ enabled: cfg.enabled && Boolean(cfg.accountNumber && cfg.accountName), provider: "vietqr_static", bank: "MB", catalog: billingCatalog() });
});
billingRouter.get("/me", async (req: Request, res: Response) => {
  try { res.json(await billingMe(userFrom(req).id)); }
  catch { res.status(503).json({ error: "billing history unavailable" }); }
});
billingRouter.post("/orders", async (req: Request, res: Response) => {
  try {
    const result = await createBillingOrder(userFrom(req).id, req.body?.sku, req.body?.requestKey);
    if (result.status === "unavailable") return res.status(503).json({ error: "bank-transfer checkout is unavailable" });
    res.status(result.status === "created" ? 201 : 200).json(result);
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "checkout request failed" }); }
});
billingRouter.get("/orders/:id", async (req: Request, res: Response) => {
  try { const order = await getBillingOrder(userFrom(req).id, req.params.id); if (!order) return res.status(404).json({ error: "order not found" }); res.json({ order }); }
  catch { res.status(503).json({ error: "order unavailable" }); }
});
