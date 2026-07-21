import { Router, Request, Response } from "express";
import { upload } from "../upload.js";
import { config } from "../config.js";
import fs from "fs";
import path from "path";

export const uploadRouter = Router();

// POST /api/upload — upload a book file (max 100MB, .pdf/.epub).
// Saves into CHAPTER_BOOKS_DIR and returns the stored file_path so the client
// can pass it straight into POST /api/books.
uploadRouter.post("/", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "no file uploaded (field name must be 'file')" });
  }
  const lower = req.file.originalname.toLowerCase();
  const fileType = lower.endsWith(".epub") ? "epub" : "pdf";
  res.status(201).json({
    file_path: req.file.path,
    file_type: fileType,
    filename: req.file.originalname,
    size: req.file.size,
    books_dir: config.booksDir,
  });
});

// DELETE /api/upload?path=... — remove an uploaded-but-not-saved file.
// Only deletes files that live inside CHAPTER_BOOKS_DIR (prevents path
// traversal / deleting arbitrary server files).
uploadRouter.delete("/", (req: Request, res: Response) => {
  const p = String(req.query.path || "");
  if (!p) return res.status(400).json({ error: "path required" });
  const dir = config.booksDir.replace(/\/+$/, "");
  const abs = path.resolve(p);
  // Must be inside booksDir and not equal to it.
  if (abs !== dir && !abs.startsWith(dir + path.sep)) {
    return res.status(400).json({ error: "path not inside books dir" });
  }
  try {
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      return res.json({ ok: true, deleted: abs });
    }
    return res.json({ ok: true, deleted: null });
  } catch (e: any) {
    return res.status(500).json({ error: "delete failed", detail: e.message });
  }
});
