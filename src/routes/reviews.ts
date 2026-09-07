import { Router, Request, Response } from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth, userFrom } from "../auth.js";
import {
  isReturnOutcome,
  normalizeReturnReflection,
  RETURN_TODAY_LIMIT,
  RETURNS_PAGE_LIMIT,
  returnOutcome,
  reviewOutcome,
} from "../review.js";

export const reviewsRouter = Router();
reviewsRouter.use(requireAuth);

const APP_TZ = "Asia/Bangkok";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: APP_TZ });
const returnSurfaceLimits = { today: RETURN_TODAY_LIMIT, page: RETURNS_PAGE_LIMIT } as const;
type ReturnSurface = keyof typeof returnSurfaceLimits;

const uuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;

// GET /api/reviews/returns?surface=today|page&bookId=… — a small, owner-scoped
// active-book Returns queue. Today is deliberately contextual: it only shows a
// return from the book the reader selected as their current read.
reviewsRouter.get("/returns", async (req: Request, res: Response) => {
  const surface = req.query.surface;
  if (surface !== "today" && surface !== "page") {
    return res.status(400).json({ error: "surface must be today or page" });
  }
  const bookId = req.query.bookId === undefined ? null : uuid(req.query.bookId);
  if (req.query.bookId !== undefined && !bookId) return res.status(400).json({ error: "bookId must be a UUID" });
  if (surface === "today" && !bookId) return res.status(400).json({ error: "bookId is required for today" });
  const limit = returnSurfaceLimits[surface as ReturnSurface];
  const bookFilter = bookId ? " AND rc.book_id=$3" : "";
  const params = bookId ? [userFrom(req).id, today(), bookId] : [userFrom(req).id, today()];
  try {
    const { rows } = await query(
      `SELECT rc.id, rc.book_id, rc.log_id, rc.insight_index, rc.insight,
              b.title, b.author, b.cover_url,
              rl.reading_round AS source_reading_round, rl.date AS source_date,
              rl.page_start AS source_page_start, rl.page_end AS source_page_end,
              latest.id AS latest_response_id, latest.outcome AS latest_outcome,
              latest.reflection AS latest_reflection, latest.responded_at AS latest_responded_at
       FROM review_cards rc
       JOIN books b ON b.id=rc.book_id
       JOIN reading_log rl ON rl.id=rc.log_id
       LEFT JOIN LATERAL (
         SELECT rr.id, rr.outcome, rr.reflection, rr.responded_at
         FROM return_responses rr
         WHERE rr.review_card_id=rc.id AND rr.owner_id=$1
         ORDER BY rr.responded_at DESC, rr.id DESC
         LIMIT 1
       ) latest ON true
       WHERE b.owner_id=$1 AND b.status='active' AND rc.due_date <= $2${bookFilter}
       ORDER BY rc.due_date ASC, rc.last_reviewed_at NULLS FIRST, rc.created_at ASC
       LIMIT ${limit}`,
      params,
    );
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "returns unavailable", detail: e.message });
  }
});

// GET /api/reviews/due/count — exact count of cards belonging only to the signed-in reader.
// This deliberately has no session-list limit and must stay before parameterized routes.
reviewsRouter.get("/due/count", async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count
       FROM review_cards rc
       JOIN books b ON b.id=rc.book_id
       WHERE b.owner_id=$1 AND rc.due_date <= $2`,
      [userFrom(req).id, today()]
    );
    res.json({ count: rows[0]?.count ?? 0 });
  } catch (e: any) {
    res.status(503).json({ error: "review count unavailable", detail: e.message });
  }
});

// GET /api/reviews/due/books — lightweight, owner-scoped choices for Review.
reviewsRouter.get("/due/books", async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT b.id, b.title, b.author, b.cover_url, COUNT(*)::int AS due_count
       FROM review_cards rc
       JOIN books b ON b.id=rc.book_id
       WHERE b.owner_id=$1 AND rc.due_date <= $2
       GROUP BY b.id, b.title, b.author, b.cover_url
       ORDER BY b.title ASC`,
      [userFrom(req).id, today()],
    );
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "review books unavailable", detail: e.message });
  }
});

