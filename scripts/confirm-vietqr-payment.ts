import "dotenv/config";
import { confirmPaidOrder } from "../src/billing/service.js";
import { query } from "../src/db.js";

const values = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, value] = arg.split("=", 2); return [key.replace(/^--/, ""), value || ""]; }));
const orderId = values.order || "";
const amountVnd = Number(values.amount || 0);
const receiptReference = values["receipt-ref"] || "";
const confirmerUsername = values.confirmer || "";
if (!orderId || !Number.isInteger(amountVnd) || amountVnd <= 0 || !receiptReference || !confirmerUsername) {
  throw new Error("Usage: npx tsx scripts/confirm-vietqr-payment.ts --order=<uuid> --amount=<vnd> --receipt-ref=<bank-reference> --confirmer=<username>");
}
const confirmer = (await query<{ id: string }>("SELECT id FROM users WHERE username=$1", [confirmerUsername])).rows[0];
if (!confirmer) throw new Error("confirmer user not found");
// This command records a payment only after the operator independently matches it in MB banking.
const result = await confirmPaidOrder({ orderId, confirmerId: confirmer.id, receiptReference, amountVnd });
console.log(JSON.stringify({ status: result.status, orderId: result.order.id, tier: result.order.tier, amountVnd: result.order.amountVnd }));
