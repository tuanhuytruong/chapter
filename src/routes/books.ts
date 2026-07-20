import { Router, Request, Response } from "express";
import { query, withClient } from "../db.js";
import { extractRange } from "../extractor.js";
import { callNineRouter, parseSummary } from "../llm.js";
import { getTelegramConfig, sendTelegramMessage, formatDailyMessage } from "../telegram.js";

export const booksRouter = Router();

const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ── Helpers ───────────────────────────────────────────────
function progressPct(b: any): number {
  if (!b.total_pages) return 0;
  return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
}

// ── B7: CRUD ──────────────────────────────────────────────
// GET /api/books — list all with computed progress (computed client-side)
booksRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const { rows } = await query(`SELECT * FROM books ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// POST /api/books — register a new book
booksRouter.post("/", async (req: Request, res: Response) => {
  const { title, author, file_path, file_type, total_pages, daily_pages, cover_url } = req.body;
  if (!title || !file_path || !file_type) {
    return res.status(400).json({ error: "title, file_path, file_type required" });
  }
  if (!["pdf", "epub"].includes(file_type)) {
    return res.status(400).json({ error: "file_type must be 'pdf' or 'epub'" });
  }
  try {
    const { rows } = await query(
      `INSERT INTO books (title, author, file_path, file_type, total_pages, daily_pages, cover_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, author || "Unknown", file_path, file_type, total_pages || 0, daily_pages || 20, cover_url || null]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// PATCH /api/books/:id — update settings
booksRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const fields = ["daily_pages", "status", "cover_url", "title", "author", "total_pages"];
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = $${i++}`);
      vals.push(req.body[f]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "no valid fields" });
  vals.push(id);
  try {
    const { rows } = await query(
      `UPDATE books SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: "book not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// DELETE /api/books/:id — remove book, keep reading_log (FK cascade only on book)
booksRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rowCount } = await query("DELETE FROM books WHERE id = $1", [id]);
    if (!rowCount) return res.status(404).json({ error: "book not found" });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// GET /api/books/:id/log — full history
