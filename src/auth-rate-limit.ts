import crypto from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { query } from "./db.js";

export type AuthRateLimitPolicy = {
  scope: "login" | "forgot_password" | "reset_password" | "oauth";
  windowMs: number;
  maxAttempts: number;
  identifier: (req: Request) => string;
};

function safeHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalized(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().slice(0, 320)
    : "";
}

function keyFor(req: Request, identifier: string): string {
  // The database receives only a non-reversible key. req.ip is trustworthy only
  // because server.ts explicitly trusts exactly one known reverse proxy.
  return safeHash(`${req.ip || ""}\u0000${identifier || "anonymous"}`);
}

export function authRateLimit(policy: AuthRateLimitPolicy): RequestHandler {
  return async (req: Request, res: Response, next) => {
    const now = new Date();
    const windowStart = new Date(
      Math.floor(now.getTime() / policy.windowMs) * policy.windowMs,
    );
    const windowEnd = new Date(windowStart.getTime() + policy.windowMs);
    try {
      const { rows } = await query<{ attempts: number }>(
        `INSERT INTO auth_rate_limits (scope, rate_key, window_started_at, attempts, updated_at)
         VALUES ($1,$2,$3,1,now())
         ON CONFLICT (scope, rate_key, window_started_at)
         DO UPDATE SET attempts=auth_rate_limits.attempts+1, updated_at=now()
         RETURNING attempts`,
        [policy.scope, keyFor(req, policy.identifier(req)), windowStart.toISOString()],
      );
      const attempts = Number(rows[0]?.attempts || 0);
      if (attempts <= policy.maxAttempts) return next();
      const retryAfter = Math.max(
        1,
        Math.ceil((windowEnd.getTime() - now.getTime()) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfter));
      return res
        .status(429)
        .json({ error: "Too many requests. Please try again later." });
    } catch (error: any) {
      // Never turn an authentication-store outage into an unbounded bypass.
      console.error(
        `[auth-rate-limit] ${policy.scope} unavailable: ${error?.message || "unknown error"}`,
      );
      return res.status(503).json({ error: "Authentication service unavailable" });
    }
  };
}

export const authRateLimitPolicies = {
  login: (windowMs: number, maxAttempts: number): AuthRateLimitPolicy => ({
    scope: "login",
    windowMs,
    maxAttempts,
    identifier: (req) => normalized(req.body?.username),
  }),
  forgotPassword: (windowMs: number, maxAttempts: number): AuthRateLimitPolicy => ({
    scope: "forgot_password",
    windowMs,
    maxAttempts,
    identifier: (req) => normalized(req.body?.email),
  }),
  resetPassword: (windowMs: number, maxAttempts: number): AuthRateLimitPolicy => ({
    scope: "reset_password",
    windowMs,
    maxAttempts,
    identifier: (req) => normalized(req.body?.token),
  }),
  oauth: (windowMs: number, maxAttempts: number): AuthRateLimitPolicy => ({
    scope: "oauth",
    windowMs,
    maxAttempts,
    identifier: () => "initiation",
  }),
};
