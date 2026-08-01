import crypto from "crypto";
import { config } from "../config.js";

export type VietQrConfig = { enabled: boolean; bankBin: string; accountNumber: string; accountName: string; template: string; expiryMinutes: number };
export function vietQrConfig(): VietQrConfig {
  return {
    enabled: config.billingVietQrEnabled,
    bankBin: config.billingVietQrBankBin,
    accountNumber: config.billingVietQrAccountNumber,
    accountName: config.billingVietQrAccountName,
    template: config.billingVietQrTemplate,
    expiryMinutes: config.billingOrderExpiryMinutes,
  };
}
export function newTransferReference() { return `CHP-${crypto.randomBytes(6).toString("hex").toUpperCase()}`; }
export function vietQrUrl(input: Pick<VietQrConfig, "bankBin" | "accountNumber" | "accountName" | "template"> & { amountVnd: number; transferReference: string }): string {
  if (!/^\d{6}$/.test(input.bankBin) || !/^\d{6,24}$/.test(input.accountNumber) || !input.accountName.trim() || !input.template.trim()) throw new Error("VietQR billing is not configured");
  if (!Number.isInteger(input.amountVnd) || input.amountVnd <= 0 || !/^CHP-[A-F0-9]{12}$/.test(input.transferReference)) throw new Error("invalid VietQR payment order");
  const params = new URLSearchParams({ accountName: input.accountName, amount: String(input.amountVnd), addInfo: input.transferReference });
  return `https://api.vietqr.io/image/${input.bankBin}-${input.accountNumber}-${input.template}.jpg?${params.toString()}`;
}
export function vietQrFixtureCheck() {
  const url = vietQrUrl({ bankBin: "970422", accountNumber: "999917737", accountName: "TRUONG TUAN HUY", template: "IuPsscp", amountVnd: 59000, transferReference: "CHP-A1B2C3D4E5F6" });
  if (!url.startsWith("https://api.vietqr.io/image/970422-999917737-IuPsscp.jpg?") || !url.includes("amount=59000") || !url.includes("addInfo=CHP-A1B2C3D4E5F6")) throw new Error("VietQR URL fixture failed");
}
if (process.env.RUN_VIETQR_FIXTURE === "1") { vietQrFixtureCheck(); console.log("VIETQR_FIXTURES_OK"); }
