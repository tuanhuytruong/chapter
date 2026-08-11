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
function positiveEnv(
  name: string,
  fallback: number,
  upperBound: number,
): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0
    ? Math.min(upperBound, Math.floor(value))
    : fallback;
}

export const NINE_ROUTER_MAX_RPS = positiveEnv("NINE_ROUTER_MAX_RPS", 5, 100);
export const NINE_ROUTER_MAX_CONCURRENCY = positiveEnv(
  "NINE_ROUTER_MAX_CONCURRENCY",
  30,
  100,
);
export const NINE_ROUTER_BACKGROUND_CONCURRENCY =
  NINE_ROUTER_MAX_CONCURRENCY > 1 ? NINE_ROUTER_MAX_CONCURRENCY - 1 : 1;
export const NINE_ROUTER_DISPATCH_INTERVAL_MS = Math.ceil(
  1_000 / NINE_ROUTER_MAX_RPS,
);
export const NINE_ROUTER_MAX_ATTEMPTS = 3;
const NINE_ROUTER_RETRY_DELAYS_MS = [300, 700] as const;
export type LlmPriority = "interactive" | "background";
type Waiter = { resolve: () => void; priority: LlmPriority };

/** One trace label per upstream call; never include book text or credentials. */
export interface LlmCallOptions {
  priority?: LlmPriority;
  traceLabel?: string;
  /** Optional feature-specific provider alias; defaults to NINE_ROUTER_MODEL. */
  model?: string;
  /** Internal retry counter; callers should not set this. */
  attempt?: number;
}
let activeNineRouterCalls = 0;
let activeBackgroundCalls = 0;
let nextDispatchAt = 0;
let dispatchTimer: ReturnType<typeof setTimeout> | undefined;
const interactiveWaiters: Waiter[] = [];
const backgroundWaiters: Waiter[] = [];

function drainNineRouterQueue(): void {
  if (dispatchTimer || activeNineRouterCalls >= NINE_ROUTER_MAX_CONCURRENCY)
    return;
  const waiter =
    interactiveWaiters[0] ||
    (activeBackgroundCalls < NINE_ROUTER_BACKGROUND_CONCURRENCY
      ? backgroundWaiters[0]
      : undefined);
  if (!waiter) return;

  const delay = Math.max(0, nextDispatchAt - Date.now());
  if (delay > 0) {
    dispatchTimer = setTimeout(() => {
      dispatchTimer = undefined;
      drainNineRouterQueue();
    }, delay);
    return;
  }

  const next =
    interactiveWaiters.shift() ||
    (activeBackgroundCalls < NINE_ROUTER_BACKGROUND_CONCURRENCY
      ? backgroundWaiters.shift()
      : undefined);
  if (!next) return;
  activeNineRouterCalls++;
  if (next.priority === "background") activeBackgroundCalls++;
  nextDispatchAt = Date.now() + NINE_ROUTER_DISPATCH_INTERVAL_MS;
  next.resolve();
  drainNineRouterQueue();
}

async function acquireNineRouterSlot(priority: LlmPriority): Promise<void> {
  await new Promise<void>((resolve) => {
    (priority === "interactive" ? interactiveWaiters : backgroundWaiters).push({
      resolve,
      priority,
    });
    drainNineRouterQueue();
  });
}

function releaseNineRouterSlot(priority: LlmPriority): void {
  activeNineRouterCalls--;
  if (priority === "background") activeBackgroundCalls--;
  drainNineRouterQueue();
}

class NineRouterHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "NineRouterHttpError";
  }
}

export class LlmOutputLanguageError extends Error {
  constructor(
    readonly requestedLang: "vi" | "en",
    readonly mismatch: string,
  ) {
    super(
      `LLM output did not satisfy required ${requestedLang === "vi" ? "Vietnamese" : "English"} language (${mismatch})`,
    );
    this.name = "LlmOutputLanguageError";
  }
}

export interface SummaryLanguageValidation {
  valid: boolean;
  mismatch?: "insufficient-prose" | "wrong-language";
}

