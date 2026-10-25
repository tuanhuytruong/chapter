import assert from "node:assert/strict";
import fs from "node:fs";
import { validateFeedbackInput } from "../src/feedback.js";

const valid = {
  kind: "bug", message: "The save button does not respond.", routePath: "/books/opaque-id",
  clientPlatform: "web_desktop", browserFamily: "chrome",
};
assert.equal(validateFeedbackInput(valid).ok, true);
assert.equal(validateFeedbackInput({ ...valid, message: "too short" }).ok, false);
assert.equal(validateFeedbackInput({ ...valid, routePath: "/books/x?token=secret" }).ok, false);
assert.equal(validateFeedbackInput({ ...valid, extra: "not allowed" }).ok, false);
assert.equal(validateFeedbackInput({ ...valid, kind: "unknown" }).ok, false);

const server = fs.readFileSync("server.ts", "utf8");
const feedbackPage = fs.readFileSync("src/pages/Feedback.tsx", "utf8");
const analytics = fs.readFileSync("src/analytics.ts", "utf8");
const telegram = fs.readFileSync("src/telegram.ts", "utf8");
assert.match(server, /app\.use\("\/api", requireAuth\);[\s\S]*app\.post\("\/api\/feedback"/);
assert.match(server, /INSERT INTO feedback \(owner_id, kind, message, route_path, client_platform, browser_family\)/);
assert.match(server, /void notifyFeedback/);
assert.doesNotMatch(server, /console\.(?:log|info)\([^\n]*parsed\.value\.message/);
assert.match(feedbackPage, /location\.pathname/);
assert.doesNotMatch(feedbackPage, /location\.(?:search|hash)/);
assert.match(analytics, /"feedback_submitted"/);
assert.match(telegram, /notifyFeedback/);
console.log("feedback verification passed");
