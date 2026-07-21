import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { CommunityPost, Comment } from "./src/types.js";
import { booksRouter } from "./src/routes/books.js";
import { uploadRouter } from "./src/routes/upload.js";
import { ensureSchema, query } from "./src/db.js";
import { callLLM } from "./src/llm.js";

// Ensure the port is 3000
const PORT = 3000;

const app = express();
app.use(express.json());

// ── Book reading companion routes (Phase 1) ──
app.use("/api/books", booksRouter);

// ── Book file upload (Phase 3) ──
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
// ── Stats endpoint ───────────────────────────────────────
app.get("/api/stats", async (_req: Request, res: Response) => {
  try {
    const [velocity, insights, bookCounts, globalStats] = await Promise.all([
      query(`SELECT date, SUM(page_end - page_start) AS pages_read
             FROM chapter.reading_log
             WHERE date >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY date ORDER BY date ASC`),
      query(`SELECT unnest(key_insights) AS insight, COUNT(*) AS freq
             FROM chapter.reading_log
             GROUP BY insight ORDER BY freq DESC LIMIT 50`),
      query(`SELECT
               COUNT(*) FILTER (WHERE status = 'active') AS active,
               COUNT(*) FILTER (WHERE status = 'finished') AS finished,
               COUNT(*) FILTER (WHERE status = 'paused') AS paused,
               COUNT(*) FILTER (WHERE status = 'queued') AS queued
             FROM chapter.books`),
      query(`SELECT COUNT(DISTINCT date) AS total_days_read, MAX(date) AS last_read
             FROM chapter.reading_log`),
    ]);
    res.json({
      velocity: velocity.rows,
      insights: insights.rows,
      bookCounts: bookCounts.rows[0],
      globalStats: globalStats.rows[0],
    });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch stats", detail: e.message });
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
app.get("/api/community/posts", async (_req: Request, res: Response) => {
  try {
    const p = await query("SELECT * FROM community_posts ORDER BY created_at DESC");
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

// 2. Submit a New Community Post — auto-triggers AI book club
app.post("/api/community/posts", async (req: Request, res: Response) => {
  const { authorName, authorAvatar, bookTitle, bookAuthor, summary, content, book_id } = req.body;
  if (!bookTitle || !bookAuthor || !summary || !content) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    const r = await query(
      `INSERT INTO community_posts (author_name, author_avatar, author_bio, book_title, book_author, book_id, summary, content)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        authorName || "Book Lover",
        authorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
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
  const { content, authorName, authorAvatar, authorBio } = req.body;
  if (!content) { res.status(400).json({ error: "Comment content is required" }); return; }
  try {
    await query(
      `INSERT INTO community_comments (post_id, author_name, author_avatar, author_bio, content)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, authorName || "Fellow Reader",
       authorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
       authorBio || "Book Lover", content]
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
    } catch (e: any) {
      console.error("[db] schema ensure failed:", e.message);
    }
  } else {
    console.warn("[db] DATABASE_URL not set — /api/books routes will be unavailable");
  }

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
