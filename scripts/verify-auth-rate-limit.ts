import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const server = read("server.ts");
const limiter = read("src/auth-rate-limit.ts");
const schema = read("src/db/schema.sql");
const migration = read("migrations/20260802_add_auth_rate_limits.sql");
const expected = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/google",
];
for (const route of expected) {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`app\\.(?:get|post)\\(\\s*"${escapedRoute}"\\s*,\\s*authRateLimit`).test(server)) {
    throw new Error(`missing durable rate limit on ${route}`);
  }
}
if (
  !limiter.includes("sha256") ||
  !limiter.includes("Retry-After") ||
  !limiter.includes("ON CONFLICT")
) {
  throw new Error("rate limiter must hash keys, return Retry-After, and update atomically");
}
for (const text of [schema, migration]) {
  if (!text.includes("auth_rate_limits") || !text.includes("window_started_at")) {
    throw new Error("schema/migration rate-limit contract missing");
  }
}
console.log("AUTH_RATE_LIMIT_CONTRACT_OK");
