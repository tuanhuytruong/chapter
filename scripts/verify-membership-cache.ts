#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  clearMembershipCache,
  getCachedEntitlements,
  getCachedMembershipPlans,
  invalidateCachedEntitlements,
} from "../src/membershipCache";

const entitlement = (tier: "free" | "plus") => ({
  subscription: { tier, status: "active", active: true, source: "test", periodEnd: null },
  retention: { accessEndsAt: null, endsSoon: false, cancellationScheduled: false },
  features: {},
  policyVersion: 1,
});

async function main() {
  clearMembershipCache();
  let entitlementCalls = 0;
  const loadEntitlements = async () => {
    entitlementCalls += 1;
    await Promise.resolve();
    return entitlement("free");
  };

  const [header, account] = await Promise.all([
    getCachedEntitlements("reader-a", loadEntitlements),
    getCachedEntitlements("reader-a", loadEntitlements),
  ]);
  assert.equal(entitlementCalls, 1, "same reader must share one in-flight entitlement request");
  assert.equal(header.subscription.tier, "free");
  assert.equal(account.subscription.tier, "free");

  const readerB = await getCachedEntitlements("reader-b", async () => entitlement("plus"));
  assert.equal(readerB.subscription.tier, "plus", "reader B must not receive reader A cache");

  let refreshedCalls = 0;
  invalidateCachedEntitlements("reader-a");
  const refreshed = await getCachedEntitlements("reader-a", async () => {
    refreshedCalls += 1;
    return entitlement("plus");
  });
  assert.equal(refreshedCalls, 1, "verified invalidation must trigger a fresh read");
  assert.equal(refreshed.subscription.tier, "plus");

  let planCalls = 0;
  const planLoader = async () => {
    planCalls += 1;
    return { policyVersion: 1, checkoutAvailable: false as const, plans: [] };
  };
  await Promise.all([getCachedMembershipPlans(planLoader), getCachedMembershipPlans(planLoader)]);
  assert.equal(planCalls, 1, "membership catalog must share one in-flight request");

  clearMembershipCache();
  let afterLogoutCalls = 0;
  await getCachedEntitlements("reader-a", async () => {
    afterLogoutCalls += 1;
    return entitlement("free");
  });
  assert.equal(afterLogoutCalls, 1, "logout/account switch clear must prevent prior cache reuse");
  console.log("C4_MEMBERSHIP_CACHE_CONTRACT_OK");
}

void main();