/** Deterministic, conservative language check for explicitly requested summary languages. */
export function validateSummaryOutputLanguage(
  raw: string,
  requestedLang: "auto" | "vi" | "en" | undefined,
): SummaryLanguageValidation {
  if (requestedLang !== "vi" && requestedLang !== "en") return { valid: true };
  const withoutQuote = raw.replace(
    /^##\s*(?:Quote|Trích dẫn)\s*$[\s\S]*?(?=^##\s|$)/gim,
    " ",
  );
  const prose = withoutQuote
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?(?:\[[^\]]*\])?\([^)]*\)/g, " ")
    .replace(/[#*_>`~|\d]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = prose.match(/[A-Za-zÀ-ỹ]+/g) || [];
  if (words.length < 12)
    return { valid: false, mismatch: "insufficient-prose" };
  const lower = ` ${prose.toLocaleLowerCase("vi-VN")} `;
  const vietnameseTokens =
    /\b(và|của|là|trong|với|cho|được|không|những|một|này|từ|theo|khi|để|về|có|người|như|sự|đến|cần)\b/gu;
  const vietnameseEvidence =
    (lower.match(vietnameseTokens) || []).length +
    (
      prose.match(
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/giu,
      ) || []
    ).length;
  if (requestedLang === "vi")
    return vietnameseEvidence >= 3
      ? { valid: true }
      : { valid: false, mismatch: "wrong-language" };
  const englishEvidence = (
    lower.match(
      /\b(the|and|of|to|in|is|that|for|with|this|as|on|from|by|an|be|are|it|or)\b/g,
    ) || []
  ).length;
  return englishEvidence >= 3 && vietnameseEvidence < 3
    ? { valid: true }
    : { valid: false, mismatch: "wrong-language" };
}

function retryableNineRouterError(error: unknown): boolean {
  if (error instanceof NineRouterHttpError)
    return error.status === 429 || error.status >= 500;
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/^9router HTTP (\d{3})/)?.[1];
  return (
    message === "9router returned empty content" ||
    message === "9router returned blank content" ||
    status === "429" ||
    (status !== undefined && Number(status) >= 500) ||
    message.includes("aborted") ||
    message.includes("fetch failed") ||
    message.includes("network")
  );
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generic 9router call with arbitrary system + user prompts. Returns text. */
export async function callLLM(
  system: string,
  user: string,
  temperature = 0.7,
  strict = false,
  jsonMode = false,
  timeoutMs = Number(process.env.NINE_ROUTER_TIMEOUT_MS || 60_000),
  options: LlmCallOptions = {},
): Promise<string> {
  const priority = options.priority || "background";
  const trace = options.traceLabel ? ` [${options.traceLabel}]` : "";
  const url = process.env.NINE_ROUTER_URL;
  const model = options.model || process.env.NINE_ROUTER_MODEL || "qwen3";

  if (!url) {
    if (strict) throw new Error("NineRouter is not configured");
    console.warn("[llm] NINE_ROUTER_URL not set — using fallback");
    return "I appreciate your reflection! This is a fascinating perspective on the book. Thanks for sharing your reading journey with us!";
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const apiKey = process.env.NINE_ROUTER_API_KEY;
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const controller = new AbortController();
    const queuedAt = Date.now();
    await acquireNineRouterSlot(priority);
    const queueWaitMs = Date.now() - queuedAt;
    const boundedTimeoutMs = Number.isFinite(timeoutMs)
      ? Math.min(600_000, Math.max(5_000, timeoutMs))
      : 60_000;
    const startedAt = Date.now();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.warn(
        `[llm]${trace} timeout after ${boundedTimeoutMs}ms (queue=${queueWaitMs}ms, priority=${priority})`,
      );
      controller.abort();
    }, boundedTimeoutMs);
    if (queueWaitMs > 250)
      console.info(
        `[llm]${trace} ${priority} slot acquired after ${queueWaitMs}ms`,
      );
    console.info(
      `[llm]${trace} dispatch model=${model} json=${jsonMode} timeout=${boundedTimeoutMs}ms`,
    );
    try {
      const resp = await fetch(url, {
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
      const headersMs = Date.now() - startedAt;
      console.info(
        `[llm]${trace} response headers HTTP ${resp.status} after ${headersMs}ms`,
      );
      const body = await resp.text();
      const totalMs = Date.now() - startedAt;
      console.info(
        `[llm]${trace} response body received ${body.length} bytes after ${totalMs}ms`,
      );
      if (!resp.ok) throw new Error(`9router HTTP ${resp.status}`);
      let data: any;
      try {
        data = JSON.parse(body);
      } catch (parseError: any) {
        throw new Error(
          `9router response JSON parse failed after ${totalMs}ms: ${parseError.message}`,
        );
      }
      const text: string | undefined = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("9router returned empty content");
      if (!text.trim()) throw new Error("9router returned blank content");
      console.info(
        `[llm]${trace} assistant content extracted (${text.length} chars) after ${totalMs}ms`,
      );
      return text.trim();
    } catch (err: any) {
      const elapsedMs = Date.now() - startedAt;
      const reason = timedOut
        ? `timeout=${boundedTimeoutMs}ms`
        : "upstream/error";
      console.error(
        `[llm]${trace} failed at ${reason} after ${elapsedMs}ms: ${err.message}`,
      );
      throw err;
    } finally {
      clearTimeout(timer);
      releaseNineRouterSlot(priority);
    }
  } catch (err: any) {
    const attempt = options.attempt || 1;
    if (retryableNineRouterError(err) && attempt < NINE_ROUTER_MAX_ATTEMPTS) {
      const delayMs =
        NINE_ROUTER_RETRY_DELAYS_MS[attempt - 1] ||
        NINE_ROUTER_RETRY_DELAYS_MS.at(-1)!;
      console.warn(
        `[llm]${trace} attempt=${attempt}/${NINE_ROUTER_MAX_ATTEMPTS} failed (${err.message}); retrying in ${delayMs}ms`,
      );
      await pause(delayMs);
      return callLLM(system, user, temperature, strict, jsonMode, timeoutMs, {
        ...options,
        attempt: attempt + 1,
      });
    }
    console.error(
      "[llm] generic call failed:",
      err.message,
      strict ? "— surfacing error" : "— using fallback",
    );
    if (strict) throw err;
    return "I appreciate your reflection! This is a fascinating perspective on the book. Thanks for sharing your reading journey with us!";
  }
}

/** Strict JSON call used by persisted structured enrichments. */
export async function callJsonLLM(
  system: string,
  user: string,
  temperature = 0.2,
): Promise<string> {
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
<the quote, or "N/A" if none>

Bullet rules: every bullet line starts with a single "-" followed by a space. Never use "*" as a list marker. Bold labels are allowed inside a bullet as - **Label:** explanation — with no extra asterisks anywhere else.`;
}

export function buildDeepReadingSystemPrompt(
  lang: "auto" | "vi" | "en" = "auto",
): string {
  const vietnamese = lang === "vi";
  const languageContract = vietnamese
    ? "VIETNAMESE-ONLY CONTRACT: Write every heading, label, explanation, question, insight, and fallback text in Vietnamese. A verbatim quote from the reading is the only exception. Never translate Vietnamese source text into English. English or mixed-language output is invalid and must be regenerated."
    : lang === "en"
      ? "Write every heading, label, explanation, question, insight, and fallback text in English. A verbatim quote from the reading is the only exception."
      : "Respond in the predominant language of the provided reading text.";
  const unavailable = vietnamese
    ? "Chưa được xác lập trong phần đọc này."
    : "Not established in this reading.";
  const noExample = vietnamese
    ? "Chưa có ví dụ cụ thể trong phần đọc này."
    : "Not established in this reading.";
  const format = vietnamese
    ? `## Luận điểm cốt lõi
<một đoạn ngắn giải thích luận điểm, cách lý giải, hoặc vấn đề trung tâm>

## Bản đồ lập luận
1. **Luận điểm:** <luận điểm có căn cứ>
   - **Cơ sở:** <lý do hoặc bằng chứng trong phần đọc, hoặc "${unavailable}">
   - **Ví dụ:** <chi tiết cụ thể từ phần đọc; nếu không có, viết "${noExample}">
   - **Hàm ý:** <điều suy ra nếu luận điểm đúng>

## Giả định & giới hạn
- <giả định, phạm vi, căng thẳng, hoặc "${unavailable}">

## Khái niệm then chốt
- **<khái niệm>:** <định nghĩa ngắn theo ngữ cảnh>

## Câu hỏi cho phần đọc tiếp theo
- <một hoặc hai câu hỏi cho phần đọc tiếp theo>

## Ý chính
- <chính xác 3 ý ngắn, bền vững để ôn tập ngắt quãng>

## Trích dẫn
<một trích dẫn nguyên văn, hoặc "Không có">`
    : `## Core argument
<one concise paragraph explaining the central claim, explanation, or problem>

## Argument map
1. **Claim:** <grounded claim>
   - **Support:** <reasoning or evidence present, or "${unavailable}">
   - **Example:** <a concrete detail from the reading; if none exists, write "${noExample}">
   - **Implication:** <what follows if the claim holds>

## Assumptions & limits
- <assumption, scope, tension, or "${unavailable}">

## Key concepts
- **<concept>:** <short contextual definition>

## Questions to carry forward
- <one or two questions for the next reading>

## Insights
- <exactly 3 concise, durable insights suitable for spaced review>

## Quote
<one verbatim quote, or "N/A">`;
  return `${languageContract}

You are a rigorous, careful reading companion for academic and research-oriented books. Analyze ONLY the provided reading text. Never add outside facts, citations, evidence, or claims. Distinguish what is explicit from a reasonable inference. If the text does not establish a point, say "${unavailable}". Do not call a claim evidence unless the text itself provides support. Quotes must be verbatim from the reading text.

Write directly from the central idea. Never open with report-like framing such as "Đoạn trích này...", "Tác giả nói về...", "Phần này đề cập đến...", "This passage...", or "The excerpt...".

Format your response EXACTLY as:

${format}

Bullet rules: every bullet line starts with a single "-" followed by a space. Never use "*" as a list marker. Bold labels are allowed inside a bullet as - **Label:** explanation — with no extra asterisks anywhere else.

${languageContract}`;
}

function buildUserPrompt(input: AdvanceLLMInput): string {
  const unit = input.fileType === "epub" ? "Reading chunks" : "Pages";
  return `Book: ${input.title} by ${input.author}
${unit} ${input.start}–${input.end} of ${input.total}:

${input.extractedText}`;
}

/** Call 9router. Returns raw assistant text. */
export async function callNineRouter(
  input: AdvanceLLMInput,
  strict = false,
  attempt = 1,
  correctionAttempt = false,
): Promise<string> {
  const url = process.env.NINE_ROUTER_URL;
  const model = process.env.NINE_ROUTER_MODEL || "qwen3";

  if (!url) {
    if (strict) throw new Error("NineRouter is not configured");
    console.warn("[llm] NINE_ROUTER_URL not set — using mock");
    return mockResponse(input);
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const apiKey = process.env.NINE_ROUTER_API_KEY;
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const queuedAt = Date.now();
    await acquireNineRouterSlot("interactive");
    const queueWaitMs = Date.now() - queuedAt;
    const controller = new AbortController();
    const timeoutMs = Number(
      process.env.NINE_ROUTER_INTERACTIVE_TIMEOUT_MS || 25_000,
    );
    const boundedTimeoutMs = Number.isFinite(timeoutMs)
      ? Math.min(55_000, Math.max(5_000, timeoutMs))
      : 25_000;
    const timer = setTimeout(() => controller.abort(), boundedTimeoutMs);
    try {
      if (queueWaitMs > 250)
        console.info(`[llm] interactive summary slot wait ${queueWaitMs}ms`);
      console.info(
        `[llm] interactive summary dispatch attempt=${attempt}/${NINE_ROUTER_MAX_ATTEMPTS} model=${model}`,
      );
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                input.summaryMode === "deep_reading"
                  ? buildDeepReadingSystemPrompt(input.lang)
                  : buildSystemPrompt(input.lang),
            },
            {
              role: "user",
              content: correctionAttempt
                ? `${buildUserPrompt(input)}\n\nYour previous response had the wrong language. Regenerate the entire response in the required language and exact format; do not explain the correction.`
                : buildUserPrompt(input),
            },
          ],
          temperature: correctionAttempt ? 0.2 : 0.7,
          stream: false,
        }),
        signal: controller.signal,
      });
      const body = await resp.text();
      if (!resp.ok) throw new Error(`9router HTTP ${resp.status}`);
      let data: any;
      try {
        data = JSON.parse(body);
      } catch (parseError: any) {
        throw new Error(
          `9router response JSON parse failed: ${parseError.message}`,
        );
      }
      const text: string | undefined = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("9router returned empty content");
      if (!text.trim()) throw new Error("9router returned blank content");
      const output = text.trim();
      if (input.summaryMode === "deep_reading") {
        const validation = validateSummaryOutputLanguage(output, input.lang);
        if (!validation.valid) {
          console.warn(
            `[llm] interactive summary language mismatch attempt=${correctionAttempt ? 2 : 1}/2 lang=${input.lang} category=${validation.mismatch}`,
          );
          throw new LlmOutputLanguageError(
            input.lang as "vi" | "en",
            validation.mismatch!,
          );
        }
      }
      return output;
    } finally {
      clearTimeout(timer);
      releaseNineRouterSlot("interactive");
    }
  } catch (err: any) {
    if (err instanceof LlmOutputLanguageError) {
      if (!correctionAttempt) {
        console.warn(
          `[llm] interactive summary requesting one language correction lang=${err.requestedLang} category=${err.mismatch}`,
        );
        return callNineRouter(input, strict, attempt, true);
      }
      throw err;
    }
    if (retryableNineRouterError(err) && attempt < NINE_ROUTER_MAX_ATTEMPTS) {
      const delayMs =
        NINE_ROUTER_RETRY_DELAYS_MS[attempt - 1] ||
        NINE_ROUTER_RETRY_DELAYS_MS.at(-1)!;
      console.warn(
        `[llm] interactive summary attempt=${attempt}/${NINE_ROUTER_MAX_ATTEMPTS} failed (${err.message}); retrying in ${delayMs}ms`,
      );
      await pause(delayMs);
      return callNineRouter(input, strict, attempt + 1);
    }
    console.error(
      "[llm] 9router interactive summary failed:",
      err.message,
      strict ? "— surfacing error" : "— using mock",
    );
    if (strict || err instanceof LlmOutputLanguageError) throw err;
    return mockResponse(input);
  }
}

/** Parse the markdown-shaped LLM output into structured fields. */
export function parseSummary(
  raw: string,
  summaryMode: "casual" | "deep_reading" = "casual",
): ParsedSummary {
  const result: ParsedSummary = { summary: "", key_insights: [], quote: null };
  const section = (name: string): string => {
    const re = new RegExp(
      `##\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s*|$)`,
      "i",
    );
    return raw.match(re)?.[1]?.trim() || "";
  };

  const insightsRaw = section(
    summaryMode === "deep_reading" ? "(?:Insights|Ý chính)" : "Insights",
  );
  if (summaryMode === "deep_reading") {
    const insightsStart = raw.search(/\n##\s*(?:Insights|Ý chính)\s*\n/i);
    result.summary = (
      insightsStart >= 0 ? raw.slice(0, insightsStart) : raw
    ).trim();
  } else {
    result.summary = section("Summary");
  }
  if (insightsRaw) {
    result.key_insights = insightsRaw
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, summaryMode === "deep_reading" ? 3 : 5);
  }
  const quoteRaw = section(
    summaryMode === "deep_reading" ? "(?:Quote|Trích dẫn)" : "Quote",
  );
  if (quoteRaw && !/^(?:n\/?a|không có)$/i.test(quoteRaw))
    result.quote = quoteRaw.replace(/^["']|["']$/g, "");
  if (!result.summary && !result.key_insights.length)
    result.summary = raw.trim();
  return result;
}

/** Deterministic mock used when 9router is unavailable. */
function mockResponse(input: AdvanceLLMInput): string {
  const snippet = input.extractedText.slice(0, 180).replace(/\s+/g, " ").trim();
  const unit = input.fileType === "epub" ? "reading chunks" : "pages";
  if (input.summaryMode === "deep_reading" && input.lang === "vi")
    return `## Luận điểm cốt lõi
Phần đọc này phát triển một luận điểm trung tâm và kết nối nó với các hệ quả trực tiếp. [mô phỏng Deep Reading — ${input.title}, ${unit} ${input.start}–${input.end}]

## Bản đồ lập luận
1. **Luận điểm:** Văn bản nêu một đề xuất thực tiễn.
   - **Cơ sở:** Phần đọc trình bày lý lẽ trực tiếp.
   - **Ví dụ:** Chưa có ví dụ cụ thể trong phần đọc này.
   - **Hàm ý:** Luận điểm thay đổi cách đánh giá phần tài liệu tiếp theo.

## Giả định & giới hạn
- Chưa được xác lập trong phần đọc này.

## Khái niệm then chốt
- **Luận điểm trung tâm:** Ý tưởng chính được phát triển trong phần đọc.

## Câu hỏi cho phần đọc tiếp theo
- Phần tiếp theo sẽ bổ sung bằng chứng nào cho luận điểm này?

## Ý chính
- Cần phân biệt luận điểm với bằng chứng được đưa ra.
- Phạm vi và giả định quyết định mức độ áp dụng của kết luận.
- Một câu hỏi hữu ích theo dõi lập luận sang phần tiếp theo.

## Trích dẫn
"${snippet.slice(0, 80)}…"`;
  if (input.summaryMode === "deep_reading")
    return `## Core argument
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
