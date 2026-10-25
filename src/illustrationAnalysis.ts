import { readFile } from "node:fs/promises";
import { callLLM } from "./llm.js";
import { renderPdfPageToTempImage } from "./pdfIllustrationRenderer.js";

const MAX_ANALYSIS_CHARS = 1_500;
const MAX_PAGE_TEXT_CHARS = 12_000;
const SYSTEM = "You describe a single private book-page illustration. State only observable visual structure, labels and relationships; explain how it supports the supplied page text. Start with 'Source: page N'. State uncertainty when details are unreadable. No links, HTML, citations, or claims beyond this page.";

export function validateIllustrationAnalysis(raw: string, page: number): string {
  const text = raw.replace(/<[^>]*>|https?:\/\/\S+|\[[^\]]+\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_ANALYSIS_CHARS);
  if (!text || !new RegExp(`^Source:\\s*page\\s+${page}\\b`, "i").test(text)) throw new Error("illustration analysis was invalid");
  return text;
}

export async function analysePdfIllustration(input: { filePath: string; page: number; pageText: string }): Promise<string> {
  const image = await renderPdfPageToTempImage(input.filePath, input.page);
  try {
    const bytes = await readFile(image.path);
    const content = [
      { type: "text", text: `Page ${input.page} text (context only):\n${input.pageText.slice(0, MAX_PAGE_TEXT_CHARS)}` },
      { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${bytes.toString("base64")}` } },
    ];
    const raw = await callLLM(SYSTEM.replace("page N", `page ${input.page}`), content as any, 0.2, true, false, 45_000, { priority: "background", traceLabel: "illustration-analysis" });
    return validateIllustrationAnalysis(raw, input.page);
  } finally { await image.cleanup(); }
}
