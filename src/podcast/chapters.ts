import { query } from "../db.js";

export type PodcastChapterMode = "headed" | "fallback";
export type PodcastChapterGroup = { chapter_key: string; chapter_title: string; chapter_number: number; start_unit: number; end_unit: number; start_page: number | null; end_page: number | null; char_count: number };

type RawGroup = Omit<PodcastChapterGroup, "chapter_title" | "chapter_number"> & { source_title: string | null };

export async function resolvePodcastChapters(bookId: string): Promise<{ mode: PodcastChapterMode; chapters: PodcastChapterGroup[] }> {
  const rows = (await query<RawGroup>(`SELECT chapter_key, min(title) AS source_title, min(unit_index)::int AS start_unit, max(unit_index)::int AS end_unit,
    min(page_label) AS start_page, max(page_label) AS end_page, sum(char_count)::int AS char_count
    FROM book_reading_units WHERE book_id=$1 AND chapter_key IS NOT NULL GROUP BY chapter_key ORDER BY min(unit_index)`, [bookId])).rows;
  const normalized = rows.map((row) => ({ ...row, source_title: row.source_title?.trim() || null }));
  const headed = normalized.filter((row) => Boolean(row.source_title));
  const mode: PodcastChapterMode = headed.length >= 2 || (normalized.length > 0 && headed.length / normalized.length >= 0.4) ? "headed" : "fallback";
  const selected = mode === "headed" ? headed : normalized;
  return { mode, chapters: selected.map((row, index) => ({
    chapter_key: row.chapter_key, chapter_title: mode === "headed" ? row.source_title! : `Section ${index + 1}`,
    chapter_number: index + 1, start_unit: row.start_unit, end_unit: row.end_unit,
    start_page: row.start_page, end_page: row.end_page, char_count: row.char_count,
  })) };
}

export async function resolvePodcastChapter(bookId: string, chapterKey: string) {
  const resolved = await resolvePodcastChapters(bookId);
  return { ...resolved, chapter: resolved.chapters.find((chapter) => chapter.chapter_key === chapterKey) || null };
}
