export type LibrarySearchKind = "book" | "wiki" | "quote" | "note" | "reflection" | "story_session" | "story_memory";
export type SearchDocumentInput = { ownerId: string; bookId: string; readingRound?: number | null; logId?: string | null; kind: LibrarySearchKind; sourceKey: string; title: string; body: string; pageStart?: number | null; pageEnd?: number | null };
export type LibrarySearchResult = { kind: LibrarySearchKind; bookId: string; bookTitle: string; bookAuthor: string; readingRound: number | null; logId: string | null; pageStart: number | null; pageEnd: number | null; title: string; excerpt: string; rank: number };
const compact = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
export function normalizeLibrarySearchText(value: unknown): string { return compact(value, 10_000).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase(); }
export function buildSearchDocument(input: SearchDocumentInput): SearchDocumentInput | null { const title = compact(input.title, 220); const body = compact(input.body, 4_000); return title && body ? { ...input, title, body } : null; }
export function safeSearchExcerpt(value: unknown, query: string): string {
  const text = compact(value, 1_200);
  const normalizedQuery = normalizeLibrarySearchText(query);
  const at = normalizeLibrarySearchText(text).indexOf(normalizedQuery);
  if (at < 0 || at <= 80) return text.slice(0, 320);

  // Never start/end a result in the middle of a Vietnamese word. The normalized
  // match index is only used to choose the vicinity; display boundaries come
  // from the original text so accents stay intact.
  const desiredStart = Math.max(0, at - 72);
  const startBoundary = text.lastIndexOf(" ", desiredStart);
  const start = startBoundary >= 0 ? startBoundary + 1 : 0;
  const desiredEnd = Math.min(text.length, at + Math.max(normalizedQuery.length, 1) + 200);
  const endBoundary = text.indexOf(" ", desiredEnd);
  const end = endBoundary >= 0 ? endBoundary : text.length;
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
