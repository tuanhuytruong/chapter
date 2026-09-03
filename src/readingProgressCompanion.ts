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
export type ProgressItem = { text: string; refs: ProgressRef[] };
export type ReadingProgressCompanion = {
  mainThread: ProgressItem;
  converging: ProgressItem[];
  openThreads: ProgressItem[];
  carryForward: ProgressItem[];
  outputLanguage: "vi" | "en";
};
const clean = (value: any, max: number) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
export function buildReadingProgressPrompt({
  sources,
  language,
}: {
  sources: ProgressSource[];
  language: "vi" | "en";
}) {
  return `Return ONLY strict JSON in ${language}. You are a private spoiler-safe reading-progress companion. Use ONLY the supplied SAVED READING TEXT. Never use outside knowledge, Reading Lens, BookWiki, Story Thread, prior artifact, future chapters, predictions, unseen events, or unsupported author intent. Every item MUST have 1–3 exact refs copied from supplied sources. Shape: {"mainThread":{"text":"","refs":[{"logId":"","session":0,"pageStart":0,"pageEnd":0}]},"converging":[],"openThreads":[],"carryForward":[],"outputLanguage":"${language}"}. mainThread required; converging max 5; openThreads max 4; carryForward max 3. SOURCES: ${JSON.stringify(sources)}`;
}
export function parseReadingProgressCompanion(
  raw: string,
  sources: ProgressSource[],
  language: "vi" | "en",
): ReadingProgressCompanion {
  const d = extractJson(raw) as any;
  if (d?.outputLanguage !== language) throw Error("invalid output language");
  const known = new Map(sources.map((s) => [s.logId, s]));
  const one = (v: any, required = false): ProgressItem | null => {
    const text = clean(v?.text, 900);
    const refs = (Array.isArray(v?.refs) ? v.refs.slice(0, 3) : [])
      .map((r: any) => {
        const s = known.get(r?.logId);
        return s &&
          r.session === s.session &&
          r.pageStart === s.pageStart &&
          r.pageEnd === s.pageEnd
          ? {
              logId: s.logId,
              session: s.session,
              pageStart: s.pageStart,
              pageEnd: s.pageEnd,
            }
          : null;
      })
      .filter(Boolean) as ProgressRef[];
    if (!text || !refs.length) {
      if (required) throw Error("missing cited required item");
      return null;
    }
    return { text, refs };
  };
  const list = (v: any, n: number) =>
    Array.isArray(v)
      ? (v
          .slice(0, n)
          .map((x) => one(x))
          .filter(Boolean) as ProgressItem[])
      : [];
  return {
    mainThread: one(d.mainThread, true)!,
    converging: list(d.converging, 5),
    openThreads: list(d.openThreads, 4),
    carryForward: list(d.carryForward, 3),
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
    ...(data?.converging || []).map((item: any) => item?.text),
    ...(data?.openThreads || []).map((item: any) => item?.text),
    ...(data?.carryForward || []).map((item: any) => item?.text),
  ]
    .filter((text: unknown) => typeof text === "string")
    .join("\n");
  return validateSummaryOutputLanguage(prose, language);
}
