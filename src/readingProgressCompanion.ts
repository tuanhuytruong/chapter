import { extractJson } from "./llmJson.js";
import {
  resolveSummaryOutputLanguage,
  validateSummaryOutputLanguage,
} from "./llm.js";

export type ProgressSource = {
  logId: string;
  session: number;
  pageStart: number;
  pageEnd: number;
  text: string;
};
export type ProgressRef = Omit<ProgressSource, "text">;
export type ProgressItem = { text: string; refs: ProgressRef[]; status?: "open" | "evolving" | "resolved" };
export type ReadingProgressCompanion = {
  mainThread: ProgressItem;
  converging: ProgressItem[];
  openThreads: ProgressItem[];
  carryForward: ProgressItem[];
  outputLanguage: "vi" | "en";
};
export type ReadingProgressFacts = {
  facts: ProgressItem[];
  outputLanguage: "vi" | "en";
};

const clean = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";

function itemParser(sources: ProgressSource[], textMax: number) {
  const known = new Map(sources.map((source) => [source.logId, source]));
  return (value: any, required = false): ProgressItem | null => {
    const text = clean(value?.text, textMax);
    const refs = (Array.isArray(value?.refs) ? value.refs.slice(0, 3) : [])
      .map((ref: any) => {
        const source = known.get(ref?.logId);
        return source &&
          ref.session === source.session &&
          ref.pageStart === source.pageStart &&
          ref.pageEnd === source.pageEnd
          ? {
              logId: source.logId,
              session: source.session,
              pageStart: source.pageStart,
              pageEnd: source.pageEnd,
            }
          : null;
      })
      .filter(Boolean) as ProgressRef[];
    if (!text || !refs.length) {
      if (required) throw Error("missing cited required item");
      return null;
    }
    const status = value?.status;
    return status === "open" || status === "evolving" || status === "resolved" ? { text, refs, status } : { text, refs };
  };
}

function itemList(value: any, max: number, parse: (value: any) => ProgressItem | null) {
  return Array.isArray(value)
    ? (value.slice(0, max).map((item) => parse(item)).filter(Boolean) as ProgressItem[])
    : [];
}

export function buildReadingProgressFactsPrompt({
  source,
  language,
}: {
  source: ProgressSource;
  language: "vi" | "en";
}) {
  return `Return ONLY strict JSON in ${language}. You extract compact evidence for a private spoiler-safe reading-progress companion. Use ONLY this single SAVED READING TEXT. Never use outside knowledge, the book title/author, Reading Lens, BookWiki, Story Thread, prior artifacts, future chapters, predictions, unseen events, or unsupported author intent. Return 1-4 durable facts for a cumulative narrative map: developments, causal changes, relationships, stakes, themes, questions, or resolutions actually present in this source. Prefer what changed and why it matters, not isolated events. Every fact MUST have the exact supplied reference. Shape: {"facts":[{"text":"","refs":[{"logId":"${source.logId}","session":${source.session},"pageStart":${source.pageStart},"pageEnd":${source.pageEnd}}]}],"outputLanguage":"${language}"}. SOURCE: ${JSON.stringify(source)}`;
}

export function parseReadingProgressFacts(
  raw: string,
  source: ProgressSource,
  language: "vi" | "en",
): ReadingProgressFacts {
  const data = extractJson(raw) as any;
  // Response label is advisory; caller validates prose language.
  const parse = itemParser([source], 420);
  const facts = itemList(data?.facts, 4, parse);
  // Keep the incremental ledger complete when a provider returns empty but the
  // saved source is valid. The fallback is still verbatim-derived and exactly cited.
  const groundedFacts = facts.length ? facts : [{ text: `Reading session ${source.session} covers pages ${source.pageStart}-${source.pageEnd}.`, refs: [{ logId: source.logId, session: source.session, pageStart: source.pageStart, pageEnd: source.pageEnd }] }];
  return { facts: groundedFacts, outputLanguage: language };
}

export function buildReadingProgressPrompt({ facts, language, progressPct, sessionCount }: { facts: ProgressItem[]; language: "vi" | "en"; progressPct: number; sessionCount: number }) {
  const late = progressPct >= 75;
  const nearEnd = progressPct >= 90;
  return `Return ONLY strict JSON in ${language}. You are a private spoiler-safe cumulative reading NARRATIVE MAP. Use ONLY the cited FACT LEDGER from completed sessions. Never use outside knowledge, Reading Lens, BookWiki, Story Thread, title/author knowledge, prior prose, future chapters, predictions, unseen events, or unsupported author intent. Every item MUST have 1-3 exact refs copied from the FACT LEDGER. Shape: {"mainThread":{"text":"","refs":[]},"converging":[],"openThreads":[],"carryForward":[],"outputLanguage":"${language}"}. mainThread is required: state opening premise, important changes, and WHERE THINGS STAND in completed pages. converging contains 3-6 narrative arcs: each explains context, development or turning point, and current status—not isolated events. openThreads contains 1-5 status-aware threads. Set status exactly "open", "evolving", or "resolved"; never call a resolved situation open. carryForward contains 2-5 turning points: causal changes, stakes, or consequences. ${late ? "The reader is well into the book: be substantive. Select evidence spanning EARLY, MIDDLE, and LATEST completed portions whenever supplied. Do not concentrate citations only in opening sessions. " : ""}${nearEnd ? "The reader is near the end but has NOT finished: give useful current state without inventing or implying the ending. " : ""}The reader has completed ${sessionCount} sessions (${progressPct}% progress). FACT LEDGER IN READING ORDER: ${JSON.stringify(facts)}`;
}
export function parseReadingProgressCompanion(
  raw: string,
  sources: ProgressSource[],
  language: "vi" | "en",
): ReadingProgressCompanion {
  const data = extractJson(raw) as any;
  // Response label is advisory; caller validates prose language.
  const parse = itemParser(sources, 900);
  const mainThread = parse(data?.mainThread, true)!;
  return {
    mainThread,
    converging: itemList(data?.converging, 5, parse),
    openThreads: itemList(data?.openThreads, 4, parse),
    carryForward: itemList(data?.carryForward, 3, parse),
    outputLanguage: language,
  };
}

export function resolveReadingProgressLanguage(
  requested: "auto" | "vi" | "en" | undefined,
  sources: ProgressSource[],
): "vi" | "en" {
  return resolveSummaryOutputLanguage(
    requested,
    sources.map((source) => source.text).join("\n"),
  );
}

export function validateReadingProgressLanguage(
  raw: string,
  language: "vi" | "en",
) {
  const data = extractJson(raw) as any;
  const prose = [
    data?.mainThread?.text,
    ...(data?.facts || []).map((item: any) => item?.text),
    ...(data?.converging || []).map((item: any) => item?.text),
    ...(data?.openThreads || []).map((item: any) => item?.text),
    ...(data?.carryForward || []).map((item: any) => item?.text),
  ]
    .filter((text: unknown) => typeof text === "string")
    .join("\n");
  return validateSummaryOutputLanguage(prose, language);
}
