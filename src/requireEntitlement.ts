import { query } from "./db.js";
import { effectiveEntitlement, type FeatureKey } from "./entitlements.js";

/**
 * Phase-0 telemetry hook for generation boundaries. It deliberately does not
 * block requests or create quota events yet; Phase 1 switches each action to
 * reserveUsage() only after its public policy is approved.
 */
export async function observeEntitledGeneration(ownerId: string, feature: FeatureKey): Promise<void> {
  try {
    const subscription = (await query<any>(
      "SELECT tier,status,current_period_end,granted_by FROM subscriptions WHERE user_id=$1",
      [ownerId]
    )).rows[0];
    const entitlement = effectiveEntitlement(subscription);
    console.info(`[entitlement] observe feature=${feature} tier=${entitlement.tier} active=${entitlement.active}`);
  } catch (error: any) {
    // A telemetry problem must never interrupt a pre-Phase-1 reading flow.
    console.warn(`[entitlement] observe unavailable feature=${feature}: ${String(error?.message || "unknown").slice(0, 120)}`);
  }
}
