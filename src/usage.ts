import { withTransaction } from "./db.js";
import { type FeatureKey, type Tier, type EffectiveEntitlement, FeatureUnavailableError, QuotaExceededError, effectiveEntitlement, periodKeyInAppTz, quotaFor } from "./entitlements.js";

type Client = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };
export type UsageResource = { type?: string; id?: string };
export type UsageReservation = { id: string; feature: FeatureKey; periodKey: string; remaining: number | null; limit: number | "unlimited" };

async function lockedEntitlement(client: Client, userId: string): Promise<EffectiveEntitlement> {
  await client.query(`INSERT INTO subscriptions (user_id, tier, status, granted_by) VALUES ($1, 'free', 'expired', 'admin') ON CONFLICT (user_id) DO NOTHING`, [userId]);
  const result = await client.query("SELECT tier, status, current_period_end, granted_by FROM subscriptions WHERE user_id=$1 FOR UPDATE", [userId]);
  // Critical: result.rows[0] could be undefined if INSERT...ON CONFLICT didn't return a row
  return effectiveEntitlement(result.rows[0] || null);
}

export async function reserveUsage(input: { userId: string; feature: FeatureKey; requestKey: string; resource?: UsageResource }): Promise<UsageReservation> {
  if (!input.requestKey || input.requestKey.length > 160) throw new Error("a bounded request key is required");
  return withTransaction(async (client) => {
    const entitlement = await lockedEntitlement(client, input.userId);
    const limit = quotaFor(entitlement.tier, input.feature);
    if (!entitlement.active || limit === "unavailable") throw new FeatureUnavailableError(input.feature, entitlement.tier);
    const periodKey = periodKeyInAppTz();
    const existing = await client.query(
      "SELECT id FROM usage_events WHERE user_id=$1 AND feature_key=$2 AND period_key=$3 AND event_type IN ('reserved','consumed') AND request_key=$4 ORDER BY created_at ASC LIMIT 1",
      [input.userId, input.feature, periodKey, input.requestKey]
    );
    // Completed retries are idempotent too: `consumeUsage()` no-ops when the
    // returned event is already consumed, so a durable action never costs twice.
    if (existing.rows[0]) return { id: existing.rows[0].id, feature: input.feature, periodKey, limit, remaining: limit === "unlimited" ? null : Math.max(0, limit - 1) };
    if (limit !== "unlimited") {
      const count = await client.query(`SELECT COALESCE(SUM(quantity), 0)::int AS quantity FROM usage_events WHERE user_id=$1 AND feature_key=$2 AND period_key=$3 AND event_type IN ('reserved', 'consumed')`, [input.userId, input.feature, periodKey]);
      const used = Number(count.rows[0]?.quantity || 0);
      if (used >= limit) throw new QuotaExceededError(input.feature, entitlement.tier, used, limit, periodKey);
    }
    const inserted = await client.query(`INSERT INTO usage_events (user_id, feature_key, period_key, event_type, request_key, resource_type, resource_id) VALUES ($1,$2,$3,'reserved',$4,$5,$6) RETURNING id`, [input.userId, input.feature, periodKey, input.requestKey, input.resource?.type || null, input.resource?.id || null]);
    // Fix: apply Math.max(0, ...) consistently to prevent negative remaining
    return { id: inserted.rows[0].id, feature: input.feature, periodKey, limit, remaining: limit === "unlimited" ? null : Math.max(0, limit - 1) };
  });
}

export async function finalizeUsage(reservationId: string, eventType: "consumed" | "released", detail: Record<string, unknown> = {}): Promise<void> {
  await withTransaction(async (client) => {
    const reservation = await client.query("SELECT * FROM usage_events WHERE id=$1 AND event_type='reserved' FOR UPDATE", [reservationId]);
    if (!reservation.rows[0]) return;
    const row = reservation.rows[0];
    const duplicate = await client.query("SELECT 1 FROM usage_events WHERE user_id=$1 AND feature_key=$2 AND period_key=$3 AND event_type=$4 AND request_key=$5", [row.user_id, row.feature_key, row.period_key, eventType, row.request_key]);
    if (!duplicate.rows.length) await client.query(`INSERT INTO usage_events (user_id,feature_key,period_key,event_type,quantity,request_key,resource_type,resource_id,detail) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [row.user_id, row.feature_key, row.period_key, eventType, row.quantity, row.request_key, row.resource_type, row.resource_id, JSON.stringify(detail)]);
    await client.query("DELETE FROM usage_events WHERE id=$1", [reservationId]);
  });
}
export const consumeUsage = (reservationId: string) => finalizeUsage(reservationId, "consumed");
export const releaseUsage = (reservationId: string, reason: string) => finalizeUsage(reservationId, "released", { reason: reason.slice(0, 160) });

export async function usageSummary(userId: string): Promise<Record<string, { used: number; reserved: number }>> {
  return withTransaction(async (client) => {
    await lockedEntitlement(client, userId);
    const rows = await client.query(`SELECT feature_key, event_type, COALESCE(SUM(quantity),0)::int AS quantity FROM usage_events WHERE user_id=$1 AND period_key=$2 GROUP BY feature_key,event_type`, [userId, periodKeyInAppTz()]);
    const result: Record<string, { used: number; reserved: number }> = {};
    for (const row of rows.rows) { const entry = result[row.feature_key] ||= { used: 0, reserved: 0 }; if (row.event_type === "consumed") entry.used += Number(row.quantity); if (row.event_type === "reserved") entry.reserved += Number(row.quantity); }
    return result;
  });
}
