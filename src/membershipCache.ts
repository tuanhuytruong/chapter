import type {
  BillingCatalogResponse,
  EntitlementsResponse,
  MembershipPlansResponse,
} from "./api";

type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
};

const entries = new Map<string, CacheEntry<unknown>>();

function readCached<T>(key: string, staleTimeMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = entries.get(key) as CacheEntry<T> | undefined;
  if (entry?.value !== undefined && entry.expiresAt > now) return Promise.resolve(entry.value);
  if (entry?.inFlight) return entry.inFlight;

  const next: CacheEntry<T> = entry || { expiresAt: 0 };
  const inFlight = load()
    .then((value) => {
      next.value = value;
      next.expiresAt = Date.now() + staleTimeMs;
      next.inFlight = undefined;
      return value;
    })
    .catch((error) => {
      next.inFlight = undefined;
      if (next.value === undefined) entries.delete(key);
      throw error;
    });
  next.inFlight = inFlight;
  entries.set(key, next);
  return inFlight;
}

const ENTITLEMENTS_STALE_MS = 30_000;
const CATALOG_STALE_MS = 5 * 60_000;

export function getCachedEntitlements(userId: string, load: () => Promise<EntitlementsResponse>) {
  return readCached(`entitlements:${userId}`, ENTITLEMENTS_STALE_MS, load);
}

export function getCachedMembershipPlans(load: () => Promise<MembershipPlansResponse>) {
  return readCached("membership-plans", CATALOG_STALE_MS, load);
}

export function getCachedBillingCatalog(load: () => Promise<BillingCatalogResponse>) {
  return readCached("billing-catalog", CATALOG_STALE_MS, load);
}

export function invalidateCachedEntitlements(userId: string) {
  entries.delete(`entitlements:${userId}`);
}

export function clearMembershipCache() {
  entries.clear();
}

export const membershipCacheTestApi = {
  reset: clearMembershipCache,
  readCached,
};
