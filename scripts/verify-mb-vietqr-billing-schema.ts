import { readFileSync } from "node:fs";

const sql = readFileSync("migrations/20260801_add_mb_vietqr_billing.sql", "utf8");
for (const token of [
  "CREATE TABLE IF NOT EXISTS chapter.billing_orders",
  "CREATE TABLE IF NOT EXISTS chapter.billing_confirmations",
  "CREATE TABLE IF NOT EXISTS chapter.billing_transactions",
  "UNIQUE(owner_id, request_key)",
  "UNIQUE(transfer_reference)",
  "UNIQUE(receipt_reference)",
  "billing_orders_pending_expiry_idx",
]) if (!sql.includes(token)) throw new Error(`Missing billing schema token: ${token}`);
if (/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER/i.test(sql)) throw new Error("Bootstrap-incompatible function or trigger found");
console.log("MB_VIETQR_BILLING_SCHEMA_FIXTURES_OK");
