import crypto from "crypto";

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function passwordError(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 10 || value.length > 256) return "Password must be between 10 and 256 characters.";
  return null;
}

export function newOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function tokenHash(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function sha256(value: string): string {
  return tokenHash(value);
}

export function safeUsername(seed: string): string {
  const base = seed.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "reader";
  return `${base}_${crypto.randomBytes(4).toString("hex")}`;
}

export function pkceChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function randomUrlToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function appUrl(pathname = ""): string {
  return `${process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}${pathname}`;
}
