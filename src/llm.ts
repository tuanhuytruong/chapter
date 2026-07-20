/**
 * 9router LLM client (OpenAI-compatible /v1/chat/completions) + response parser.
 *
 * When NINE_ROUTER_URL is unreachable (e.g. local dev without the 9router
 * service), we fall back to a deterministic mock so the pipeline can be
 * verified end-to-end. On e7240ubt, point NINE_ROUTER_URL at localhost:20128.
 */

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
}

const SYSTEM_PROMPT = `You are a reading companion. Given a passage from a book, produce:
1. A concise 3-5 sentence narrative summary
2. Exactly 3 key insights as bullet points
3. One memorable quote from the passage (if any)
Keep language clear and engaging. No spoilers beyond the given text.

Format your response EXACTLY as:

## Summary
<your summary>

## Insights
- <insight 1>
- <insight 2>
- <insight 3>

## Quote
<the quote, or "N/A" if none>`;

function buildUserPrompt(input: AdvanceLLMInput): string {
  return `Book: ${input.title} by ${input.author}
Pages ${input.start}–${input.end} of ${input.total}:

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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
        temperature: 0.7,
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
  return `## Summary
This passage from ${input.title} (pages ${input.start}–${input.end}) explores key ideas through practical examples. The author builds on earlier concepts and sets up later developments. [mock summary — 9router offline]

## Insights
- Small consistent actions compound into meaningful long-term change.
- Environment design beats willpower for sustaining habits.
- Measurement creates awareness, which is the first step to improvement.

## Quote
"${snippet.slice(0, 80)}…" || null`;
}
