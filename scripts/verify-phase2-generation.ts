import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.NINE_ROUTER_URL = "http://nine-router.test/v1/chat/completions";
process.env.NINE_ROUTER_MAX_RPS = "100";
process.env.NINE_ROUTER_RETRY_BASE_MS = "1";
process.env.NINE_ROUTER_RETRY_MAX_MS = "10";
process.env.NINE_ROUTER_BACKGROUND_CIRCUIT_FAILURES = "3";
process.env.NINE_ROUTER_BACKGROUND_CIRCUIT_COOLDOWN_MS = "60000";

const { callLLM, NineRouterBackgroundCircuitOpenError } = await import("../src/llm.js");

function response(status: number, content?: string, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? response(429, undefined, { "Retry-After": "0" })
      : response(200, "Recovered output");
  };
  assert.equal(
    await callLLM("system", "user", 0.2, true, false, undefined, {
      priority: "background",
    }),
    "Recovered output",
  );
  assert.equal(calls, 2, "Retry-After retry reaches the provider again");

  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response(503, "unavailable");
  };
  for (let failure = 0; failure < 3; failure++) {
    await assert.rejects(
      () => callLLM("system", "user", 0.2, true, false, undefined, { priority: "background" }),
      /9router HTTP 503/,
    );
  }
  assert.equal(calls, 9, "each terminal background failure uses the bounded retry budget");
  await assert.rejects(
    () => callLLM("system", "user", 0.2, true, false, undefined, { priority: "background" }),
    NineRouterBackgroundCircuitOpenError,
  );
  assert.equal(calls, 9, "open background circuit does not dispatch another provider request");

  globalThis.fetch = async () => {
    calls++;
    return response(200, "Interactive output");
  };
  assert.equal(
    await callLLM("system", "user", 0.2, true, false, undefined, {
      priority: "interactive",
    }),
    "Interactive output",
  );
  assert.equal(calls, 10, "interactive work bypasses the background-only circuit");
} finally {
  globalThis.fetch = originalFetch;
}

const llmSource = readFileSync(new URL("../src/llm.ts", import.meta.url), "utf8");
assert.match(llmSource, /retryAfterMs\(resp\.headers\.get\("retry-after"\)\)/);
assert.match(llmSource, /NINE_ROUTER_RETRY_BASE_MS \* 2 \*\* \(attempt - 1\)/);
assert.match(llmSource, /Math\.random\(\) \* \(exponential \+ 1\)/);
assert.match(llmSource, /if \(priority !== "background"\) return;/);
assert.ok(
  llmSource.indexOf("await acquireNineRouterSlot(priority)") < llmSource.lastIndexOf("assertBackgroundCircuitAvailable(priority)"),
  "background circuit is rechecked after scheduler admission",
);
assert.match(llmSource, /releaseNineRouterSlot\(priority\);\s*throw error;/);
const routes = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
const regenerate = routes.slice(
  routes.indexOf('"/:id/wiki/regenerate"'),
  routes.indexOf('// GET /api/books/:id — single book'),
);
assert.match(regenerate, /SELECT status FROM books WHERE id=\$1 FOR UPDATE/);
assert.match(regenerate, /if \(book\.rows\[0\]\.status !== "active"\)/);
assert.match(regenerate, /claim\.kind === "duplicate"[\s\S]*status\(202\)[\s\S]*duplicate: true/);
assert.ok(
  regenerate.indexOf("const claim = await withTransaction") < regenerate.indexOf("await observeEntitledGeneration"),
  "only a newly claimed regeneration observes entitlement usage",
);
console.log("PHASE2_GENERATION_FIXTURES_OK");
