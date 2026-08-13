import assert from "node:assert/strict";

const baseUrl = (process.env.CHAPTER_VERIFY_URL || `http://127.0.0.1:${process.env.PORT || "3001"}`).replace(/\/$/, "");

async function headers(path: string, extra: HeadersInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, { headers: extra, redirect: "manual" });
  return { status: response.status, headers: response.headers };
}

function has(value: string | null, expected: string) {
  return value?.toLowerCase().includes(expected.toLowerCase()) ?? false;
}

const health = await headers("/health");
assert.equal(health.status, 200, "health must remain public and healthy");
const document = await headers("/");
assert.equal(document.status, 200, "SPA document must load");
assert.ok(has(document.headers.get("cache-control"), "no-cache"), "SPA HTML must revalidate");
assert.ok(has(document.headers.get("content-security-policy"), "default-src 'self'"), "SPA must restrict content sources");
assert.ok(has(document.headers.get("content-security-policy"), "frame-ancestors 'none'"), "SPA must block framing");
assert.equal(document.headers.get("x-content-type-options"), "nosniff", "SPA must disable MIME sniffing");
assert.equal(document.headers.get("x-frame-options"), "DENY", "legacy clients must block framing");
assert.equal(document.headers.get("referrer-policy"), "strict-origin-when-cross-origin", "SPA must limit cross-origin referrers");
assert.ok(has(document.headers.get("permissions-policy"), "camera=()"), "SPA must deny unused browser capabilities");
const html = await (await fetch(`${baseUrl}/`)).text();
const asset = html.match(/(?:src|href)="(\/assets\/[^"?]+(?:\?[^\"]*)?)"/)?.[1];
assert.ok(asset, "built SPA HTML must reference a hashed asset");
const builtAsset = await headers(asset!);
assert.equal(builtAsset.status, 200, "built asset must load");
assert.ok(has(builtAsset.headers.get("cache-control"), "max-age=31536000"), "built assets must be long-lived cached");
assert.ok(has(builtAsset.headers.get("cache-control"), "immutable"), "built assets must be immutable");
const api = await headers("/api/auth/session");
assert.equal(api.status, 200, "anonymous session endpoint must remain usable");
assert.ok(has(api.headers.get("cache-control"), "no-store"), "session-dependent API must not be cached");
const compressed = await headers(asset!, { "accept-encoding": "gzip" });
assert.ok(has(compressed.headers.get("content-encoding"), "gzip") || has(compressed.headers.get("content-encoding"), "br"), "compressible built asset must be encoded when requested");
console.log("PLATFORM_HEADER_CONTRACT_OK", JSON.stringify({ baseUrl, asset }));
