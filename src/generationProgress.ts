import { query } from "./db.js";

export type GenerationKind = "read_now" | "podcast";
export type GenerationStatus = "queued" | "running" | "retrying" | "ready" | "failed" | "interrupted";
export type GenerationProgress = {
  jobId: string;
  attemptId: string;
  kind: GenerationKind;
  bookId: string;
  readingRound: number;
  resourceId: string | null;
  status: GenerationStatus;
  stage: string;
  percent: number;
  errorMessage: string | null;
  updatedAt: string;
};

function publicRow(row: any): GenerationProgress {
  return {
    jobId: row.job_id, attemptId: row.attempt_id, kind: row.kind, bookId: row.book_id,
    readingRound: row.reading_round, resourceId: row.resource_id, status: row.status,
    stage: row.stage, percent: Number(row.percent), errorMessage: row.error_message || null,
    updatedAt: row.updated_at,
  };
}

export async function startGeneration(input: { ownerId: string; bookId: string; readingRound: number; resourceId?: string | null; kind: GenerationKind; stage: string; percent?: number }): Promise<GenerationProgress> {
  const resourceId = input.resourceId || null;
  const existing = await query<any>(`SELECT * FROM generation_progress WHERE owner_id=$1 AND book_id=$2 AND reading_round=$3 AND kind=$4
    AND resource_id IS NOT DISTINCT FROM $5 AND status IN ('queued','running','retrying') ORDER BY updated_at DESC LIMIT 1`, [input.ownerId, input.bookId, input.readingRound, input.kind, resourceId]);
  if (existing.rows[0]) return publicRow(existing.rows[0]);
  const created = await query<any>(`INSERT INTO generation_progress (owner_id,book_id,reading_round,resource_id,kind,status,stage,percent)
    VALUES ($1,$2,$3,$4,$5,'running',$6,$7) RETURNING *`, [input.ownerId, input.bookId, input.readingRound, resourceId, input.kind, input.stage, Math.max(0, Math.min(100, Math.round(input.percent ?? 0)))]);
  return publicRow(created.rows[0]);
}

export async function updateGeneration(jobId: string, input: { status?: GenerationStatus; stage: string; percent: number; errorMessage?: string | null; terminal?: boolean }): Promise<void> {
  const percent = Math.max(0, Math.min(100, Math.round(input.percent)));
  await query(`UPDATE generation_progress SET status=COALESCE($2,status),stage=$3,
    percent=CASE WHEN $2='ready' THEN 100 ELSE GREATEST(percent,$4) END,error_message=$5,
    completed_at=CASE WHEN $6 THEN now() ELSE completed_at END,updated_at=now()
    WHERE job_id=$1 AND status NOT IN ('ready','failed','interrupted')`, [jobId, input.status || null, input.stage, percent, input.errorMessage || null, input.terminal === true]);
}

export async function getActiveGeneration(ownerId: string, bookId: string, readingRound?: number, jobId?: string, resourceId?: string | null): Promise<GenerationProgress | null> {
  const hasResourceFilter = resourceId !== undefined;
  const found = await query<any>(`SELECT * FROM generation_progress WHERE owner_id=$1 AND book_id=$2
    AND ($3::int IS NULL OR reading_round=$3) AND ($4::uuid IS NULL OR job_id=$4)
    AND (NOT $5::boolean OR resource_id=$6::uuid OR ($6::uuid IS NULL AND resource_id IS NULL))
    ORDER BY CASE WHEN status IN ('queued','running','retrying') THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`, [ownerId, bookId, readingRound ?? null, jobId ?? null, hasResourceFilter, resourceId ?? null]);
  return found.rows[0] ? publicRow(found.rows[0]) : null;
}
