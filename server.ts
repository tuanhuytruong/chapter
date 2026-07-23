import express, { Request, Response } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import bcrypt from "bcrypt";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { CommunityPost, Comment } from "./src/types.js";
import { booksRouter } from "./src/routes/books.js";
import { reviewsRouter } from "./src/routes/reviews.js";
import { uploadRouter } from "./src/routes/upload.js";
import { ensureSchema, query, verifyCoreSchema } from "./src/db.js";
import { callLLM } from "./src/llm.js";
import { avatarFor, requireAuth, userFrom } from "./src/auth.js";
import { getPool } from "./src/db.js";
import { dateInAppTz, progressFor, type WeeklyGoalMetric, type WeeklyGoalRow } from "./src/weekly-goal.js";

// Ensure the port is 3000
const PORT = 3000;

const app = express();
// Production deployments terminate TLS at the reverse proxy. Trust that single
// proxy so express-session can issue its secure cookie from X-Forwarded-Proto.
app.set("trust proxy", 1);
app.use(express.json());
// Public liveness probe: intentionally does not require a session or database query.
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
const PgStore = pgSession(session);
app.use(session({
  store: process.env.DATABASE_URL ? new PgStore({ pool: getPool(), schemaName: "chapter", tableName: "session" }) : undefined,
  secret: process.env.SESSION_SECRET || "development-only-session-secret",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 60 * 60 * 1000 },
}));

