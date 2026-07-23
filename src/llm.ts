/**
 * 9router LLM client (OpenAI-compatible /v1/chat/completions) + response parser.
 *
 * When NINE_ROUTER_URL is unreachable (e.g. local dev without the 9router
 * service), we fall back to a deterministic mock so the pipeline can be
 * verified end-to-end. On e7240ubt, point NINE_ROUTER_URL at localhost:20128.
 */

/** Generic 9router call with arbitrary system + user prompts. Returns text. */
export async function callLLM(
  system: string,
  user: string,
  temperature = 0.7
): Promise<string> {
  const url = process.env.NINE_ROUTER_URL;
  const model = process.env.NINE_ROUTER_MODEL || "qwen3";

  if (!url) {
    console.warn("[llm] NINE_ROUTER_URL not set — using fallback");
    return "I appreciate your reflection! This is a fascinating perspective on the book. Thanks for sharing your reading journey with us!";
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiKey = process.env.NINE_ROUTER_API_KEY;
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

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
        stream: false,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`9router HTTP ${resp.status} ${body.slice(0, 200)}`);
    }
    const data = await resp.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("9router returned empty content");
    return text.trim();
  } catch (err: any) {
    console.error("[llm] generic call failed:", err.message, "— using fallback");
    return "I appreciate your reflection! This is a fascinating perspective on the book. Thanks for sharing your reading journey with us!";
  }
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

function buildUserPrompt(input: AdvanceLLMInput): string {
  const unit = input.fileType === "epub" ? "Reading chunks" : "Pages";
  return `Book: ${input.title} by ${input.author}
${unit} ${input.start}–${input.end} of ${input.total}:

${input.extractedText}`;
}

/** Call 9router. Returns raw assistant text. */
export async function callNineRouter(input: AdvanceLLMInput): Promise<string> {
  const url = process.env.NINE_ROUTER_URL;
  const model = process.env.NINE_ROUTER_MODEL || "qwen3";

  if (!url) {
    console.warn("[llm] NINE_ROUTER_URL not set — using mock");
    return mockResponse(input);
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiKey = process.env.NINE_ROUTER_API_KEY;
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(input.lang) },
          { role: "user", content: buildUserPrompt(input) },
        ],
        temperature: 0.7,
        stream: false,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`9router HTTP ${resp.status} ${body.slice(0, 200)}`);
    }
    const data = await resp.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("9router returned empty content");
    return text;
  } catch (err: any) {
    console.error("[llm] 9router call failed:", err.message, "— using mock");
    return mockResponse(input);
  }
}

/** Parse the markdown-shaped LLM output into structured fields. */
export function parseSummary(raw: string): ParsedSummary {
  const result: ParsedSummary = { summary: "", key_insights: [], quote: null };

  const section = (name: string): string => {
    const re = new RegExp(`##\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s*|$)`, "i");
    const m = raw.match(re);
    return m ? m[1].trim() : "";
  };

  const summaryRaw = section("Summary");
  if (summaryRaw) result.summary = summaryRaw;

  const insightsRaw = section("Insights");
  if (insightsRaw) {
    result.key_insights = insightsRaw
      .split("\n")
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  const quoteRaw = section("Quote");
  if (quoteRaw && !/^n\/?a$/i.test(quoteRaw)) {
    result.quote = quoteRaw.replace(/^["']|["']$/g, "");
  }

  // Fallback: if parsing yielded nothing, treat the whole blob as summary.
  if (!result.summary && !result.key_insights.length) {
    result.summary = raw.trim();
  }
  return result;
}

/** Deterministic mock used when 9router is unavailable. */
function mockResponse(input: AdvanceLLMInput): string {
  const snippet = input.extractedText.slice(0, 180).replace(/\s+/g, " ").trim();
  const unit = input.fileType === "epub" ? "reading chunks" : "pages";
  return `## Summary
The ideas here point toward a practical shift in how we act and decide. What matters is not only understanding the principle, but noticing how it can shape small choices over time. [mock summary — 9router offline; ${input.title}, ${unit} ${input.start}–${input.end}]

## Insights
- Small consistent actions compound into meaningful long-term change.
- Environment design beats willpower for sustaining habits.
- Measurement creates awareness, which is the first step to improvement.

## Quote
"${snippet.slice(0, 80)}…" || null`;
}
