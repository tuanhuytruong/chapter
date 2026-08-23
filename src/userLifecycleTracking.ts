import type { Request } from "express";
import { query, withTransaction } from "./db.js";

export type AuthMethod = "password" | "google" | "password_reset";
export type WebClient = "web_desktop" | "web_android" | "web_ios";
export type DeviceType = "desktop" | "mobile" | "tablet";
export type Browser = "chrome" | "safari" | "firefox" | "edge" | "other";
export type WebClientInfo = { client: WebClient; deviceType: DeviceType; browser: Browser };

export function classifyWebClient(userAgent?: string): WebClientInfo {
  const ua = userAgent || "";
  const iosTablet = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile\//i.test(ua));
  const isIos = iosTablet || /iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const browser: Browser = /Edg\//i.test(ua) ? "edge"
    : /Firefox\//i.test(ua) ? "firefox"
    : /Chrome\/|CriOS\//i.test(ua) ? "chrome"
    : /Safari\//i.test(ua) ? "safari" : "other";
  if (isAndroid) return { client: "web_android", deviceType: /Mobile/i.test(ua) ? "mobile" : "tablet", browser };
  if (isIos) return { client: "web_ios", deviceType: iosTablet ? "tablet" : "mobile", browser };
  return { client: "web_desktop", deviceType: "desktop", browser };
}

function isPwa(req: Request): boolean | null {
  return typeof req.body?.isPwa === "boolean" ? req.body.isPwa : null;
}

export async function recordSuccessfulLogin(userId: string, method: AuthMethod, req: Request): Promise<void> {
  const info = classifyWebClient(req.header("user-agent"));
  const pwa = isPwa(req);
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET last_login_at=now(), last_seen_at=now(), last_active_at=now(),
       last_login_client=$2, last_login_device_type=$3, last_login_browser=$4,
       login_count=login_count+1 WHERE id=$1`,
      [userId, info.client, info.deviceType, info.browser],
    );
    await client.query(
      `INSERT INTO user_login_events (user_id, auth_method, client, device_type, browser, is_pwa)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, method, info.client, info.deviceType, info.browser, pwa],
    );
  });
}

export async function touchLastSeen(userId: string): Promise<void> {
  await query(
    `UPDATE users SET last_seen_at=now() WHERE id=$1
     AND (last_seen_at IS NULL OR last_seen_at < now() - interval '30 minutes')`,
    [userId],
  );
}

export async function touchLastActive(userId: string): Promise<void> {
  await query("UPDATE users SET last_active_at=now(), last_seen_at=now() WHERE id=$1", [userId]);
}

function bestEffort(operation: string, userId: string, work: () => Promise<void>): void {
  void work().catch(() => console.error(`[lifecycle] ${operation} failed user_id=${userId}`));
}

export function bestEffortRecordSuccessfulLogin(userId: string, method: AuthMethod, req: Request): void {
  bestEffort("record-login", userId, () => recordSuccessfulLogin(userId, method, req));
}
export function bestEffortTouchLastSeen(userId: string): void { bestEffort("touch-seen", userId, () => touchLastSeen(userId)); }
export function bestEffortTouchLastActive(userId: string): void { bestEffort("touch-active", userId, () => touchLastActive(userId)); }
