import assert from "node:assert/strict";

process.env.NINE_ROUTER_URL = "http://nine-router.test/v1/chat/completions";
process.env.NINE_ROUTER_MAX_RPS = "100";
process.env.NINE_ROUTER_INTERACTIVE_TIMEOUT_MS = "5000";

const { callLLM, callNineRouter, NINE_ROUTER_MAX_ATTEMPTS } = await import("../src/llm.js");

function response(status: number, content?: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status, headers: { "Content-Type": "application/json" } });
}

const originalFetch = globalThis.fetch;
try {
  assert.equal(NINE_ROUTER_MAX_ATTEMPTS, 3);

  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls < 3 ? response(200, "") : response(200, "Recovered output");
  };
  assert.equal(await callLLM("system", "user", 0.2, true), "Recovered output");
  assert.equal(calls, 3, "empty generic completions retry through attempt 3");

  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response(200, " ");
  };
  await assert.rejects(() => callLLM("system", "user", 0.2, true), /9router returned blank content/);
  assert.equal(calls, 3, "strict generic call fails only after three blank completions");

  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response(503, "unavailable");
  };
  await assert.rejects(() => callLLM("system", "user", 0.2, true), /9router HTTP 503/);
  assert.equal(calls, 3, "HTTP 5xx retries through attempt 3");

  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response(400, "bad request");
  };
  await assert.rejects(() => callLLM("system", "user", 0.2, true), /9router HTTP 400/);
  assert.equal(calls, 1, "HTTP 400 does not retry");

  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response(200, undefined);
  };
  const fallback = await callNineRouter({ title: "Test", author: "Author", start: 1, end: 1, total: 1, extractedText: "Example text." });
  assert.match(fallback, /mock summary — 9router offline/);
  assert.equal(calls, 3, "interactive summary retries through attempt 3 before fallback");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("NINE_ROUTER_RETRY_FIXTURES_OK");
