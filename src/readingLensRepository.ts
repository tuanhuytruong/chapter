import { query } from "./db.js";
import type { ReadingLensAnalysis, ReadingLensRow } from "./types.js";
export type { ReadingLensRow };

export async function upsertReadingLensAnalysis(bookId: string, logId: string, analysis: ReadingLensAnalysis, analystSummary: string): Promise<ReadingLensRow> {
  const { rows } = await query<ReadingLensRow>(
    `INSERT INTO reading_lens_analyses (book_id, log_id, schema_version, analysis, analyst_summary)
     VALUES ($1,$2,1,$3::jsonb,$4)
     ON CONFLICT (log_id, schema_version) DO UPDATE SET analysis=EXCLUDED.analysis, analyst_summary=EXCLUDED.analyst_summary, generated_at=now()
     RETURNING *`, [bookId, logId, JSON.stringify(analysis), analystSummary]);
  return rows[0];
}

export async function getReadingLensAnalysisForLog(bookId: string, logId: string): Promise<ReadingLensRow | null> {
  const { rows } = await query<ReadingLensRow>("SELECT * FROM reading_lens_analyses WHERE book_id=$1 AND log_id=$2 AND schema_version=1", [bookId, logId]);
  return rows[0] || null;
}

export async function listReadingLensAnalyses(bookId: string, round?: number): Promise<ReadingLensRow[]> {
  const { rows } = await query<ReadingLensRow>(
    `SELECT rla.* FROM reading_lens_analyses rla JOIN reading_log rl ON rl.id=rla.log_id
     WHERE rla.book_id=$1 AND rla.schema_version=1${round ? " AND rl.reading_round=$2" : ""} ORDER BY rl.date ASC, rl.session ASC`, round ? [bookId, round] : [bookId]);
  return rows;
}