app.get("/api/auth/session", (req, res) => res.json({ user: req.session.user || null }));
app.get("/api/auth/me", (req, res) => res.json({ user: req.session.user || null }));
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });
  try {
    const result = await query("SELECT id, username, display_name, avatar_url, password_hash FROM users WHERE username=$1", [username]);
    const row = result.rows[0];
    if (!row || !await bcrypt.compare(password, row.password_hash)) return res.status(401).json({ error: "Invalid username or password" });
    req.session.user = { id: row.id, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url || avatarFor(row.username) };
    res.json({ user: req.session.user });
  } catch (e: any) {
    res.status(503).json({ error: "Authentication service unavailable", detail: e.message });
  }
});
app.post("/api/auth/logout", (req, res) => req.session.destroy(() => res.status(204).end()));
app.use("/api", requireAuth);
app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "currentPassword and a newPassword of at least 8 characters are required" });
  }
  try {
    const user = (await query("SELECT password_hash FROM users WHERE id=$1", [userFrom(req).id])).rows[0];
    if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    await query("UPDATE users SET password_hash=$1 WHERE id=$2", [await bcrypt.hash(newPassword, 12), userFrom(req).id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "Failed to change password", detail: e.message }); }
});
app.put("/api/auth/telegram", async (req: Request, res: Response) => {
  const chatId = req.body?.telegram_chat_id;
  if (chatId !== null && chatId !== undefined && typeof chatId !== "string") return res.status(400).json({ error: "telegram_chat_id must be a string or null" });
  try {
    const { rows } = await query("UPDATE users SET telegram_chat_id=$1 WHERE id=$2 RETURNING telegram_chat_id", [chatId?.trim() || null, userFrom(req).id]);
    res.json({ telegram_chat_id: rows[0]?.telegram_chat_id || null });
  } catch (e: any) { res.status(500).json({ error: "Failed to update Telegram", detail: e.message }); }
});
app.use("/api/books", booksRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/upload", uploadRouter);

// ── Quote Wall ────────────────────────────────────────────
app.get("/api/quotes", async (_req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT rl.quote, rl.date, rl.book_id, b.title, b.author
       FROM chapter.reading_log rl
       JOIN chapter.books b ON b.id = rl.book_id
       WHERE rl.quote IS NOT NULL AND btrim(rl.quote) <> ''
       ORDER BY rl.date DESC`
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch quotes", detail: e.message });
  }
});

// ── Community / Book Club ────────────────────────────────
async function statsFor(ownerId: string | null) {
  // Ownership lives on books, not reading_log. Join through the parent book for
  // every log-derived metric so personal Insights never query a nonexistent
  // reading_log.owner_id column.
  const bookFilter = ownerId ? "AND b.owner_id=$1" : "";
  const params = ownerId ? [ownerId] : [];
  const [velocity, insights, bookCounts, globalStats] = await Promise.all([
    query(`SELECT (rl.date AT TIME ZONE 'Asia/Bangkok')::date AS date, SUM(rl.page_end-rl.page_start+1) AS pages_read
           FROM chapter.reading_log rl JOIN chapter.books b ON b.id=rl.book_id
           WHERE (rl.date AT TIME ZONE 'Asia/Bangkok')::date >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '30 days' ${bookFilter}
           GROUP BY 1 ORDER BY 1`, params),
    query(`SELECT unnest(rl.key_insights) AS insight, COUNT(*) AS freq
           FROM chapter.reading_log rl JOIN chapter.books b ON b.id=rl.book_id
           WHERE true ${bookFilter} GROUP BY insight ORDER BY freq DESC LIMIT 50`, params),
    query(`SELECT COUNT(*) FILTER (WHERE status='active') AS active, COUNT(*) FILTER (WHERE status='finished') AS finished, COUNT(*) FILTER (WHERE status='paused') AS paused, COUNT(*) FILTER (WHERE status='queued') AS queued FROM chapter.books b WHERE true ${bookFilter}`, params),
    query(`SELECT COUNT(DISTINCT (rl.date AT TIME ZONE 'Asia/Bangkok')::date) AS total_days_read, MAX(rl.date AT TIME ZONE 'Asia/Bangkok') AS last_read
           FROM chapter.reading_log rl JOIN chapter.books b ON b.id=rl.book_id
           WHERE true ${bookFilter}`, params),
  ]);
  return { velocity: velocity.rows, insights: insights.rows, bookCounts: bookCounts.rows[0], globalStats: globalStats.rows[0] };
}
// ── Stats endpoint ───────────────────────────────────────
app.get("/api/stats", async (req: Request, res: Response) => {
  try {
    res.json(await statsFor(userFrom(req).id));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch stats", detail: e.message });
  }
});
app.get("/api/stats/community", async (_req, res) => { try { res.json(await statsFor(null)); } catch (e: any) { res.status(500).json({ error: "Failed to fetch community stats", detail: e.message }); } });

// ── Personal weekly reading goal ───────────────────────────
app.get("/api/goals/weekly", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    const today = dateInAppTz();
    const goal = (await query<WeeklyGoalRow>("SELECT * FROM weekly_reading_goals WHERE owner_id=$1", [ownerId])).rows[0] || null;
    const { week_start: weekStart, week_end: weekEnd } = progressFor(goal, 0, today);
    const metricExpr = goal?.metric === "units" ? "COALESCE(SUM(rl.page_end - rl.page_start + 1), 0)" : "COUNT(*)";
    const result = await query<{ completed: string }>(
      `SELECT ${metricExpr} AS completed
       FROM reading_log rl JOIN books b ON b.id=rl.book_id
       WHERE b.owner_id=$1 AND rl.date >= $2::date AND rl.date <= $3::date`,
      [ownerId, weekStart, weekEnd]
    );
    res.json(progressFor(goal, Number(result.rows[0]?.completed || 0), today));
  } catch (e: any) {
    res.status(503).json({ error: "weekly goal unavailable", detail: e.message });
  }
});

// ── Today dashboard (personal retention loop) ──────────────
app.get("/api/today", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    const appToday = dateInAppTz();
    const [active, queued, todayLogs, dueReviews, goalRow] = await Promise.all([
      query(`SELECT * FROM books WHERE owner_id=$1 AND status='active' ORDER BY created_at ASC LIMIT 1`, [ownerId]),
      query(`SELECT * FROM books WHERE owner_id=$1 AND status='queued' ORDER BY queue_order NULLS LAST, created_at ASC LIMIT 1`, [ownerId]),
      query<{ sessions: string; units: string }>(
        `SELECT COUNT(*) AS sessions, COALESCE(SUM(rl.page_end - rl.page_start + 1), 0) AS units
         FROM reading_log rl JOIN books b ON b.id=rl.book_id
         WHERE b.owner_id=$1 AND rl.date=$2::date`, [ownerId, appToday]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM review_cards rc JOIN books b ON b.id=rc.book_id
         WHERE b.owner_id=$1 AND rc.due_date <= $2::date`, [ownerId, appToday]
      ),
      query<WeeklyGoalRow>("SELECT * FROM weekly_reading_goals WHERE owner_id=$1", [ownerId]),
    ]);
    const goal = goalRow.rows[0] || null;
    const bounds = progressFor(goal, 0, appToday);
    const metricExpr = goal?.metric === "units" ? "COALESCE(SUM(rl.page_end - rl.page_start + 1), 0)" : "COUNT(*)";
    const weekly = await query<{ completed: string }>(
      `SELECT ${metricExpr} AS completed FROM reading_log rl JOIN books b ON b.id=rl.book_id
       WHERE b.owner_id=$1 AND rl.date >= $2::date AND rl.date <= $3::date`,
      [ownerId, bounds.week_start, bounds.week_end]
    );
    res.json({
      today: appToday,
      active_book: active.rows[0] || null,
      next_queued_book: queued.rows[0] || null,
      today_progress: { sessions: Number(todayLogs.rows[0]?.sessions || 0), units: Number(todayLogs.rows[0]?.units || 0) },
      due_reviews: Number(dueReviews.rows[0]?.count || 0),
      weekly_goal: progressFor(goal, Number(weekly.rows[0]?.completed || 0), appToday),
    });
  } catch (e: any) {
    res.status(503).json({ error: "today dashboard unavailable", detail: e.message });
  }
});

