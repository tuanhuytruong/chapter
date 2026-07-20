import { Router, Request, Response } from "express";
import { upload } from "../upload.js";
import { config } from "../config.js";

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
