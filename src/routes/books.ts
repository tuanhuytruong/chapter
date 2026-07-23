import { Router, Request, Response } from "express";
import { query, withTransaction } from "../db.js";
import { buildEpubReadingUnits, extractRange, getChapterTitle } from "../extractor.js";
import { callLLM, callNineRouter, parseSummary } from "../llm.js";
import { getTelegramConfig, sendTelegramMessage, formatDailyMessage } from "../telegram.js";
import { config } from "../config.js";
import { requireAuth, requireOwner, userFrom } from "../auth.js";
import { reviewOutcome } from "../review.js";
import fs from "fs";
import path from "path";

export const booksRouter = Router();
booksRouter.use(requireAuth);

async function ownerCanMutate(req: Request, res: Response, bookId: string): Promise<boolean> {
  const found = await query("SELECT owner_id FROM books WHERE id=$1", [bookId]);
  if (!found.rows.length) { res.status(404).json({ error: "book not found" }); return false; }
  return requireOwner(req, res, found.rows[0].owner_id);
}

// App timezone is Asia/Bangkok (UTC+7) — all "today" logic and daily-summary
// grouping use this, independent of where the server physically runs.
const APP_TZ = "Asia/Bangkok";
const today = () => {
  // Returns YYYY-MM-DD for the current date in Asia/Bangkok (UTC+7).
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TZ });
};

// ── Helpers ───────────────────────────────────────────────
function progressPct(b: any): number {
  if (!b.total_pages) return 0;
  return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
}

// Resolve a book file path. If the user supplies an absolute path (starts with
// "/") we keep it as-is (backward compatible). Otherwise we treat the value as
// a filename/relative path inside CHAPTER_BOOKS_DIR so the user only has to
// type e.g. "atomic-habits.pdf".
function resolveBookPath(input: string): string {
  const p = input.trim();
  if (p.startsWith("/")) return p;
  const dir = config.booksDir.replace(/\/+$/, "");
  return `${dir}/${p}`;
}

/** Build an EPUB map only once. Chunk indices are persisted and become the
 * stable progress cursor for all later sessions. */
async function ensureEpubReadingUnits(client: any, book: any): Promise<number> {
  const existing = await client.query(
    "SELECT count(*)::int AS count FROM book_reading_units WHERE book_id=$1",
    [book.id]
  );
  if (existing.rows[0].count > 0) return existing.rows[0].count;

  const units = await buildEpubReadingUnits(book.file_path);
  if (!units.length) throw new Error("EPUB has no readable text");
  for (const unit of units) {
    await client.query(
      `INSERT INTO book_reading_units (book_id, unit_index, title, raw_text, char_count)
       VALUES ($1,$2,$3,$4,$5)`,
      [book.id, unit.unitIndex, unit.title, unit.rawText, unit.rawText.length]
    );
  }
  await client.query("UPDATE books SET total_pages=$1 WHERE id=$2", [units.length, book.id]);
  return units.length;
}

// ── B7: CRUD ──────────────────────────────────────────────
// GET /api/books — list all with computed progress (computed client-side)
booksRouter.get("/", async (req: Request, res: Response) => {
  try {
    const scope = req.query.scope || "mine";
    if (scope !== "mine" && scope !== "all") return res.status(400).json({ error: "scope must be 'mine' or 'all'" });
    const { rows } = await query(
      `SELECT b.*, u.display_name AS owner_name, (b.owner_id = $1) AS can_edit
       FROM books b LEFT JOIN users u ON u.id=b.owner_id
       WHERE ($2 = 'all' OR b.owner_id = $1)
       ORDER BY u.display_name NULLS LAST, b.created_at DESC`,
      [userFrom(req).id, scope]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// GET /api/books/calendar?month=YYYY-MM&bookId=<optional UUID>
// Personal calendar rows are derived directly from reading_log; the parent book
// is the ownership boundary so no dependent owner_id is duplicated.
booksRouter.get("/calendar", async (req: Request, res: Response) => {
  const month = typeof req.query.month === "string" ? req.query.month : "";
  const bookId = typeof req.query.bookId === "string" ? req.query.bookId : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: "month must be YYYY-MM" });
  }
  try {
    const { rows } = await query(
      `SELECT rl.id, rl.book_id, rl.date, rl.session, rl.page_start, rl.page_end,
              rl.summary, rl.chapter_title, b.title, b.author,
              (rl.page_end - rl.page_start + 1) AS units_read
       FROM reading_log rl
       JOIN books b ON b.id=rl.book_id
       WHERE b.owner_id=$1
         AND rl.date >= ($2 || '-01')::date
         AND rl.date < (($2 || '-01')::date + INTERVAL '1 month')
         AND ($3 = '' OR rl.book_id::text = $3)
       ORDER BY rl.date ASC, rl.session ASC`,
      [userFrom(req).id, month, bookId]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "calendar unavailable", detail: e.message });
  }
});

