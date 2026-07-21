import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { CommunityPost, Comment } from "./src/types.js";
import { booksRouter } from "./src/routes/books.js";
import { uploadRouter } from "./src/routes/upload.js";
import { ensureSchema } from "./src/db.js";
import { callLLM } from "./src/llm.js";

// Ensure the port is 3000
const PORT = 3000;

const app = express();
app.use(express.json());

// ── Book reading companion routes (Phase 1) ──
app.use("/api/books", booksRouter);

// ── Book file upload (Phase 3) ──
app.use("/api/upload", uploadRouter);

// ── In-Memory Database for Community Posts & Comments ──────────
let communityPosts: CommunityPost[] = [];

// 1. Get All Community Posts
app.get("/api/community/posts", (req: Request, res: Response) => {
  res.json(communityPosts);
});

// 2. Submit a New Community Post
app.post("/api/community/posts", (req: Request, res: Response) => {
  const { authorName, authorAvatar, bookTitle, bookAuthor, summary, content, book_id } = req.body;
  
  if (!bookTitle || !bookAuthor || !summary || !content) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const newPost: CommunityPost = {
    id: `post-${Date.now()}`,
    authorName: authorName || "Book Lover",
    authorAvatar: authorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    authorBio: "Dedicated Reader & Community Member",
    bookTitle,
    bookAuthor,
    book_id: book_id || undefined,
    summary,
    content,
    likes: 0,
    comments: [],
    timestamp: "Just now",
    isUserPost: true
  };

  communityPosts = [newPost, ...communityPosts];
  res.status(201).json(newPost);
});

// 3. Like a Post
app.post("/api/community/posts/:id/like", (req: Request, res: Response) => {
  const { id } = req.params;
  const post = communityPosts.find(p => p.id === id);
  if (post) {
    post.likes += 1;
    res.json(post);
  } else {
    res.status(404).json({ error: "Post not found" });
  }
});

// 4. Comment on a Post Manually
app.post("/api/community/posts/:id/comments", (req: Request, res: Response) => {
  const { id } = req.params;
  const { authorName, authorAvatar, authorBio, content } = req.body;

  if (!content) {
    res.status(400).json({ error: "Comment content is required" });
    return;
  }

  const post = communityPosts.find(p => p.id === id);
  if (post) {
    const newComment: Comment = {
      id: `c-${Date.now()}`,
      authorName: authorName || "Fellow Reader",
      authorAvatar: authorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
      authorBio: authorBio || "Book Lover",
      content,
      timestamp: "Just now"
    };
    post.comments.push(newComment);
    res.status(201).json(post);
  } else {
    res.status(404).json({ error: "Post not found" });
  }
});

// 5. Trigger AI Reaction — uses NineRouter LLM (not Gemini)
app.post("/api/community/posts/:id/trigger-ai-reaction", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { personaId } = req.body;

  const post = communityPosts.find(p => p.id === id);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

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
    - Speak directly to the poster about their summary of "${post.bookTitle}" by ${post.bookAuthor}.
    - Connect the themes to classic literary concepts, another book, or analytical wisdom.`;
  } else if (personaId === "marcus") {
    personaName = "Marcus Chen";
    personaAvatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150";
    personaBio = "Software engineer. Obsessed with world-building and sci-fi.";
    systemInstruction = `You are Marcus Chen, a software engineer and speculative fiction nerd. You write energetic, curious, slightly tech-savvy comments. You love speculating on ideas, world-building, and logical structures of books.
    Guidelines:
    - Keep your reply to 2-3 natural sentences.
    - Write in an enthusiastic, friendly, slightly geeky tone.
    - Speak directly to the poster about their thoughts on "${post.bookTitle}" by ${post.bookAuthor}.
    - Ask a speculative "what-if" question or express raw excitement about a concept.`;
  } else {
    personaName = "Sophie Dubois";
    personaAvatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150";
    personaBio = "Wellness blogger & contemporary fiction reader.";
    systemInstruction = `You are Sophie Dubois, a warm, caring, and empathetic wellness blogger who reads contemporary novels and memoirs. You write comments focusing on mindfulness, emotional resonance, mental health, and life lessons learned from reading.
    Guidelines:
    - Keep your reply to 2-3 natural sentences.
    - Write in a highly encouraging, gentle, and warm tone.
    - Speak directly to the poster about their summary of "${post.bookTitle}" by ${post.bookAuthor}.
    - Focus on self-reflection, life lessons, or how reading helps us grow.`;
  }

  try {
    const prompt = `Review this reading post from a book club member and comment on it:
Book: ${post.bookTitle} by ${post.bookAuthor}
Summary: ${post.summary}
Post thoughts: ${post.content}

Write a short comment responding to their thoughts, following your persona instructions. Do not use quotes around your response.`;

    const commentText = await callLLM(systemInstruction, prompt, 0.8);

    const newComment: Comment = {
      id: `ai-${Date.now()}`,
      authorName: personaName,
      authorAvatar: personaAvatar,
      authorBio: personaBio,
      content: commentText,
      timestamp: "Just now"
    };

    post.comments.push(newComment);
    res.status(201).json({ post, comment: newComment });
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
