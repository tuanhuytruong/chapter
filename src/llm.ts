/**
 * 9router LLM client (OpenAI-compatible /v1/chat/completions) + response parser.
 *
 * When NINE_ROUTER_URL is unreachable (e.g. local dev without the 9router
 * service), we fall back to a deterministic mock so the pipeline can be
 * verified end-to-end. On e7240ubt, point NINE_ROUTER_URL at localhost:20128.
 */

// Shared process-local provider scheduler. It separates the provider's request-start
// rate from its in-flight capacity: starts are evenly paced (5/sec by default),
// while up to 30 calls may wait for a response. Reader-facing summaries always
// dispatch before retryable background analysis, and one active slot stays reserved.
function positiveEnv(name: string, fallback: number, upperBound: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.min(upperBound, Math.floor(value)) : fallback;
}

export const NINE_ROUTER_MAX_RPS = positiveEnv("NINE_ROUTER_MAX_RPS", 5, 100);
export const NINE_ROUTER_MAX_CONCURRENCY = positiveEnv("NINE_ROUTER_MAX_CONCURRENCY", 30, 100);
export const NINE_ROUTER_BACKGROUND_CONCURRENCY = NINE_ROUTER_MAX_CONCURRENCY > 1
  ? NINE_ROUTER_MAX_CONCURRENCY - 1
  : 1;
export const NINE_ROUTER_DISPATCH_INTERVAL_MS = Math.ceil(1_000 / NINE_ROUTER_MAX_RPS);
type LlmPriority = "interactive" | "background";
type Waiter = { resolve: () => void; priority: LlmPriority };
let activeNineRouterCalls = 0;
let activeBackgroundCalls = 0;
let nextDispatchAt = 0;
let dispatchTimer: ReturnType<typeof setTimeout> | undefined;
const interactiveWaiters: Waiter[] = [];
const backgroundWaiters: Waiter[] = [];

function drainNineRouterQueue(): void {
  if (dispatchTimer || activeNineRouterCalls >= NINE_ROUTER_MAX_CONCURRENCY) return;
  const waiter = interactiveWaiters[0]
    || (activeBackgroundCalls < NINE_ROUTER_BACKGROUND_CONCURRENCY ? backgroundWaiters[0] : undefined);
  if (!waiter) return;

  const delay = Math.max(0, nextDispatchAt - Date.now());
  if (delay > 0) {
    dispatchTimer = setTimeout(() => {
      dispatchTimer = undefined;
      drainNineRouterQueue();
    }, delay);
    return;
  }

  const next = interactiveWaiters.shift()
    || (activeBackgroundCalls < NINE_ROUTER_BACKGROUND_CONCURRENCY ? backgroundWaiters.shift() : undefined);
  if (!next) return;
  activeNineRouterCalls++;
  if (next.priority === "background") activeBackgroundCalls++;
  nextDispatchAt = Date.now() + NINE_ROUTER_DISPATCH_INTERVAL_MS;
  next.resolve();
  drainNineRouterQueue();
}

async function acquireNineRouterSlot(priority: LlmPriority): Promise<void> {
  await new Promise<void>((resolve) => {
    (priority === "interactive" ? interactiveWaiters : backgroundWaiters).push({ resolve, priority });
    drainNineRouterQueue();
  });
}

function releaseNineRouterSlot(priority: LlmPriority): void {
  activeNineRouterCalls--;
  if (priority === "background") activeBackgroundCalls--;
  drainNineRouterQueue();
}

/** Generic 9router call with arbitrary system + user prompts. Returns text. */
export async function callLLM(
  system: string,
  user: string,
  temperature = 0.7,
  strict = false,
  jsonMode = false,
  timeoutMs = Number(process.env.NINE_ROUTER_TIMEOUT_MS || 60_000),
  priority: LlmPriority = "background"
): Promise<string> {
  const url = process.env.NINE_ROUTER_URL;
  const model = process.env.NINE_ROUTER_MODEL || "qwen3";

  if (!url) {
    if (strict) throw new Error("NineRouter is not configured");
    console.warn("[llm] NINE_ROUTER_URL not set — using fallback");
    return "I appreciate your reflection! This is a fascinating perspective on the book. Thanks for sharing your reading journey with us!";
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiKey = process.env.NINE_ROUTER_API_KEY;
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resp: Response;
    const queuedAt = Date.now();
    await acquireNineRouterSlot(priority);
    const queueWaitMs = Date.now() - queuedAt;
    const boundedTimeoutMs = Number.isFinite(timeoutMs) ? Math.min(180_000, Math.max(5_000, timeoutMs)) : 60_000;
    timer = setTimeout(() => controller.abort(), boundedTimeoutMs);
    if (queueWaitMs > 250) console.info(`[llm] ${priority} slot wait ${queueWaitMs}ms`);
    try {
      resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      releaseNineRouterSlot(priority);
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`9router HTTP ${resp.status} ${body.slice(0, 200)}`);
    }
    const data = await resp.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("9router returned empty content");
    return text.trim();
  } catch (err: any) {
    console.error("[llm] generic call failed:", err.message, strict ? "— surfacing error" : "— using fallback");
    if (strict) throw err;
    return "I appreciate your reflection! This is a fascinating perspective on the book. Thanks for sharing your reading journey with us!";
  }
}