booksRouter.get("/:id/log", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rows } = await query(
      "SELECT * FROM reading_log WHERE book_id = $1 ORDER BY date ASC",
      [id]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// ── B6: Advance all active (define BEFORE /:id/advance to avoid route clash) ──
// POST /api/books/all/advance
booksRouter.post("/all/advance", async (_req: Request, res: Response) => {
  try {
    const { rows: active } = await query("SELECT id FROM books WHERE status = 'active'");
    const results = [];
    for (const b of active) {
      try {
        const r = await advanceBook(b.id, false);
        if (r) results.push(r);
      } catch (e: any) {
        results.push({ bookId: b.id, error: e.message });
      }
    }
    res.json({ advanced: results.length, results });
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// ── B5: Core advance endpoint ─────────────────────────────
// POST /api/books/:id/advance
booksRouter.post("/:id/advance", async (req: Request, res: Response) => {
  const { id } = req.params;
  const force = req.query.force === "1" || req.body?.force === true;
  try {
    const result = await advanceBook(id, force);
    if (!result) return res.status(404).json({ error: "book not found or not active" });
    res.json(result);
  } catch (e: any) {
    console.error("[advance] error:", e);
    res.status(500).json({ error: "advance failed", detail: e.message });
  }
});

/** Core: extract next chunk, call LLM, persist. Idempotent per (book, date). */
async function advanceBook(bookId: string, force: boolean): Promise<any | null> {
  return withClient(async (client) => {
    const bRes = await client.query("SELECT * FROM books WHERE id = $1", [bookId]);
    const book = bRes.rows[0];
    if (!book) return null;
    if (book.status !== "active" && !force) return null;

    const dateStr = today();

    // Idempotency: skip if today's log already exists (unless forced)
    if (!force) {
      const exist = await client.query(
        "SELECT id FROM reading_log WHERE book_id=$1 AND date=$2",
        [bookId, dateStr]
      );
      if (exist.rows.length) {
        return { bookId, skipped: true, reason: "already advanced today" };
      }
    }

    const start = book.current_page + 1;
    const end = Math.min(book.current_page + book.daily_pages, book.total_pages || start + book.daily_pages);
    if (start > (book.total_pages || Infinity)) {
      return { bookId, skipped: true, reason: "book finished" };
    }

    const { text, totalUnits } = await extractRange(book.file_path, book.file_type, start, end);

    const raw = await callNineRouter({
      title: book.title,
      author: book.author,
      start,
      end,
      total: book.total_pages,
      extractedText: text,
    });
    const parsed = parseSummary(raw);

    // Update book cursor + status
    const newCurrent = end;
    const finished = newCurrent >= (book.total_pages || newCurrent);
    await client.query(
      `UPDATE books SET current_page=$1, status=CASE WHEN $2 THEN 'finished' ELSE status END WHERE id=$3`,
      [newCurrent, finished, bookId]
    );

    const ins = await client.query(
      `INSERT INTO reading_log (book_id, date, page_start, page_end, raw_text, summary, key_insights, quote)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (book_id, date) DO UPDATE SET
         page_start=EXCLUDED.page_start, page_end=EXCLUDED.page_end,
         raw_text=EXCLUDED.raw_text, summary=EXCLUDED.summary,
         key_insights=EXCLUDED.key_insights, quote=EXCLUDED.quote
       RETURNING *`,
      [bookId, dateStr, start, end, text, parsed.summary, parsed.key_insights, parsed.quote]
    );

    return {
      bookId,
      title: book.title,
      date: dateStr,
      pageStart: start,
      pageEnd: end,
      totalUnits,
      finished,
      log: ins.rows[0],
    };
  });
}

// ── Phase 3 prep: today's entry for a book (for n8n) ──────
// GET /api/books/:id/log/today
booksRouter.get("/:id/log/today", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rows } = await query(
      "SELECT * FROM reading_log WHERE book_id=$1 AND date=$2",
      [id, today()]
    );
    if (!rows.length) return res.status(404).json({ error: "no entry for today" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// POST /api/books/:id/retry/:date — re-generate summary for a specific day
booksRouter.post("/:id/retry/:date", async (req: Request, res: Response) => {
  const { id, date } = req.params;
  try {
    const logRes = await query(
      "SELECT * FROM reading_log WHERE book_id=$1 AND date=$2",
      [id, date]
    );
    const entry = logRes.rows[0];
    if (!entry) return res.status(404).json({ error: "log not found" });
    const bookRes = await query("SELECT * FROM books WHERE id=$1", [id]);
    const book = bookRes.rows[0];
    if (!book) return res.status(404).json({ error: "book not found" });

    const raw = await callNineRouter({
      title: book.title,
      author: book.author,
      start: entry.page_start,
      end: entry.page_end,
      total: book.total_pages,
      extractedText: entry.raw_text || "",
    });
    const parsed = parseSummary(raw);

    const { rows } = await query(
      `UPDATE reading_log SET summary=$1, key_insights=$2, quote=$3 WHERE id=$4 RETURNING *`,
      [parsed.summary, parsed.key_insights, parsed.quote, entry.id]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "retry failed", detail: e.message });
  }
});

// POST /api/books/all/notify — push today's logs to Telegram + mark sent.
// Called by n8n AFTER /all/advance. Returns per-book delivery status.
booksRouter.post("/all/notify", async (_req: Request, res: Response) => {
  const cfg = getTelegramConfig();
  if (!cfg) return res.status(500).json({ error: "Telegram not configured (TELEGRAM_BOT_TOKEN/CHAT_ID)" });
  try {
    const { rows: books } = await query(
      "SELECT * FROM books WHERE status='active'"
    );
    const results: any[] = [];
    for (const b of books) {
      const { rows } = await query(
        "SELECT * FROM reading_log WHERE book_id=$1 AND date=$2",
        [b.id, today()]
      );
      const log = rows[0];
      if (!log || !log.summary) {
        results.push({ book: b.title, delivered: false, reason: "no summary today" });
        continue;
      }
      const text = formatDailyMessage(b.title, b.author, log);
      const sent = await sendTelegramMessage(cfg, text);
      if (sent.ok) {
        await query("UPDATE reading_log SET telegram_sent=true WHERE id=$1", [log.id]);
        results.push({ book: b.title, delivered: true });
      } else {
        results.push({ book: b.title, delivered: false, error: sent.error });
      }
    }
    res.json({ delivered: results.filter((r) => r.delivered).length, results });
  } catch (e: any) {
    res.status(500).json({ error: "notify failed", detail: e.message });
  }
});

// GET /api/books/all/log/today — convenience for n8n: today's entries for all active books.
booksRouter.get("/all/log/today", async (_req: Request, res: Response) => {
  try {
    const { rows: books } = await query("SELECT * FROM books WHERE status='active'");
    const out: any[] = [];
    for (const b of books) {
      const { rows } = await query(
        "SELECT * FROM reading_log WHERE book_id=$1 AND date=$2",
        [b.id, today()]
      );
      if (rows[0]) out.push({ book: b, log: rows[0] });
    }
    res.json(out);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

