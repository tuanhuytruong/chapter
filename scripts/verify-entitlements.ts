import { entitlementFixtureCheck, effectiveEntitlement, featureKeys, periodKeyInAppTz } from "../src/entitlements.js";
entitlementFixtureCheck();
if (effectiveEntitlement({ tier: "plus", status: "active", current_period_end: "2999-01-01", granted_by: "admin" }).tier !== "plus") throw new Error("active grant failed");
if (featureKeys().length < 5) throw new Error("feature inventory unexpectedly incomplete");
if (periodKeyInAppTz(new Date("2026-01-31T18:00:00.000Z")) !== "2026-02") throw new Error("timezone boundary failed");
console.log("ENTITLEMENT_FIXTURES_OK");
