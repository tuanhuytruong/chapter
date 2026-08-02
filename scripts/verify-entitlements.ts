import assert from "node:assert/strict";
import {
  entitlementFixtureCheck,
  effectiveEntitlement,
  featureKeys,
  periodKeyInAppTz,
  retentionState,
} from "../src/entitlements.js";
import { readFileSync } from "node:fs";

entitlementFixtureCheck();
assert.equal(effectiveEntitlement({ tier: "plus", status: "active", current_period_end: "2999-01-01", granted_by: "admin" }).tier, "plus");
assert.ok(featureKeys().length >= 5);
assert.equal(periodKeyInAppTz(new Date("2026-01-31T18:00:00.000Z")), "2026-02");

const frozenNow = new Date("2026-08-02T16:30:00.000Z"); // Aug 2 in Bangkok
const canceledEndingSoon = effectiveEntitlement({
  tier: "plus",
  status: "canceled",
  current_period_end: "2026-08-07T16:59:59.000Z", // Aug 7 in Bangkok
  granted_by: "payment",
}, frozenNow);
const canceledRetention = retentionState(canceledEndingSoon, frozenNow);
assert.equal(canceledRetention.cancellationScheduled, true);
assert.equal(canceledRetention.endsSoon, true);
assert.equal(canceledRetention.accessEndsAt, "2026-08-07T16:59:59.000Z");

const activeEndingLater = effectiveEntitlement({
  tier: "plus",
  status: "active",
  current_period_end: "2026-08-08T16:59:59.000Z", // Aug 8 in Bangkok
  granted_by: "payment",
}, frozenNow);
assert.equal(retentionState(activeEndingLater, frozenNow).endsSoon, false);
assert.deepEqual(retentionState(effectiveEntitlement(null, frozenNow), frozenNow), {
  accessEndsAt: null,
  endsSoon: false,
  cancellationScheduled: false,
});
assert.equal(retentionState({ ...canceledEndingSoon, periodEnd: "not-a-date" }, frozenNow).endsSoon, false);
assert.equal(
  retentionState(
    effectiveEntitlement({ tier: "plus", status: "active", current_period_end: "2026-08-03T16:59:59.000Z", granted_by: "payment" }, new Date("2026-08-02T16:30:00.000Z")),
    new Date("2026-08-02T16:30:00.000Z"),
  ).endsSoon,
  true,
);

const routeSource = readFileSync(new URL("../src/routes/entitlements.ts", import.meta.url), "utf8");
assert.match(routeSource, /entitlementsRouter\.get\("\/me", requireAuth/);
assert.match(routeSource, /retentionState\(entitlement\)/);
assert.match(routeSource, /res\.json\(\{ subscription: entitlement, retention, features/);
assert.doesNotMatch(routeSource.slice(routeSource.indexOf('entitlementsRouter.get("/me"'), routeSource.indexOf("// GET /api/entitlements/prompts")), /provider|order_id|bank/i);

const meterSource = readFileSync(new URL("../src/components/UsageMeter.tsx", import.meta.url), "utf8");
assert.match(meterSource, /limit <= 0/);
assert.match(meterSource, /Almost at your monthly limit\./);
assert.match(meterSource, /Monthly limit reached\./);
assert.match(meterSource, /role="progressbar"/);
assert.match(meterSource, /Math\.min\(100, Math\.max\(0/);

const membershipSource = readFileSync(new URL("../src/components/MembershipStatusCard.tsx", import.meta.url), "utf8");
assert.match(membershipSource, /Your plan ends on \$\{date\}/);
assert.match(membershipSource, /Your access ends on \$\{date\}/);
assert.match(membershipSource, /Current access through \$\{date\}/);
assert.match(membershipSource, /Core reading, progress, notes and milestones always stay yours\./);

console.log("ENTITLEMENT_FIXTURES_OK");