/** Strict JSON call used by persisted structured enrichments. */
export async function callJsonLLM(system: string, user: string, temperature = 0.2): Promise<string> {
  return callLLM(system, user, temperature, true, true);
}

export interface ParsedSummary {
  summary: string;
  key_insights: string[];
  quote: string | null;
}

export interface AdvanceLLMInput {
  title: string;
  author: string;
  start: number;
  end: number;
  total: number;
  extractedText: string;
  fileType?: "pdf" | "epub";
  lang?: "auto" | "vi" | "en";
  summaryMode?: "casual" | "deep_reading";
}

// Build the system prompt based on the requested summary language.
// - auto: respond in the same language as the book passage (detect from text)
// - vi:   always respond in Vietnamese
// - en:   always respond in English
function buildSystemPrompt(lang: "auto" | "vi" | "en" = "auto"): string {
  const base = `You are a thoughtful reading companion, helping the reader make sense of a passage they have just read. Given a passage from a book, produce:
1. A concise 3-5 sentence narrative summary
2. Exactly 3 key insights as bullet points
3. One memorable quote from the passage (if any)

Write the summary in a warm, natural, reflective voice — like a perceptive friend discussing what the passage means, not a textbook or academic report. Start directly with the core idea, tension, or shift in the passage. Explain what the author is getting at and why it can matter in everyday life. Prefer active, concrete sentences over neutral description.

Do NOT begin with or use report-like framing such as “Đoạn trích trình bày…”, “Tác giả nói về…”, “Phần này đề cập đến…”, “This passage discusses…”, or “The excerpt presents…”. Do not mention “the passage”, “the excerpt”, or “this section” as the subject of the summary.

Keep language clear and engaging. No spoilers beyond the given text.`;

  let langRule: string;
  if (lang === "vi") {
    langRule = "Respond entirely in Vietnamese (Tiếng Việt).";
  } else if (lang === "en") {
    langRule = "Respond entirely in English.";
  } else {
    langRule =
      "Respond in the SAME language as the book passage (auto-detect: if the passage is Vietnamese, answer in Vietnamese; if English, answer in English; otherwise match the passage's language).";
  }

  return `${base}
${langRule}

Format your response EXACTLY as:

## Summary
<your summary>

## Insights
- <insight 1>
- <insight 2>
- <insight 3>

## Quote
<the quote, or "N/A" if none>`;
}

function buildDeepReadingSystemPrompt(lang: "auto" | "vi" | "en" = "auto"): string {
  const language = lang === "vi"
    ? "Respond entirely in Vietnamese (Tiếng Việt)."
    : lang === "en"
      ? "Respond entirely in English."
      : "Respond in the SAME language as the provided reading text.";
  return `You are a rigorous, careful reading companion for academic and research-oriented books. Analyze ONLY the provided reading text. Never add outside facts, citations, evidence, or claims. Distinguish what is explicit from a reasonable inference. If the text does not establish a point, say \"Not established in this reading.\" Do not call a claim evidence unless the text itself provides support. For every Argument map entry, make the Example a concrete detail found in the reading; never invent one. Quotes must be verbatim from the reading text.

Write directly from the central idea. Never open with report-like framing such as \"Đoạn trích này...\", \"Đoạn trích lập luận...\", \"Tác giả nói về...\", \"Phần này đề cập đến...\", \"This passage...\", or \"The excerpt...\". Do not make the reading itself the grammatical subject; state the argument, tension, or explanation directly.

${language}

Format your response EXACTLY as:

## Core argument
<one concise paragraph explaining the central claim, explanation, or problem>

## Argument map
1. **Claim:** <grounded claim>
   - **Support:** <reasoning or evidence present, or "Not established in this reading.">
   - **Example:** <a concrete person, event, situation, comparison, or verbatim detail from the reading that makes the claim tangible. If none exists, write "Chưa có ví dụ cụ thể trong phần đọc này.">
   - **Implication:** <what follows if the claim holds>

## Assumptions & limits
- <assumption, scope, tension, or "Not established in this reading.">

## Key concepts
- **<concept>:** <short contextual definition>

## Questions to carry forward
- <one or two questions for the next reading>

## Insights
- <exactly 3 concise, durable insights suitable for spaced review>

## Quote
<one verbatim quote, or "N/A">`;
}

