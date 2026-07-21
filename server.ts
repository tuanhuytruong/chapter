import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { CommunityPost, Comment } from "./src/types.js";
import { booksRouter } from "./src/routes/books.js";
import { uploadRouter } from "./src/routes/upload.js";
import { ensureSchema } from "./src/db.js";

// Ensure the port is 3000
const PORT = 3000;

// Initialize GoogleGenAI server-side with AI Studio User-Agent telemetry
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

const app = express();
app.use(express.json());

// ── Book reading companion routes (Phase 1) ──
app.use("/api/books", booksRouter);

// ── Book file upload (Phase 3) ──
app.use("/api/upload", uploadRouter);

// In-Memory Database for Community Posts & Comments
let communityPosts: CommunityPost[] = [
  {
    id: "post-1",
    authorName: "Elena Vance",
    authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    authorBio: "PhD candidate in English Lit. Devoted to classics, narrative structure, and prose styling.",
    bookTitle: "Jane Eyre",
    bookAuthor: "Charlotte Brontë",
    summary: "An exploration of emotional endurance and independence.",
    content: "Today I completed Chapter 24. Charlotte Brontë's depiction of Jane's refusal to compromise her moral autonomy, even in the face of Rochester's desperate pleas, is a masterful study in self-respect. Jane proves that loving oneself is a prerequisite to truly loving another, refusing to be reduced to Rochester's mistress. The gothic atmosphere continues to perfectly mirror her internal psychological struggles.",
    likes: 14,
    comments: [
      {
        id: "c-1",
        authorName: "Sophie Dubois",
        authorAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
        authorBio: "Wellness blogger and mindfulness practitioner. Reads memoirs and contemporary fiction.",
        content: "Beautifully put, Elena! Jane's self-love and firm boundaries are so incredibly modern. It's a reminder of how important self-respect is for our mental well-being.",
        timestamp: "2 hours ago"
      }
    ],
    timestamp: "4 hours ago"
  },
  {
    id: "post-2",
    authorName: "Marcus Chen",
    authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    authorBio: "Software engineer. Obsessed with world-building, hard sci-fi, and futurology.",
    bookTitle: "Project Hail Mary",
    bookAuthor: "Andy Weir",
    summary: "A thrilling tribute to science, problem-solving, and unlikely friendships.",
    content: "Finished Chapter 12 today! The chemistry (literally and figuratively) between Ryland Grace and Rocky is some of the best speculative character writing I've ever read. Weir makes advanced physics and astrobiology read like a pulse-pounding thriller. Rocky's description of how his species views the universe through sound and heat is a brilliant exercise in non-human sensory world-building.",
    likes: 22,
    comments: [
      {
        id: "c-2",
        authorName: "Elena Vance",
        authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        authorBio: "PhD candidate in English Lit. Devoted to classics and narrative structure.",
        content: "I agree, Marcus! Although science fiction isn't my main genre, the epistolary style of Ryland slowly uncovering his memories mirrors classic mystery novels wonderfully.",
        timestamp: "1 hour ago"
      }
    ],
    timestamp: "5 hours ago"
  },
  {
    id: "post-3",
    authorName: "Sophie Dubois",
    authorAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
    authorBio: "Wellness blogger and mindfulness practitioner. Reads memoirs and contemporary fiction.",
    bookTitle: "Atomic Habits",
    bookAuthor: "James Clear",
    summary: "A tactical guide on how tiny 1% daily changes compound over time.",
    content: "I read Section 3 on 'Designing Your Environment' this morning. Clear's assertion that environment is the invisible hand that shapes human behavior resonates so deeply. I reorganized my reading corner today: placed my book on my pillow so it's the first thing I see at night, and hid my phone in another room. It made reading 20 pages tonight effortless!",
    likes: 18,
    comments: [],
    timestamp: "1 day ago"
  }
];

// Helper to check for API key
const checkApiKey = (res: Response): boolean => {
  if (!apiKey || !ai) {
    res.status(403).json({
      error: "Gemini API key is missing. Please add GEMINI_API_KEY in the Secrets panel."
    });
    return false;
  }
  return true;
};

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

// 5. Trigger AI Reaction (Generates a supportive and insightful comment from an AI persona)
app.post("/api/community/posts/:id/trigger-ai-reaction", async (req: Request, res: Response) => {
  if (!checkApiKey(res)) return;

  const { id } = req.params;
  const { personaId } = req.body; // 'elena', 'marcus', 'sophie'

  const post = communityPosts.find(p => p.id === id);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  // Choose persona config
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
    systemInstruction = `You are Marcus Chen, a software engineer and speculative fiction nerd. You write energetic, curious, slightly tech-savvy, and high-enthusiasm comments. You love speculating on ideas, world-building, and logical structures of books.
    
    Guidelines:
    - Keep your reply to 2-3 natural sentences.
    - Write in an enthusiastic, friendly, slightly geeky tone.
    - Speak directly to the poster about their thoughts on "${post.bookTitle}" by ${post.bookAuthor}.
    - Ask a speculative "what-if" question or express raw excitement about a concept.`;
  } else {
    // Sophie (default)
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

    const response = await ai!.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.8,
      }
    });

    const commentText = response.text?.trim() || "What a wonderful reflection! Thanks for sharing this.";

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
    console.error("Gemini API Error in comment generation:", err);
    res.status(500).json({ error: "Failed to generate AI reaction", details: err.message });
  }
});

