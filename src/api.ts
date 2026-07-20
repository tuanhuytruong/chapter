// API client for the Chapter reading-companion backend (Phase 1 routes).
import type { BookRow } from "./types";

export interface LogRow {
  id: string;
  book_id: string;
  date: string;
  page_start: number;
  page_end: number;
  raw_text: string | null;
  summary: string | null;
  key_insights: string[] | null;
  quote: string | null;
  telegram_sent: boolean;
  created_at: string;
}

const BASE = "/api/books";

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${msg.slice(0, 200)}`);
  }
  // 204 / empty body
  const text = await res.text();
  return (text ? JSON.parse(text) : ({} as T)) as T;
}

export const api = {
  listBooks: () => req<BookRow[]>(`${BASE}`),
  getBook: (id: string) => req<BookRow>(`${BASE}/${id}`),
  createBook: (body: Partial<BookRow>) =>
    req<BookRow>(`${BASE}`, { method: "POST", body: JSON.stringify(body) }),
  updateBook: (id: string, body: Partial<BookRow>) =>
    req<BookRow>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteBook: (id: string) =>
    req<{ ok: true }>(`${BASE}/${id}`, { method: "DELETE" }),

  getLog: (id: string) => req<LogRow[]>(`${BASE}/${id}/log`),
  getLogToday: (id: string) => req<LogRow | { error: string }>(`${BASE}/${id}/log/today`),
  advance: (id: string) =>
    req<LogRow>(`${BASE}/${id}/advance`, { method: "POST" }),
  advanceAll: () =>
    req<{ advanced: number; skipped: number; errors: any[] }>(`${BASE}/all/advance`, {
      method: "POST",
    }),
  retry: (id: string, date: string) =>
    req<LogRow>(`${BASE}/${id}/retry/${date}`, { method: "POST" }),
};

export interface UploadResult {
  file_path: string;
  file_type: "pdf" | "epub";
  filename: string;
  size: number;
  books_dir: string;
}

/** Upload a book file (max 100MB) to the server. Returns stored path. */
export async function uploadBook(file: File, onProgress?: (pct: number) => void): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const xhr = new XMLHttpRequest();
  return new Promise<UploadResult>((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: any = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as UploadResult);
      else reject(new Error(`${xhr.status}: ${body?.error || xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error("upload network error"));
    xhr.open("POST", "/api/upload");
    xhr.send(form);
  });
}

// ── Derived helpers ──────────────────────────────────────────────
export function progressPct(b: BookRow): number {
  if (!b.total_pages) return 0;
  return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
}

/** Compute current streak (consecutive days up to today) from log dates.
 *  Uses LOCAL date (not UTC) so streaks align with the user's calendar day. */
export function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => d.slice(0, 10)));
  let streak = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  // if today not read yet, start counting from yesterday
  if (!days.has(toLocalDateStr(cur))) cur.setDate(cur.getDate() - 1);
  while (days.has(toLocalDateStr(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fetch a cover image URL from Open Library by book title. */
export async function fetchCover(title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(title.trim());
    const res = await fetch(
      `https://openlibrary.org/search.json?title=${q}&limit=1`
    );
    const data = await res.json();
    const coverId = data?.docs?.[0]?.cover_i;
    if (!coverId) return null;
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  } catch {
    return null;
  }
}