// POST /api/books — register a new book
booksRouter.post("/", async (req: Request, res: Response) => {
  const { title, author, file_path, file_type, total_pages, daily_pages, cover_url, summary_lang, status } = req.body;
  if (!title || !file_path || !file_type) {
    return res.status(400).json({ error: "title, file_path, file_type required" });
  }
  if (!["pdf", "epub"].includes(file_type)) {
    return res.status(400).json({ error: "file_type must be 'pdf' or 'epub'" });
  }
  const lang = ["auto", "vi", "en"].includes(summary_lang) ? summary_lang : "auto";
  const initialStatus = status === "queued" ? "queued" : "active";
  const resolvedPath = resolveBookPath(file_path);
  try {
    const { rows } = await withTransaction(async (client) => {
      const queueOrder = initialStatus === "queued"
        ? Number((await client.query("SELECT COALESCE(MAX(queue_order), 0) + 1 AS next FROM books WHERE owner_id=$1 AND status='queued'", [userFrom(req).id])).rows[0].next)
        : null;
      return client.query(
        `INSERT INTO books (title, author, file_path, file_type, total_pages, daily_pages, cover_url, summary_lang, owner_id, status, queue_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [title, author || "Unknown", resolvedPath, file_type, total_pages || 0, daily_pages || 3, cover_url || null, lang, userFrom(req).id, initialStatus, queueOrder]
      );
    });
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// PUT /api/books/queue — replace the signed-in readers complete queue order.
// This static route must precede /:id so Express does not treat "queue" as an ID.
booksRouter.put("/queue", async (req: Request, res: Response) => {
  const orderedIds = req.body?.bookIds;
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) || new Set(orderedIds).size !== orderedIds.length) {
    return res.status(400).json({ error: "bookIds must be a unique UUID array" });
  }
  try {
    const rows = await withTransaction(async (client) => {
      const current = await client.query("SELECT id FROM books WHERE owner_id=$1 AND status='queued' ORDER BY queue_order NULLS LAST, created_at", [userFrom(req).id]);
      const existingIds = current.rows.map((row: any) => row.id);
      if (existingIds.length !== orderedIds.length || existingIds.some((id: string) => !orderedIds.includes(id))) {
        throw Object.assign(new Error("queue does not match your queued books"), { status: 409 });
      }
      for (const [index, id] of orderedIds.entries()) {
        await client.query("UPDATE books SET queue_order=$1 WHERE id=$2 AND owner_id=$3 AND status='queued'", [index + 1, id, userFrom(req).id]);
      }
      return (await client.query("SELECT * FROM books WHERE owner_id=$1 AND status='queued' ORDER BY queue_order", [userFrom(req).id])).rows;
    });
    res.json(rows);
  } catch (e: any) {
    res.status(e.status || 503).json({ error: e.message || "could not reorder queue" });
  }
});

// PATCH /api/books/:id — update settings
booksRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!await ownerCanMutate(req, res, id)) return;
  const fields = ["daily_pages", "status", "cover_url", "title", "author", "total_pages", "summary_lang"];
  if (req.body.status !== undefined && !["active", "paused", "finished", "queued"].includes(req.body.status)) {
    return res.status(400).json({ error: "invalid status" });
  }
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

// DELETE /api/books/:id — remove book + its reading_log (FK ON DELETE CASCADE)
// and delete the uploaded file from disk so nothing is left behind.
booksRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!await ownerCanMutate(req, res, id)) return;
  try {
    // Fetch the file path first so we can clean up the physical file.
    const found = await query("SELECT file_path FROM books WHERE id = $1", [id]);
    if (!found.rows.length) return res.status(404).json({ error: "book not found" });
    const filePath = found.rows[0].file_path as string;

    const { rowCount } = await query("DELETE FROM books WHERE id = $1", [id]);

    // Best-effort physical file cleanup (only inside the books dir).
    if (filePath) {
      try {
        const booksDir = config.booksDir;
        const abs = path.resolve(booksDir, path.basename(filePath));
        if (abs.startsWith(path.resolve(booksDir) + path.sep) || abs === path.resolve(booksDir, path.basename(filePath))) {
          if (fs.existsSync(abs)) fs.unlinkSync(abs);
        }
      } catch {
        // ignore file-delete errors — DB record is already gone
      }
    }

    res.json({ ok: true, deletedFile: filePath || null });
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// GET /api/books/:id — single book
booksRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rows } = await query(
      `SELECT b.*, u.display_name AS owner_name, (b.owner_id = $2) AS can_edit
       FROM books b LEFT JOIN users u ON u.id=b.owner_id WHERE b.id = $1`,
      [id, userFrom(req).id]
    );
    if (!rows.length) return res.status(404).json({ error: "book not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// GET /api/books/:id/log — full history
booksRouter.get("/:id/log", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rows } = await query(
      "SELECT * FROM reading_log WHERE book_id = $1 ORDER BY date DESC, session DESC",
      [id]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// ── B6: Advance all active (define BEFORE /:id/advance to avoid route clash) ──
// POST /api/books/all/advance
booksRouter.post("/all/advance", async (req: Request, res: Response) => {
  try {
    const { rows: active } = await query("SELECT id FROM books WHERE status = 'active' AND owner_id=$1", [userFrom(req).id]);
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
// POST /api/books/:id/reflection — generate and persist a finished-book reflection.
// Explicit user action keeps the final reading session responsive and allows retries.
booksRouter.post("/:id/reflection", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!await ownerCanMutate(req, res, id)) return;
  try {
    const book = (await query("SELECT * FROM books WHERE id=$1", [id])).rows[0];
    if (!book) return res.status(404).json({ error: "book not found" });
    if (book.status !== "finished") return res.status(409).json({ error: "finish the book before creating a reflection" });

    const { rows: logs } = await query(
      `SELECT date, session, summary, key_insights FROM reading_log
       WHERE book_id=$1 AND (summary IS NOT NULL OR cardinality(key_insights) > 0)
       ORDER BY date ASC, session ASC`, [id]
    );
    if (!logs.length) return res.status(400).json({ error: "no reading summaries available for reflection" });

    const journal = logs.map((log: any) => {
      const insights = (log.key_insights || []).map((item: string) => `- ${item}`).join("\n");
      return `Session ${log.date}${log.session > 1 ? ` (#${log.session})` : ""}\nSummary: ${log.summary || "—"}\nInsights:\n${insights || "—"}`;
    }).join("\n\n");
    // Bound context to keep a very long book within upstream limits, retaining its end.
    const boundedJournal = journal.length > 100_000 ? `${journal.slice(0, 20_000)}\n\n[earlier sessions omitted]\n\n${journal.slice(-80_000)}` : journal;
    const language = book.summary_lang === "vi" ? "Write entirely in Vietnamese." : book.summary_lang === "en" ? "Write entirely in English." : "Match the predominant language in the reading journal.";
    const reflection = await callLLM(
      "You are a thoughtful reading companion. Synthesize a completed reader's own journal; stay concrete and avoid inventing events, quotes, or claims not present in it.",
      `Create a warm, lasting end-of-book reflection for \"${book.title}\" by ${book.author}.\n\n${language}\n\nUse exactly these markdown sections:\n## What stayed with you\nA concise thesis about the journey.\n\n## Five insights to carry forward\nExactly five grounded bullets (use fewer only if the journal genuinely contains fewer distinct ideas).\n\n## A letter to your future self\nA short personal, practical letter.\n\nDo not call this a passage, excerpt, or report.\n\nReading journal:\n${boundedJournal}`,
      0.5
    );
    const { rows } = await query(
      "UPDATE books SET reflection_text=$1, reflection_at=now() WHERE id=$2 RETURNING reflection_text, reflection_at",
      [reflection, id]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "reflection failed", detail: e.message });
  }
});

// POST /api/books/:id/advance
booksRouter.post("/:id/advance", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!await ownerCanMutate(req, res, id)) return;
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

/** Core: extract next chunk, call LLM, persist. Supports multi-session. */
async function advanceBook(bookId: string, force: boolean): Promise<any | null> {
  return withTransaction(async (client) => {
    const bRes = await client.query("SELECT * FROM books WHERE id = $1", [bookId]);
    const book = bRes.rows[0];
    if (!book) return null;
    if (book.status !== "active" && !force) return null;

    const dateStr = today();

    // Find the last session for today (if any) — supports multi-session reading
    const lastSession = await client.query(
      `SELECT page_end, session FROM reading_log
       WHERE book_id=$1 AND date=$2
       ORDER BY session DESC LIMIT 1`,
      [bookId, dateStr]
    );

    const sessionNum = lastSession.rows.length ? lastSession.rows[0].session + 1 : 1;
    const start = lastSession.rows.length
      ? lastSession.rows[0].page_end + 1   // continue from last session's end
      : book.current_page + 1;             // first session: use book cursor

    let end: number;
    let text: string;
    let chapterTitle: string | null;
    let totalPages: number;

    if (book.file_type === "epub") {
      totalPages = await ensureEpubReadingUnits(client, book);
      if (start > totalPages) return { bookId, skipped: true, reason: "book finished" };
      end = Math.min(start + Math.max(1, book.daily_pages) - 1, totalPages);
      const { rows: units } = await client.query(
        `SELECT unit_index, title, raw_text FROM book_reading_units
         WHERE book_id=$1 AND unit_index BETWEEN $2 AND $3 ORDER BY unit_index`,
        [bookId, start, end]
      );
      if (!units.length) throw new Error("EPUB reading chunk not found");
      text = units.map((unit: any) => unit.raw_text).join("\n\n");
      chapterTitle = units.find((unit: any) => unit.title)?.title || null;
    } else {
      end = Math.min(start + book.daily_pages - 1, book.total_pages || start + book.daily_pages);
      if (start > (book.total_pages || Infinity)) return { bookId, skipped: true, reason: "book finished" };
      const extracted = await extractRange(book.file_path, book.file_type, start, end);
      text = extracted.text;
      totalPages = book.total_pages || extracted.totalUnits;
      chapterTitle = await getChapterTitle(book.file_path, book.file_type, start, end, text);
    }

    const raw = await callNineRouter({
      title: book.title,
      author: book.author,
      start,
      end,
      total: totalPages,
      extractedText: text,
      fileType: book.file_type,
      lang: (book.summary_lang as "auto" | "vi" | "en") || "auto",
    });
    const parsed = parseSummary(raw);

    // Update book cursor — always advances regardless of session count
    const newCurrent = end;
    const finished = newCurrent >= (totalPages || newCurrent);
    await client.query(
      `UPDATE books SET current_page=$1, total_pages=$2, status=CASE WHEN $3 THEN 'finished' ELSE status END WHERE id=$4`,
      [newCurrent, totalPages, finished, bookId]
    );

    const ins = await client.query(
      `INSERT INTO reading_log (book_id, date, session, page_start, page_end, raw_text, summary, key_insights, quote, chapter_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [bookId, dateStr, sessionNum, start, end, text, parsed.summary, parsed.key_insights, parsed.quote, chapterTitle]
    );

    // Seed only the insights produced by this new session. The source log/index
    // unique constraint makes this idempotent and deliberately avoids backfill.
    const firstDue = reviewOutcome(1, false, dateStr).dueDate;
    for (const [insightIndex, insight] of parsed.key_insights.entries()) {
      const trimmed = insight.trim();
      if (!trimmed) continue;
      await client.query(
        `INSERT INTO review_cards (book_id, log_id, insight_index, insight, due_date)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (log_id, insight_index) DO NOTHING`,
        [bookId, ins.rows[0].id, insightIndex, trimmed, firstDue]
      );
    }

    return {
      bookId,
      title: book.title,
      date: dateStr,
      session: sessionNum,
      pageStart: start,
      pageEnd: end,
      totalUnits: totalPages,
      finished,
      log: ins.rows[0],
    };
  });
}

// GET /api/books/:id/log/today — returns array of today's sessions (n8n compatibility)
booksRouter.get("/:id/log/today", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rows } = await query(
      "SELECT * FROM reading_log WHERE book_id=$1 AND date=$2 ORDER BY session ASC",
      [id, today()]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// POST /api/books/:id/logs/:logId/retry — regenerate exactly one session.
// UUID targeting is required because a book can have multiple sessions on a day.
booksRouter.post("/:id/logs/:logId/retry", async (req: Request, res: Response) => {
  const { id, logId } = req.params;
  if (!await ownerCanMutate(req, res, id)) return;
  try {
    const entry = (await query(
      "SELECT * FROM reading_log WHERE id=$1 AND book_id=$2", [logId, id]
    )).rows[0];
    if (!entry) return res.status(404).json({ error: "log not found" });
    if (!entry.raw_text) return res.status(400).json({ error: "session has no extracted text to retry" });
    const book = (await query("SELECT * FROM books WHERE id=$1", [id])).rows[0];
    if (!book) return res.status(404).json({ error: "book not found" });

    const raw = await callNineRouter({
      title: book.title,
      author: book.author,
      start: entry.page_start,
      end: entry.page_end,
      total: book.total_pages,
      extractedText: entry.raw_text,
      fileType: book.file_type,
      lang: book.summary_lang || "auto",
    });
    const parsed = parseSummary(raw);
    const { rows } = await query(
      `UPDATE reading_log SET summary=$1, key_insights=$2, quote=$3 WHERE id=$4 AND book_id=$5 RETURNING *`,
      [parsed.summary, parsed.key_insights, parsed.quote, logId, id]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "retry failed", detail: e.message });
  }
});

// PATCH /api/books/:id/logs/:logId — update personal notes on a log entry
booksRouter.patch("/:id/logs/:logId", async (req: Request, res: Response) => {
  const { id, logId } = req.params;
  if (!await ownerCanMutate(req, res, id)) return;
  const { notes } = req.body;
  if (notes === undefined) return res.status(400).json({ error: "notes field required" });
  try {
    const { rows } = await query(
      "UPDATE reading_log SET notes=$1 WHERE id=$2 AND book_id=$3 RETURNING *",
      [notes, logId, id]
    );
    if (!rows.length) return res.status(404).json({ error: "log not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

// POST /api/books/all/notify — push today's logs to Telegram + mark sent.
// Called by n8n AFTER /all/advance. Returns per-book delivery status.
booksRouter.post("/all/notify", async (req: Request, res: Response) => {
  const cfg = getTelegramConfig();
  if (!cfg) return res.status(500).json({ error: "Telegram bot is not configured" });
  try {
    const { rows: books } = await query(
      `SELECT b.*, u.telegram_chat_id
       FROM books b JOIN users u ON u.id=b.owner_id
       WHERE b.status='active' AND b.owner_id=$1`,
      [userFrom(req).id]
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
      if (!b.telegram_chat_id) {
        results.push({ book: b.title, delivered: false, reason: "Telegram chat ID not configured" });
        continue;
      }
      const text = formatDailyMessage(b.title, b.author, log);
      const sent = await sendTelegramMessage(cfg, b.telegram_chat_id, text);
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

// GET /api/books/all/log/today — convenience for n8n: today's sessions for all active books.
booksRouter.get("/all/log/today", async (req: Request, res: Response) => {
  try {
    const { rows: books } = await query("SELECT * FROM books WHERE status='active' AND owner_id=$1", [userFrom(req).id]);
    const out: any[] = [];
    for (const b of books) {
      const { rows } = await query(
        "SELECT * FROM reading_log WHERE book_id=$1 AND date=$2 ORDER BY session ASC",
        [b.id, today()]
      );
      if (rows.length) out.push({ book: b, logs: rows });
    }
    res.json(out);
  } catch (e: any) {
    res.status(503).json({ error: "DB unavailable", detail: e.message });
  }
});

