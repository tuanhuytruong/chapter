import { Router, Request, Response } from "express";
import { upload } from "../upload.js";
import { config } from "../config.js";
import { query } from "../db.js";
import { requireAuth, userFrom } from "../auth.js";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

export const uploadRouter = Router();
uploadRouter.use(requireAuth);

const MAX_EPUB_ENTRIES = 10_000;
const MAX_EPUB_EXPANDED_BYTES = 250 * 1024 * 1024;

export async function validateBookUpload(file: Express.Multer.File): Promise<"pdf" | "epub"> {
  const handle = await fs.promises.open(file.path, "r");
  try {
    const signature = Buffer.alloc(5);
    await handle.read(signature, 0, signature.length, 0);
    if (file.originalname.toLowerCase().endsWith(".pdf")) {
      if (signature.toString("ascii") !== "%PDF-") throw new Error("Uploaded file is not a valid PDF");
      return "pdf";
    }
  } finally {
    await handle.close();
  }

  const zip = await JSZip.loadAsync(await fs.promises.readFile(file.path), { checkCRC32: true });
  const entries = Object.values(zip.files);
  if (!zip.file("META-INF/container.xml") || !zip.file("mimetype")) throw new Error("Uploaded file is not a valid EPUB");
  if (entries.length > MAX_EPUB_ENTRIES) throw new Error("EPUB contains too many files");
  let expandedBytes = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const data = await entry.async("uint8array");
    expandedBytes += data.byteLength;
    if (expandedBytes > MAX_EPUB_EXPANDED_BYTES) throw new Error("EPUB expanded size is too large");
  }
  return "epub";
}

// POST /api/upload — upload a book file (max 100MB, .pdf/.epub).
// Saves into CHAPTER_BOOKS_DIR and returns the stored file_path so the client
// can pass it straight into POST /api/books.
uploadRouter.post("/", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "no file uploaded (field name must be 'file')" });
  }
  let fileType: "pdf" | "epub";
  try {
    fileType = await validateBookUpload(req.file);
  } catch {
    fs.unlink(req.file.path, () => undefined);
    return res.status(400).json({ error: "uploaded file content does not match a supported PDF or EPUB" });
  }
  try { await query("INSERT INTO uploaded_files (owner_id, file_path) VALUES ($1,$2)", [userFrom(req).id, req.file.path]); }
  catch { fs.unlink(req.file.path, () => undefined); return res.status(503).json({ error: "could not register uploaded file" }); }
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
uploadRouter.delete("/", async (req: Request, res: Response) => {
  const p = String(req.query.path || "");
  if (!p) return res.status(400).json({ error: "path required" });
  const dir = config.booksDir.replace(/\/+$/, "");
  const abs = path.resolve(p);
  // Must be inside booksDir and not equal to it.
  if (abs !== dir && !abs.startsWith(dir + path.sep)) {
    return res.status(400).json({ error: "path not inside books dir" });
  }
  const owned = await query("SELECT 1 FROM uploaded_files WHERE owner_id=$1 AND file_path=$2 AND claimed_at IS NULL", [userFrom(req).id, abs]);
  if (!owned.rows.length) return res.status(404).json({ error: "upload not found" });
  try {
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      await query("DELETE FROM uploaded_files WHERE owner_id=$1 AND file_path=$2 AND claimed_at IS NULL", [userFrom(req).id, abs]);
      return res.json({ ok: true });
    }
    await query("DELETE FROM uploaded_files WHERE owner_id=$1 AND file_path=$2 AND claimed_at IS NULL", [userFrom(req).id, abs]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "delete failed" });
  }
});
