import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const analytics = readFileSync(new URL("../src/analytics.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("../src/AuthContext.tsx", import.meta.url), "utf8");
const identify = analytics.match(/posthog\.identify\([^\n]+\)/)?.[0] || "";
assert.equal(identify, "posthog.identify(userId, { account_handle: accountHandle })");
assert.match(auth, /identifyAnalyticsUser\(user\.id, user\.username\)/);
assert.doesNotMatch(identify, /email|displayName|book_title|raw_text|notes/);
assert.match(analytics, /posthog\.reset\(\)/);
assert.match(analytics, /VITE_POSTHOG_ENVIRONMENT/);
assert.match(analytics, /environment: deploymentEnvironment \|\| "unknown"/);
assert.match(analytics, /posthog\.register\(analyticsContext\)/);
console.log("POSTHOG_IDENTITY_PRIVACY_FIXTURES_OK");