// 6. Suggest Books based on mood or interest
app.post("/api/gemini/suggest-books", async (req: Request, res: Response) => {
  if (!checkApiKey(res)) return;

  const { topic, genre } = req.body;
  if (!topic) {
    res.status(400).json({ error: "Mood, theme or interest is required" });
    return;
  }

  try {
    const prompt = `Recommend 4 books for someone interested in: "${topic}" ${genre ? `within the genre: ${genre}` : ""}.
    Return the response strictly as a JSON array of objects with the exact schema:
    [
      {
        "title": "Book Title",
        "author": "Book Author",
        "description": "Short, engaging, 1-2 sentence hook explaining why they should read it based on their interest.",
        "genre": "Genre name",
        "totalPages": 320,
        "reason": "Brief explanation of why this matches their specific query."
      }
    ]
    Do not add markdown formatting or backticks around the raw JSON string. Just return the valid JSON string.`;

    const response = await ai!.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    const rawText = response.text?.trim() || "[]";
    const books = JSON.parse(rawText);
    res.json(books);
  } catch (err: any) {
    console.error("Gemini API Error in book suggestion:", err);
    res.status(500).json({ error: "Failed to fetch book suggestions", details: err.message });
  }
});

// 7. Analyze Shared Summary & Generate Deep Questions + Next Read
app.post("/api/gemini/analyze-summary", async (req: Request, res: Response) => {
  if (!checkApiKey(res)) return;

  const { title, author, summary, content } = req.body;
  if (!title || !summary) {
    res.status(400).json({ error: "Book Title and summary are required" });
    return;
  }

  try {
    const prompt = `Analyse the user's reading reflection for "${title}" by ${author || "Unknown"}.
    User's summary: "${summary}"
    User's detailed reflection: "${content}"
    
    Provide an analysis, including:
    1. A short, highly-affirming 2-sentence feedback of their understanding and takeaways.
    2. Exactly 2 deep, engaging, and philosophical discussion/reflection questions to help them think deeper about the book's core message.
    3. One personalized 'Next Read' recommendation that naturally follows the themes they discussed.
    
    Return the response strictly as a JSON object with this exact structure:
    {
      "analysis": "Short feedback on their takeaways.",
      "discussionQuestions": [
        "Question 1?",
        "Question 2?"
      ],
      "nextRead": {
        "title": "Book Title",
        "author": "Author Name",
        "description": "Why they should read this next, tying it back to their reflection."
      }
    }
    Return only valid JSON. Do not wrap in backticks or markdown codeblocks.`;

    const response = await ai!.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.8,
      }
    });

    const rawText = response.text?.trim() || "{}";
    const analysisResult = JSON.parse(rawText);
    res.json(analysisResult);
  } catch (err: any) {
    console.error("Gemini API Error in summary analysis:", err);
    res.status(500).json({ error: "Failed to analyze summary", details: err.message });
  }
});

// 8. Book Club Chat
app.post("/api/gemini/chat", async (req: Request, res: Response) => {
  if (!checkApiKey(res)) return;

  const { messages, bookTitle, personaId } = req.body;
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Messages array is required" });
    return;
  }

  // Get selected persona profile
  let personaName = "Sophie Dubois";
  let systemInstruction = "";

  if (personaId === "elena") {
    personaName = "Elena Vance";
    systemInstruction = `You are Elena Vance, a brilliant PhD candidate in English Lit. You love classic prose, thematic development, and deep literary analyses. You converse about books with scholarly delight, always referencing subtexts, character psychology, and literary references, yet remain supportive and polite.
    You are participating in a group chat/discussion about the book: "${bookTitle || 'general literature'}". Feel free to suggest books, examine motifs, or discuss narrative forms. Keep responses moderately short (2-4 sentences) and engaging.`;
  } else if (personaId === "marcus") {
    personaName = "Marcus Chen";
    systemInstruction = `You are Marcus Chen, a software engineer who reads heaps of science fiction, speculative stories, and non-fiction. You get deeply excited about hard science concepts, world-building logic, and cool future tech. You talk with passion, using fun terms and asking speculative questions.
    You are participating in a group chat about the book: "${bookTitle || 'general literature'}". Keep responses energetic, friendly, and moderately short (2-4 sentences).`;
  } else {
    personaName = "Sophie Dubois";
    systemInstruction = `You are Sophie Dubois, a warm wellness blogger who loves contemporary romance, memoirs, self-growth, and gentle fiction. You are highly empathetic, caring, and believe books are a gateway to self-care and mental health. You talk with warmth and validation.
    You are participating in a group chat about the book: "${bookTitle || 'general literature'}". Keep responses extremely supportive, gentle, and moderately short (2-4 sentences).`;
  }

  try {
    // Format messages for @google/genai format
    // Map roles to 'user' or 'model' (or keep systemInstruction in config)
    const chatContents = messages.map((msg: any) => {
      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: `${msg.name ? `[${msg.name}]: ` : ""}${msg.content}` }]
      };
    });

    const response = await ai!.models.generateContent({
      model: "gemini-3.5-flash",
      contents: chatContents,
      config: {
        systemInstruction,
        temperature: 0.8,
      }
    });

    res.json({
      role: "assistant",
      name: personaName,
      content: response.text?.trim() || "That is so fascinating. What do you think about that?"
    });
  } catch (err: any) {
    console.error("Gemini API Error in Book Club chat:", err);
    res.status(500).json({ error: "Failed to converse with book club", details: err.message });
  }
});

// Serve frontend assets in production / development
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
