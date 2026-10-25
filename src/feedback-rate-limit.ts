import crypto from "node:crypto";
import type { Request, Response } from "express";
import { query } from "./db.js";

function ownerRateKey(req: Request): string {
  const ownerId = req.session.user?.id || "anonymous";
  return crypto.createHash("sha256").update(`feedback\u0000${ownerId}`).digest("hex");
}

/**
 * Durable cap invoked only after a request passes validation, so malformed
 * attempts never consume a reader's daily feedback allowance.
 */
export async function consumeFeedbackRateLimit(
  req: Request,
  res: Response,
  maxAccepted = 5,
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
  try {
    const { rows } = await query<{ attempts: number }>(
      `INSERT INTO feedback_rate_limits (rate_key, window_started_at, attempts, updated_at)
       VALUES ($1,$2,1,now())
       ON CONFLICT (rate_key, window_started_at)
       DO UPDATE SET attempts=feedback_rate_limits.attempts+1, updated_at=now()
       RETURNING attempts`,
      [ownerRateKey(req), windowStart.toISOString()],
    );
    const attempts = Number(rows[0]?.attempts || 0);
    if (attempts <= maxAccepted) return true;
    const retryAfter = Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ error: "You have sent enough feedback for today. Please try again tomorrow." });
    return false;
  } catch (error: any) {
    console.error(`[feedback-rate-limit] unavailable: ${error?.message || "unknown error"}`);
    res.status(503).json({ error: "Feedback is temporarily unavailable. Please try again later." });
    return false;
  }
}
