import { query } from "./db.js";
import type { ProgressItem } from "./readingProgressCompanion.js";

type FactRow = {
  book_id: string;
  reading_round: number;
  log_id: string;
  source_hash: string;
  facts: ProgressItem[];
  output_language: "vi" | "en";
};

export async function listReadingProgressFacts(bookId: string, round: number) {
  return (
    await query<FactRow>(
      `SELECT book_id,reading_round,log_id,source_hash,facts,output_language
       FROM reading_progress_companion_facts f JOIN reading_log l ON l.id=f.log_id
       WHERE f.book_id=$1 AND f.reading_round=$2
       ORDER BY l.date ASC,l.session ASC,l.id ASC`,
      [bookId, round],
    )
  ).rows;
}

export async function upsertReadingProgressFacts(
  bookId: string,
  round: number,
  logId: string,
  sourceHash: string,
  facts: ProgressItem[],
  outputLanguage: "vi" | "en",
) {
  return (
    await query<FactRow>(
      `INSERT INTO reading_progress_companion_facts(book_id,reading_round,log_id,source_hash,facts,output_language)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(book_id,reading_round,log_id) DO UPDATE SET
         source_hash=EXCLUDED.source_hash,facts=EXCLUDED.facts,
         output_language=EXCLUDED.output_language,generated_at=now()
       RETURNING book_id,reading_round,log_id,source_hash,facts,output_language`,
      [bookId, round, logId, sourceHash, JSON.stringify(facts), outputLanguage],
    )
  ).rows[0];
}