function buildUserPrompt(input: AdvanceLLMInput): string {
  const unit = input.fileType === "epub" ? "Reading chunks" : "Pages";
  return `Book: ${input.title} by ${input.author}
${unit} ${input.start}–${input.end} of ${input.total}:

${input.extractedText}`;
}

/** Call 9router. Returns raw assistant text. */
export async function callNineRouter(input: AdvanceLLMInput, strict = false): Promise<string> {
  const url = process.env.NINE_ROUTER_URL;
  const model = process.env.NINE_ROUTER_MODEL || "qwen3";

  if (!url) {
    if (strict) throw new Error("NineRouter is not configured");
    console.warn("[llm] NINE_ROUTER_URL not set — using mock");
    return mockResponse(input);
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiKey = process.env.NINE_ROUTER_API_KEY;
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const queuedAt = Date.now();
    await acquireNineRouterSlot("interactive");
    const queueWaitMs = Date.now() - queuedAt;
    const controller = new AbortController();
    const timeoutMs = Number(process.env.NINE_ROUTER_INTERACTIVE_TIMEOUT_MS || 25_000);
    const boundedTimeoutMs = Number.isFinite(timeoutMs) ? Math.min(55_000, Math.max(5_000, timeoutMs)) : 25_000;
    const timer = setTimeout(() => controller.abort(), boundedTimeoutMs);
    let resp: Response;
    try {
      if (queueWaitMs > 250) console.info(`[llm] interactive summary slot wait ${queueWaitMs}ms`);
      resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: input.summaryMode === "deep_reading" ? buildDeepReadingSystemPrompt(input.lang) : buildSystemPrompt(input.lang) },
            { role: "user", content: buildUserPrompt(input) },
          ],
          temperature: 0.7,
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      releaseNineRouterSlot("interactive");
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`9router HTTP ${resp.status} ${body.slice(0, 200)}`);
    }
    const data = await resp.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("9router returned empty content");
    return text;
  } catch (err: any) {
    console.error("[llm] 9router interactive summary failed:", err.message, strict ? "— surfacing error" : "— using mock");
    if (strict) throw err;
    return mockResponse(input);
  }
}

/** Parse the markdown-shaped LLM output into structured fields. */
export function parseSummary(raw: string, summaryMode: "casual" | "deep_reading" = "casual"): ParsedSummary {
  const result: ParsedSummary = { summary: "", key_insights: [], quote: null };
  const section = (name: string): string => {
    const re = new RegExp(`##\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s*|$)`, "i");
    return raw.match(re)?.[1]?.trim() || "";
  };

  const insightsRaw = section("Insights");
  if (summaryMode === "deep_reading") {
    const insightsStart = raw.search(/\n##\s*Insights\s*\n/i);
    result.summary = (insightsStart >= 0 ? raw.slice(0, insightsStart) : raw).trim();
  } else {
    result.summary = section("Summary");
  }
  if (insightsRaw) {
    result.key_insights = insightsRaw.split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, summaryMode === "deep_reading" ? 3 : 5);
  }
  const quoteRaw = section("Quote");
  if (quoteRaw && !/^n\/?a$/i.test(quoteRaw)) result.quote = quoteRaw.replace(/^["']|["']$/g, "");
  if (!result.summary && !result.key_insights.length) result.summary = raw.trim();
  return result;
}

/** Deterministic mock used when 9router is unavailable. */
function mockResponse(input: AdvanceLLMInput): string {
  const snippet = input.extractedText.slice(0, 180).replace(/\s+/g, " ").trim();
  const unit = input.fileType === "epub" ? "reading chunks" : "pages";
  if (input.summaryMode === "deep_reading") return `## Core argument
This reading develops a central claim and connects it to its immediate consequences. [mock Deep Reading — ${input.title}, ${unit} ${input.start}–${input.end}]

## Argument map
1. **Claim:** The text advances a practical proposition.
   - **Support:** The provided reading frames its reasoning directly.
   - **Implication:** The claim changes how the following material should be evaluated.

## Assumptions & limits
- Not established in this reading.

## Key concepts
- **Central proposition:** The main idea developed in the reading.

## Questions to carry forward
- What evidence will the next section add to this claim?

## Insights
- Claims should be separated from the evidence offered for them.
- Scope and assumptions shape how far a conclusion can travel.
- A useful reading question follows the argument into the next section.

## Quote
"${snippet.slice(0, 80)}…"`;
  return `## Summary
The ideas here point toward a practical shift in how we act and decide. What matters is not only understanding the principle, but noticing how it can shape small choices over time. [mock summary — 9router offline; ${input.title}, ${unit} ${input.start}–${input.end}]

## Insights
- Small consistent actions compound into meaningful long-term change.
- Environment design beats willpower for sustaining habits.
- Measurement creates awareness, which is the first step to improvement.

## Quote
"${snippet.slice(0, 80)}…"`;
}
