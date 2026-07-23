import { Router, Request, Response } from "express";
import { query } from "../db.js";
import { requireAuth, userFrom } from "../auth.js";
import { reviewOutcome } from "../review.js";

export const reviewsRouter = Router();
reviewsRouter.use(requireAuth);

const APP_TZ = "Asia/Bangkok";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: APP_TZ });

// GET /api/reviews/due — cards belonging only to the signed-in reader.
reviewsRouter.get("/due", async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT rc.id, rc.book_id, rc.log_id, rc.insight_index, rc.insight,
              rc.interval_days, rc.repetitions, rc.due_date, rc.last_reviewed_at,
              b.title, b.author
       FROM review_cards rc
       JOIN books b ON b.id=rc.book_id
       WHERE b.owner_id=$1 AND rc.due_date <= $2
       ORDER BY rc.due_date ASC, rc.created_at ASC
       LIMIT 50`,
      [userFrom(req).id, today()]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "review cards unavailable", detail: e.message });
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

    const outcome = reviewOutcome(Number(existing.interval_days), remembered, today());
    const { rows } = await query(
      `UPDATE review_cards
       SET interval_days=$1,
           repetitions=CASE WHEN $2 THEN repetitions+1 ELSE 0 END,
           due_date=$3,
           last_reviewed_at=now()
       WHERE id=$4
       RETURNING id, book_id, log_id, insight_index, insight, interval_days,
                 repetitions, due_date, last_reviewed_at`,
      [outcome.intervalDays, remembered, outcome.dueDate, existing.id]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "review update failed", detail: e.message });
  }
});