app.put("/api/goals/weekly", async (req: Request, res: Response) => {
  const metric = req.body?.metric as WeeklyGoalMetric;
  const target = Number(req.body?.target);
  if ((metric !== "sessions" && metric !== "units") || !Number.isInteger(target) || target < 1 || target > 10000) {
    return res.status(400).json({ error: "metric must be sessions or units and target must be an integer from 1 to 10000" });
  }
  try {
    const { rows } = await query<WeeklyGoalRow>(
      `INSERT INTO weekly_reading_goals (owner_id, metric, target)
       VALUES ($1,$2,$3)
       ON CONFLICT (owner_id) DO UPDATE SET metric=EXCLUDED.metric, target=EXCLUDED.target, updated_at=now()
       RETURNING *`,
      [userFrom(req).id, metric, target]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(503).json({ error: "could not save weekly goal", detail: e.message });
  }
});

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function fmtTimestamp(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function postRow(row: any, comments: Comment[]): CommunityPost {
  return {
    id: row.id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    authorBio: row.author_bio,
    bookTitle: row.book_title,
    bookAuthor: row.book_author,
    book_id: row.book_id || undefined,
    summary: row.summary,
    content: row.content,
    likes: row.likes,
    comments,
    timestamp: fmtTimestamp(row.created_at),
    isUserPost: true,
  };
}

function commentRow(row: any): Comment {
  return {
    id: row.id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    authorBio: row.author_bio,
    content: row.content,
    timestamp: fmtTimestamp(row.created_at),
  };
}

async function fetchPost(id: string): Promise<CommunityPost | null> {
  const p = await query("SELECT * FROM community_posts WHERE id=$1", [id]);
  if (!p.rows.length) return null;
  const c = await query(
    "SELECT * FROM community_comments WHERE post_id=$1 ORDER BY created_at ASC",
    [id]
  );
  return postRow(p.rows[0], c.rows.map(commentRow));
}

// ── Community / Book Club (persisted in Postgres) ──────────

// 1. Get All Community Posts
app.get("/api/community/posts", async (req: Request, res: Response) => {
  try {
    const authorId = typeof req.query.author_id === "string" ? req.query.author_id : undefined;
    const p = await query(`SELECT * FROM community_posts ${authorId ? "WHERE author_id=$1" : ""} ORDER BY created_at DESC`, authorId ? [authorId] : []);
    const posts: CommunityPost[] = [];
    for (const row of p.rows) {
      const c = await query(
        "SELECT * FROM community_comments WHERE post_id=$1 ORDER BY created_at ASC",
        [row.id]
      );
      posts.push(postRow(row, c.rows.map(commentRow)));
    }
    res.json(posts);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch posts", detail: e.message });
  }
});
app.get("/api/community/readers", async (_req, res) => { try {
  const { rows } = await query("SELECT u.id, u.username, u.display_name, u.avatar_url, COUNT(b.id)::int AS book_count FROM users u LEFT JOIN books b ON b.owner_id=u.id GROUP BY u.id ORDER BY u.display_name");
  res.json(rows.map((r: any) => ({ ...r, avatar_url: r.avatar_url || avatarFor(r.username) })));
} catch (e: any) { res.status(500).json({ error: "Failed to fetch readers", detail: e.message }); } });

// 2. Submit a New Community Post — auto-triggers AI book club
app.post("/api/community/posts", async (req: Request, res: Response) => {
  const { bookTitle, bookAuthor, summary, content, book_id } = req.body;
  const sessionUser = userFrom(req);
  if (!bookTitle || !bookAuthor || !summary || !content) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    const r = await query(
      `INSERT INTO community_posts (author_id, author_name, author_avatar, author_bio, book_title, book_author, book_id, summary, content)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        sessionUser.id, sessionUser.displayName,
        sessionUser.avatarUrl || avatarFor(sessionUser.username),
        "Dedicated Reader & Community Member",
        bookTitle, bookAuthor, book_id || null, summary, content,
      ]
    );
    const post = await fetchPost(r.rows[0].id);
    // Fire-and-forget: all personas respond in sequence
    triggerAllPersonas(r.rows[0].id).catch(console.error);
    res.status(201).json(post);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to create post", detail: e.message });
  }
});

// GET /api/community/posts/:id — single post with comments
app.get("/api/community/posts/:id", async (req: Request, res: Response) => {
  try {
    const post = await fetchPost(req.params.id);
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    res.json(post);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch post", detail: e.message });
  }
});

// Auto-generate responses from all personas after a new post
async function triggerAllPersonas(postId: string) {
  const personas = ['elena', 'marcus', 'sophie', 'devil'];
  for (const personaId of personas) {
    await delay(1200 + Math.random() * 800); // 1.2–2s stagger
    try {
      await generatePersonaComment(postId, personaId);
    } catch (e) {
      console.error(`[persona ${personaId}] failed:`, e);
    }
  }
}

async function generatePersonaComment(postId: string, personaId: string): Promise<void> {
  const p = await query("SELECT * FROM community_posts WHERE id=$1", [postId]);
  if (!p.rows.length) return;
  const post = p.rows[0];

  let personaName = "Sophie Dubois";
  let personaAvatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150";
  let personaBio = "Wellness blogger & mindfulness practitioner.";
  let systemInstruction = "";

  if (personaId === "elena") {
    personaName = "Elena Vance";
    personaAvatar = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150";
    personaBio = "PhD candidate in English Lit. Devoted to classics and prose structure.";
    systemInstruction = `You are Elena Vance, a thoughtful, highly analytical classics enthusiast with a PhD in English Lit. You write beautiful, intellectually stimulating comments that connect themes, structures, or character development in books to broader literature. You are supportive but scholarly.
    Guidelines:
    - Keep your reply to 2-3 natural sentences.
    - Write in a friendly, intellectual, conversational tone.
    - Speak directly to the poster about their summary of "${post.book_title}" by ${post.book_author}.
    - Connect the themes to classic literary concepts, another book, or analytical wisdom.`;
  } else if (personaId === "marcus") {
    personaName = "Marcus Chen";
    personaAvatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150";
    personaBio = "Software engineer. Obsessed with world-building and sci-fi.";
    systemInstruction = `You are Marcus Chen, a software engineer and speculative fiction nerd. You write energetic, curious, slightly tech-savvy comments. You love speculating on ideas, world-building, and logical structures of books.
    Guidelines:
    - Keep your reply to 2-3 natural sentences.
    - Write in an enthusiastic, friendly, slightly geeky tone.
    - Speak directly to the poster about their thoughts on "${post.book_title}" by ${post.book_author}.
    - Ask a speculative "what-if" question or express raw excitement about a concept.`;
  } else if (personaId === "sophie") {
    personaName = "Sophie Dubois";
    personaAvatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150";
    personaBio = "Wellness blogger & contemporary fiction reader.";
    systemInstruction = `You are Sophie Dubois, a warm, caring, and empathetic wellness blogger who reads contemporary novels and memoirs. You write comments focusing on mindfulness, emotional resonance, mental health, and life lessons learned from reading.
    Guidelines:
    - Keep your reply to 2-3 natural sentences.
    - Write in a highly encouraging, gentle, and warm tone.
    - Speak directly to the poster about their summary of "${post.book_title}" by ${post.book_author}.
    - Focus on self-reflection, life lessons, or how reading helps us grow.`;
  } else if (personaId === "devil") {
    personaName = "Ren Okafor";
    personaAvatar = "https://api.dicebear.com/7.x/initials/svg?seed=RenOkafor";
    personaBio = "Contrarian critic. Reads everything, agrees with nothing easily.";
    systemInstruction = `You are Ren Okafor, a sharp contrarian critic who respectfully challenges ideas.
    Guidelines:
    - Keep your reply to 2-3 sentences.
    - Push back on ONE assumption in the summary or the book's premise.
    - Be respectful but intellectually provocative — never dismissive.
    - Ask the poster to defend a claim or reconsider a conclusion.`;
  }

  const prompt = `Review this reading post from a book club member and comment on it:
Book: ${post.book_title} by ${post.book_author}
Summary: ${post.summary}
Post thoughts: ${post.content}

Write a short comment responding to their thoughts, following your persona instructions. Do not use quotes around your response.`;

  const commentText = await callLLM(systemInstruction, prompt, 0.8);
  await query(
    `INSERT INTO community_comments (post_id, author_name, author_avatar, author_bio, content)
     VALUES ($1,$2,$3,$4,$5)`,
    [postId, personaName, personaAvatar, personaBio, commentText]
  );
}

// 3. Like a Post
app.post("/api/community/posts/:id/like", async (req: Request, res: Response) => {
  try {
    const r = await query(
      "UPDATE community_posts SET likes = likes + 1 WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (!r.rows.length) { res.status(404).json({ error: "Post not found" }); return; }
    const post = await fetchPost(r.rows[0].id);
    res.json(post);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to like post", detail: e.message });
  }
});

// 4. Comment on a Post
app.post("/api/community/posts/:id/comments", async (req: Request, res: Response) => {
  const { content } = req.body;
  const sessionUser = userFrom(req);
  if (!content) { res.status(400).json({ error: "Comment content is required" }); return; }
  try {
    await query(
      `INSERT INTO community_comments (post_id, author_id, author_name, author_avatar, author_bio, content)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.params.id, sessionUser.id, sessionUser.displayName,
       sessionUser.avatarUrl || avatarFor(sessionUser.username),
       "Book Lover", content]
    );
    const post = await fetchPost(req.params.id);
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    res.status(201).json(post);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to add comment", detail: e.message });
  }
});

