import { resolveSummaryOutputLanguage, validateSummaryOutputLanguage, type SummaryLanguageValidation } from "./llm.js";
import { extractJson } from "./llmJson.js";

export type ReadingLensAnalysis = {
  coreArgument: string;
  argumentMap: Array<{ claim: string; support: string; implication: string }>;
  assumptionsAndLimits: string[];
  keyConcepts: Array<{ term: string; definition: string }>;
  questionsToCarryForward: string[];
  durableInsights: string[];
  quote: string | null;
  confidenceNotes: string[];
};

const NOT_ESTABLISHED = "Not established in this reading.";
const MAX_TEXT = 900;
const clean = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) || fallback : fallback;
const list = (value: unknown, max: number): string[] =>
  Array.isArray(value) ? value.map((item) => clean(item)).filter(Boolean).slice(0, max) : [];

/** Parse untrusted model output into bounded, safe V1 Reading Lens data. */
export function parseReadingLensAnalysis(raw: string, sourceText: string): ReadingLensAnalysis {
  const data = extractJson(raw) as Record<string, unknown>;
  const confidenceNotes = list(data.confidenceNotes, 4);
  let quote = clean(data.quote) || null;
  if (quote && !sourceText.includes(quote)) {
    quote = null;
    confidenceNotes.push("A proposed quote was omitted because it was not found verbatim in this reading.");
  }
  const argumentMap = Array.isArray(data.argumentMap) ? data.argumentMap.slice(0, 4).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      claim: clean(row.claim, NOT_ESTABLISHED),
      support: clean(row.support, NOT_ESTABLISHED),
      implication: clean(row.implication, NOT_ESTABLISHED),
    };
  }) : [];
  const keyConcepts = Array.isArray(data.keyConcepts) ? data.keyConcepts.slice(0, 6).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { term: clean(row.term, "Concept"), definition: clean(row.definition, NOT_ESTABLISHED) };
  }) : [];
  return {
    coreArgument: clean(data.coreArgument, NOT_ESTABLISHED),
    argumentMap,
    assumptionsAndLimits: list(data.assumptionsAndLimits, 5),
    keyConcepts,
    questionsToCarryForward: list(data.questionsToCarryForward, 4),
    durableInsights: list(data.durableInsights, 3),
    quote,
    confidenceNotes: [...new Set(confidenceNotes)].slice(0, 4),
  };
}

export function readingLensSummary(analysis: ReadingLensAnalysis): string {
  return analysis.coreArgument.slice(0, 360);
}

export function readingLensLanguageValidation(
  analysis: ReadingLensAnalysis,
  lang: "vi" | "en",
): SummaryLanguageValidation {
  const prose = [
    analysis.coreArgument,
    ...analysis.argumentMap.flatMap((item) => [item.claim, item.support, item.implication]),
    ...analysis.assumptionsAndLimits,
    ...analysis.keyConcepts.flatMap((item) => [item.term, item.definition]),
    ...analysis.questionsToCarryForward,
    ...analysis.durableInsights,
    ...analysis.confidenceNotes,
  ].join("\n");
  return validateSummaryOutputLanguage(prose, lang);
}

export function buildReadingLensPrompt(input: { title: string; author: string; start: number; end: number; total: number; lang: "auto" | "vi" | "en"; sourceText: string }): { system: string; user: string; effectiveLang: "vi" | "en" } {
  const effectiveLang = resolveSummaryOutputLanguage(input.lang, input.sourceText);
  const language = effectiveLang === "vi" ? "Respond entirely in Vietnamese. Every non-quote JSON value must be Vietnamese." : "Respond entirely in English. Every non-quote JSON value must be English.";
  return {
    system: `You are Reading Lens, a careful private reading analyst. Analyze ONLY supplied text. Never add external facts, citations, page references, author intent, or unsupported quotes. Write coreArgument directly from the idea, tension, or mechanism — never begin with report-style lead-ins such as "Bài đọc lập luận rằng", "Đoạn trích cho thấy", "Tác giả nói rằng", "The reading argues", "This passage shows", or equivalent framing. If support is absent, use "${NOT_ESTABLISHED}". Return JSON only with exactly this shape: {"coreArgument":"","argumentMap":[{"claim":"","support":"","implication":""}],"assumptionsAndLimits":[""],"keyConcepts":[{"term":"","definition":""}],"questionsToCarryForward":[""],"durableInsights":[""],"quote":null,"confidenceNotes":[""]}. Keep lists concise: argumentMap max 4, assumptions max 5, concepts max 6, questions max 4, durableInsights max 3. A non-null quote must be copied verbatim from the supplied text. ${language}`,
    user: `Book: ${input.title} by ${input.author}\nReading range: ${input.start}–${input.end} of ${input.total}\n\nReading text:\n${input.sourceText}`,
    effectiveLang,
  };
}

export const READING_LENS_NOT_ESTABLISHED = NOT_ESTABLISHED;
