// Multer config for book file uploads (Phase 3 — upload on Add Book).
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { config } from "./config.js";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Busboy/Multer exposes multipart filenames as Latin-1 strings on some clients
 * even when the browser sent UTF-8 bytes. Repair only a lossless UTF-8 round
 * trip, otherwise retain the supplied name unchanged.
 */
const WINDOWS_1252_BYTES: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88,
  0x2030: 0x89, 0x160: 0x8a, 0x2039: 0x8b, 0x152: 0x8c,
  0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b,
  0x153: 0x9c, 0x17e: 0x9e, 0x178: 0x9f,
};

function windows1252Bytes(value: string): Buffer | null {
  const bytes: number[] = [];
  for (const character of value) {
    const code = character.codePointAt(0)!;
    const byte = code <= 0xff ? code : WINDOWS_1252_BYTES[code];
    if (byte === undefined) return null;
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

export function displayUploadFilename(originalname: string): string {
  // Busboy's historical default is Latin-1/Windows-1252. Windows-1252 matters
  // here because UTF-8 byte 0x93 is commonly rendered as a curly quote (U+201C).
  const bytes = windows1252Bytes(originalname);
  const repaired = bytes?.toString("utf8");
  // Repair only recognizable UTF-8-as-Latin-1 mojibake (e.g. "Chiáº¿n"),
  // not ordinary ASCII or genuine Latin-1 names such as "Café".
  const looksMojibake = /(?:Ã.|Â.|â.|á[º»])/u.test(originalname);
  return looksMojibake && repaired && !repaired.includes("\ufffd") ? repaired : originalname;
}

export function uploadExtension(originalname: string): string {
  return path.extname(displayUploadFilename(originalname)).toLowerCase();
}

export function storedUploadFilename(originalname: string, suffix = randomUUID().slice(0, 8)): string {
  const displayName = displayUploadFilename(originalname);
  const ext = path.extname(displayName).toLowerCase().slice(0, 12);
  const base = path
    .basename(displayName, ext)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "book";
  return `${base}-${suffix}${ext}`;
}

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
    // The stored path stays ASCII/no-diacritic while API display uses the
    // repaired Unicode name. UUID prevents same-name upload collisions.
    cb(null, storedUploadFilename(file.originalname));
  },
});

function fileFilter(
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const ext = uploadExtension(file.originalname);
  const ok = ext === ".pdf" || ext === ".epub";
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
