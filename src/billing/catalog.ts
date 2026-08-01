export type BillingSku = {
  id: "plus_monthly" | "plus_annual" | "deep_reader_monthly" | "deep_reader_annual";
  tier: "plus" | "deep_reader";
  period: "month" | "year";
  amountVnd: number;
  durationMonths: number;
  available: boolean;
};

export const BILLING_SKUS: readonly BillingSku[] = [
  { id: "plus_monthly", tier: "plus", period: "month", amountVnd: 59000, durationMonths: 1, available: true },
  { id: "plus_annual", tier: "plus", period: "year", amountVnd: 599000, durationMonths: 12, available: true },
  { id: "deep_reader_monthly", tier: "deep_reader", period: "month", amountVnd: 149000, durationMonths: 1, available: true },
  { id: "deep_reader_annual", tier: "deep_reader", period: "year", amountVnd: 1390000, durationMonths: 12, available: true },
];

export function billingSku(value: unknown): BillingSku | null {
  return typeof value === "string" ? BILLING_SKUS.find((sku) => sku.id === value) || null : null;
}

export function billingCatalog() {
  return BILLING_SKUS.map(({ id, tier, period, amountVnd, available }) => ({ id, tier, period, amountVnd, currency: "VND" as const, available }));
}

export function billingCatalogFixtureCheck() {
  if (!billingSku("plus_monthly") || billingSku("free") || billingSku({})) throw new Error("billing catalog validation failed");
  if (billingSku("deep_reader_annual")?.amountVnd !== 1390000) throw new Error("billing price fixture failed");
}
if (process.env.RUN_BILLING_CATALOG_FIXTURE === "1") { billingCatalogFixtureCheck(); console.log("BILLING_CATALOG_FIXTURES_OK"); }
