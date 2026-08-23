import fs from "node:fs";
import path from "node:path";
import { classifyWebClient } from "../src/userLifecycleTracking.js";

const cases = [
  ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36", ["web_android", "mobile", "chrome"]],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", ["web_ios", "mobile", "safari"]],
  ["Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", ["web_ios", "tablet", "safari"]],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36", ["web_desktop", "desktop", "chrome"]],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/127.0", ["web_desktop", "desktop", "firefox"]],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0", ["web_desktop", "desktop", "edge"]],
] as const;
for (const [ua, [client, deviceType, browser]] of cases) {
  const actual = classifyWebClient(ua);
  if (actual.client !== client || actual.deviceType !== deviceType || actual.browser !== browser) throw new Error(`classification failed: ${ua}`);
}
const root = path.resolve(import.meta.dirname, "..");
const server = fs.readFileSync(path.join(root, "server.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "src/db/schema.sql"), "utf8");
const tracking = fs.readFileSync(path.join(root, "src/userLifecycleTracking.ts"), "utf8");
for (const expected of ["user_login_events", "last_login_at", "last_seen_at", "last_active_at", "login_count"]) if (!schema.includes(expected)) throw new Error(`schema missing ${expected}`);
for (const expected of ["password_reset", "bestEffortRecordSuccessfulLogin", "bestEffortTouchLastSeen"]) if (!server.includes(expected)) throw new Error(`server missing ${expected}`);
if (tracking.includes("req.ip") || /INSERT INTO user_login_events[^`]*(user_agent|ip)/.test(tracking)) throw new Error("tracking must not persist raw IP or User-Agent");
console.log("USER_LIFECYCLE_TRACKING_OK");