// 5. Trigger AI Reaction — uses NineRouter LLM
app.post("/api/community/posts/:id/trigger-ai-reaction", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { personaId } = req.body;

  const p = await query("SELECT * FROM community_posts WHERE id=$1", [id]);
  if (!p.rows.length) { res.status(404).json({ error: "Post not found" }); return; }
  const post = p.rows[0];

  let personaName = "Sophie Dubois";
  let personaAvatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150";
  let personaBio = "Wellness blogger & mindfulness practitioner.";
  let systemInstruction = "";

  if (personaId === "elena") {
    personaName = "Elena Vance";
    personaAvatar = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150";
    personaBio = "PhD candidate in English Lit. Devoted to classics and prose structure.";
    systemInstruction = `You are Elena Vance, a thoughtful, highly analytical classics enthusiast with a PhD in English Lit. You write beautiful, intellectually stimulating comments that connect themes, structures, or character development in books to broader literature. You are supportive but scholarly.
    Guidelines:
    - Keep your reply to 2-3 natural sentences.
    - Write in a friendly, intellectual, conversational tone.
    - Speak directly to the poster about their summary of "${post.book_title}" by ${post.book_author}.
    - Connect the themes to classic literary concepts, another book, or analytical wisdom.`;
  } else if (personaId === "marcus") {
    personaName = "Marcus Chen";
    personaAvatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150";
    personaBio = "Software engineer. Obsessed with world-building and sci-fi.";
    systemInstruction = `You are Marcus Chen, a software engineer and speculative fiction nerd. You write energetic, curious, slightly tech-savvy comments. You love speculating on ideas, world-building, and logical structures of books.
    Guidelines:
    - Keep your reply to 2-3 natural sentences.
    - Write in an enthusiastic, friendly, slightly geeky tone.
    - Speak directly to the poster about their thoughts on "${post.book_title}" by ${post.book_author}.
    - Ask a speculative "what-if" question or express raw excitement about a concept.`;
  } else {
    personaName = "Sophie Dubois";
    personaAvatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150";
    personaBio = "Wellness blogger & contemporary fiction reader.";
    systemInstruction = `You are Sophie Dubois, a warm, caring, and empathetic wellness blogger who reads contemporary novels and memoirs. You write comments focusing on mindfulness, emotional resonance, mental health, and life lessons learned from reading.
    Guidelines:
    - Keep your reply to 2-3 natural sentences.
    - Write in a highly encouraging, gentle, and warm tone.
    - Speak directly to the poster about their summary of "${post.book_title}" by ${post.book_author}.
    - Focus on self-reflection, life lessons, or how reading helps us grow.`;
  }

  try {
    const prompt = `Review this reading post from a book club member and comment on it:
Book: ${post.book_title} by ${post.book_author}
Summary: ${post.summary}
Post thoughts: ${post.content}

Write a short comment responding to their thoughts, following your persona instructions. Do not use quotes around your response.`;

    const commentText = await callLLM(systemInstruction, prompt, 0.8);

    const r = await query(
      `INSERT INTO community_comments (post_id, author_name, author_avatar, author_bio, content)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, personaName, personaAvatar, personaBio, commentText]
    );

    const updated = await fetchPost(id);
    res.status(201).json({ post: updated, comment: commentRow(r.rows[0]) });
  } catch (err: any) {
    console.error("LLM Error in comment generation:", err);
    res.status(500).json({ error: "Failed to generate AI reaction", details: err.message });
  }
});

// ── Serve frontend assets in production / development ─────────
async function startServer() {
  // Ensure DB schema on boot if a database is configured.
  if (process.env.DATABASE_URL) {
    try {
      await ensureSchema();
      await verifyCoreSchema();
    } catch (e: any) {
      console.error("[db] schema bootstrap failed; refusing to start:", e.message);
      process.exitCode = 1;
      return;
    }
  } else {
    console.warn("[db] DATABASE_URL not set — /api/books routes will be unavailable");
  }

// ── Re-read support ───────────────────────────────────────────
app.post('/api/books/:id/reread', async (req: Request, res: Response) => {
  try {
    const owned = await query("SELECT id FROM books WHERE id=$1 AND owner_id=$2", [req.params.id, userFrom(req).id]);
    if (!owned.rows.length) return res.status(403).json({ error: "Only the owner may modify this resource" });
    const { id } = req.params;
    await query(
      `UPDATE chapter.books SET current_page = 0, status = 'active', reading_round = reading_round + 1 WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Knowledge Mindmap ─────────────────────────────────────────
app.post('/api/books/:id/mindmap', async (req: Request, res: Response) => {
  try {
    const owned = await query("SELECT id FROM books WHERE id=$1 AND owner_id=$2", [req.params.id, userFrom(req).id]);
    if (!owned.rows.length) return res.status(403).json({ error: "Only the owner may modify this resource" });
    const { id } = req.params;
    const book = (await query(`SELECT * FROM chapter.books WHERE id = $1`, [id])).rows[0];
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const { rows: logs } = await query(
      `SELECT * FROM chapter.reading_log WHERE book_id = $1 ORDER BY date DESC`,
      [id]
    );

    const allInsights = logs.flatMap((l: any) => l.key_insights || []);
    const allSummaries = logs.map((l: any) => l.summary).filter(Boolean).join('\n\n');

    if (allInsights.length === 0 && !allSummaries) {
      return res.json(null);
    }

    const prompt = `You are helping a reader understand the key concepts in "${book.title}" by ${book.author}.

Here are all the key insights collected across their reading sessions:
${allInsights.map((i: string, n: number) => `${n + 1}. ${i}`).join('\n')}

Here are the session summaries:
${allSummaries}

Return ONLY a JSON object with this exact structure:
{
  "root": "One sentence thesis of the whole book",
  "branches": [
    {
      "theme": "Theme name (2-4 words)",
      "color": "#hex color",
      "nodes": ["specific insight", "specific insight", "specific insight"]
    }
  ]
}

Use 3-5 branches. Each branch should have 2-4 nodes. Colors should be warm and distinct.
Return only valid JSON, no markdown, no explanation.`;

    const raw = await callLLM('You are a knowledge synthesis expert.', prompt, 0.3);
    res.json(JSON.parse(raw));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Serve SPA ─────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
