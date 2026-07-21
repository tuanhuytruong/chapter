// Multer config for book file uploads (Phase 3 — upload on Add Book).
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { config } from "./config.js";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// Ensure the books directory exists (best-effort; don't crash startup if it
// already exists or permissions are temporarily unavailable — uploads will
// surface a clear error at request time instead).
const booksDir = config.booksDir;
try {
  fs.mkdirSync(booksDir, { recursive: true });
} catch (e: any) {
  if (e.code !== "EEXIST") {
    console.warn(`[upload] could not create books dir ${booksDir}: ${e.message}`);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, booksDir),
  filename: (_req, file, cb) => {
    // Keep the original base name (sanitized) + a short UUID suffix so
    // concurrent uploads of the same filename don't collide, e.g.
    // "atomic-habits-20bc5940.pdf". Extension is derived from the original.
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 12);
    const base = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-") // sanitize unsafe chars
      .replace(/^-+|-+$/g, "") // trim leading/trailing dashes
      .slice(0, 120) || "book";
    const suffix = randomUUID().slice(0, 8);
    cb(null, `${base}-${suffix}${ext}`);
  },
});

function fileFilter(
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const lower = file.originalname.toLowerCase();
  const ok = lower.endsWith(".pdf") || lower.endsWith(".epub");
  if (!ok) {
    cb(new Error("Only .pdf or .epub files are allowed"));
    return;
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