// GET /api/reviews/due — cards belonging only to the signed-in reader.
reviewsRouter.get("/due", async (req: Request, res: Response) => {
  const bookId = req.query.bookId === undefined ? null : uuid(req.query.bookId);
  if (req.query.bookId !== undefined && !bookId)
    return res.status(400).json({ error: "bookId must be a UUID" });
  try {
    const params: unknown[] = [userFrom(req).id, today()];
    const bookFilter = bookId ? " AND rc.book_id=$3" : "";
    if (bookId) params.push(bookId);
    const { rows } = await query(
      `SELECT rc.id, rc.book_id, rc.log_id, rc.insight_index, rc.insight,
              rc.interval_days, rc.repetitions, rc.due_date, rc.last_reviewed_at,
              b.title, b.author, b.cover_url AS cover_url,
              rl.date AS source_date, rl.page_start AS source_page_start, rl.page_end AS source_page_end
       FROM review_cards rc
       JOIN books b ON b.id=rc.book_id
       JOIN reading_log rl ON rl.id=rc.log_id
       WHERE b.owner_id=$1 AND rc.due_date <= $2${bookFilter}
       ORDER BY rc.due_date ASC, rc.created_at ASC
       LIMIT 50`,
      params,
    );
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "review cards unavailable", detail: e.message });
  }
});

// POST /api/reviews/:id/return — atomically record an append-only Return response and reschedule its source card.
reviewsRouter.post("/:id/return", async (req: Request, res: Response) => {
  if (!uuid(req.params.id)) return res.status(400).json({ error: "review card id must be a UUID" });
  const outcome = req.body?.outcome;
  if (!isReturnOutcome(outcome)) return res.status(400).json({ error: "outcome must be still_true, changed, revisit, or dismissed" });

  let reflection: string | null;
  try {
    reflection = normalizeReturnReflection(req.body?.reflection);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const result = await withTransaction(async (client) => {
      const { rows: cards } = await client.query(
        `SELECT rc.id, rc.book_id, rc.log_id, rc.interval_days, rc.repetitions, b.status AS book_status
         FROM review_cards rc
         JOIN books b ON b.id=rc.book_id
         -- A Return consumes only the current due occurrence. With this predicate
         -- inside the locked transaction, a retry/double-click after the first
         -- reschedule sees no due card and cannot append a second response.
         WHERE rc.id=$1 AND b.owner_id=$2 AND rc.due_date <= $3
         FOR UPDATE OF rc, b`,
        [req.params.id, userFrom(req).id, today()],
      );
      const card = cards[0];
      if (!card) return null;
      if (card.book_status !== "active") return { paused: true };

      const schedule = returnOutcome(Number(card.interval_days), outcome, today());
      const { rows: responses } = await client.query(
        `INSERT INTO return_responses (review_card_id, owner_id, outcome, reflection)
         VALUES ($1, $2, $3, $4)
         RETURNING id, outcome, reflection, responded_at`,
        [card.id, userFrom(req).id, outcome, reflection],
      );
      const repetitions = schedule.repetitions === "reset"
        ? 0
        : schedule.repetitions === "advance"
          ? Number(card.repetitions) + 1
          : Number(card.repetitions);
      const { rows: updated } = await client.query(
        `UPDATE review_cards
         SET interval_days=$1, repetitions=$2, due_date=$3, last_reviewed_at=now()
         WHERE id=$4
         RETURNING id, book_id, log_id, insight_index, insight, interval_days, repetitions, due_date, last_reviewed_at`,
        [schedule.intervalDays, repetitions, schedule.dueDate, card.id],
      );
      return { card: updated[0], response: responses[0] };
    });
    if (!result) return res.status(404).json({ error: "review card not found" });
    if ("paused" in result) return res.status(409).json({ error: "returns are unavailable for inactive books" });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: "return response failed", detail: e.message });
  }
});

// POST /api/reviews/:id — score a revealed card. Ownership is enforced via book.
reviewsRouter.post("/:id", async (req: Request, res: Response) => {
  const remembered = req.body?.remembered;
  if (typeof remembered !== "boolean") return res.status(400).json({ error: "remembered must be a boolean" });

  try {
    const existing = (await query(
      `SELECT rc.id, rc.interval_days
       FROM review_cards rc JOIN books b ON b.id=rc.book_id
       WHERE rc.id=$1 AND b.owner_id=$2`,
      [req.params.id, userFrom(req).id]
    )).rows[0];
    if (!existing) return res.status(404).json({ error: "review card not found" });

    const schedule = reviewOutcome(Number(existing.interval_days), remembered, today());
    const { rows } = await query(
      `UPDATE review_cards
       SET interval_days=$1,
           repetitions=CASE WHEN $2 THEN repetitions+1 ELSE 0 END,
           due_date=$3,
           last_reviewed_at=now()
       WHERE id=$4
       RETURNING id, book_id, log_id, insight_index, insight, interval_days,
                 repetitions, due_date, last_reviewed_at`,
      [schedule.intervalDays, remembered, schedule.dueDate, existing.id]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "review update failed", detail: e.message });
  }
});
