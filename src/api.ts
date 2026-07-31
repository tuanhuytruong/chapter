// API client for the Chapter reading-companion backend (Phase 1 routes).
import type { BookRow, ReadingLensRow, StoryThreadRow } from "./types";
import type { ReviewCardRow } from "./review";
import type { CalendarLogRow } from "./calendar";
import type { WeeklyGoalMetric, WeeklyGoalProgress, WeeklyGoalRow } from "./weekly-goal";
import type { AchievementsResponse } from "./achievements";

export type MembershipTier = "free" | "plus" | "deep_reader";
export type MembershipPlan = { tier: MembershipTier; name: string; tagline: string; monthlyPrice: string | null; annualPrice: string | null; annualLabel: string | null; checkoutAvailable: false; benefits: Array<{ label: string; availableNow: boolean }> };
export interface MembershipPlansResponse { policyVersion: number; checkoutAvailable: false; plans: MembershipPlan[]; }

export interface UpgradePrompt {
  key: string;
  targetTier: "plus" | "deep_reader";
  message: string;
  feature?: string;
  context: { bookId: string };
}
export interface UpgradePromptsResponse {
  prompt: UpgradePrompt | null;
}

export interface EntitlementsResponse {
  subscription: { tier: MembershipTier; status: string; active: boolean; source: string; periodEnd: string | null };
  features: Record<string, { available: boolean; usage: { used: number; reserved: number; limit: number | "unlimited" | "unavailable"; remaining: number | null } }>;
  policyVersion: number;
}

export interface TodayDashboard {
  today: string;
  active_book: BookRow | null;
  next_queued_book: BookRow | null;
  today_progress: { sessions: number; units: number };
  due_reviews: number;
  weekly_goal: WeeklyGoalProgress;
}

export interface LogRow {
  id: string;
  book_id: string;
  date: string;
  session: number;
  page_start: number;
  page_end: number;
  raw_text: string | null;
  summary: string | null;
  key_insights: string[] | null;
  quote: string | null;
  telegram_sent: boolean;
  notes: string | null;
  chapter_title: string | null;
  created_at: string;
}

export interface AdvanceResult {
  bookId: string;
  title: string;
  author: string;
  date: string;
  session: number;
  pageStart: number;
  pageEnd: number;
  totalUnits: number;
  finished: boolean;
  log: LogRow;
  readingExperience: "analytical" | "story";
}

export interface PodcastEpisode {
  id: string;
  log_id: string | null;
  chapter_title: string | null;
  status: "queued" | "scripting" | "synthesizing" | "archiving" | "archive_pending" | "ready" | "failed";
  language: "vi" | "en";
  voice_model: string;
  word_count: number | null;
  duration_s: number | null;
  script_text: string | null;
  created_at: string;
}

export interface PodcastChapter {
  chapter_key: string;
  chapter_title: string | null;
  start_unit: number;
  end_unit: number;
  char_count: number;
  episode: PodcastEpisode | null;
}

export interface PodcastCatalogBook {
  id: string;
  title: string;
  author: string | null;
  cover_url?: string | null;
  summary_lang: string | null;
  reading_round: number;
  chapters: PodcastChapter[];
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
  listBooks: (scope: "mine" | "all" = "mine") => req<BookRow[]>(`${BASE}?scope=${scope}`),
  getBook: (id: string) => req<BookRow>(`${BASE}/${id}`),
  createBook: (body: Partial<BookRow>) =>
    req<BookRow>(`${BASE}`, { method: "POST", body: JSON.stringify(body) }),
  updateBook: (id: string, body: Partial<BookRow>) =>
    req<BookRow>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  reorderQueue: (bookIds: string[]) =>
    req<BookRow[]>(`${BASE}/queue`, { method: "PUT", body: JSON.stringify({ bookIds }) }),
  deleteBook: (id: string) =>
    req<{ ok: true }>(`${BASE}/${id}`, { method: "DELETE" }),

  getLog: (id: string) => req<LogRow[]>(`${BASE}/${id}/log`),
  getCalendar: (month: string, bookId = "") =>
    req<CalendarLogRow[]>(`${BASE}/calendar?month=${encodeURIComponent(month)}&bookId=${encodeURIComponent(bookId)}`),
  getLogToday: (id: string) => req<LogRow[]>(`${BASE}/${id}/log/today`),
  advance: (id: string) =>
    req<AdvanceResult>(`${BASE}/${id}/advance`, { method: "POST" }),
  retryLog: (bookId: string, logId: string) =>
    req<LogRow>(`${BASE}/${bookId}/logs/${logId}/retry`, { method: "POST" }),
  getReadingLens: (bookId: string) => req<ReadingLensRow[]>(`${BASE}/${bookId}/reading-lens`),
  retryReadingLens: (bookId: string, logId: string) =>
    req<ReadingLensRow>(`${BASE}/${bookId}/logs/${logId}/reading-lens/retry`, { method: "POST" }),
  synthesizeReadingLens: (bookId: string) =>
    req<{ synthesis: string }>(`${BASE}/${bookId}/reading-lens/synthesis`, { method: "POST" }),
  getStoryThread: (bookId: string) => req<StoryThreadRow[]>(`${BASE}/${bookId}/story-thread`),
  getStoryThreadForLog: (bookId: string, logId: string) =>
    req<StoryThreadRow>(`${BASE}/${bookId}/logs/${logId}/story-thread`),
  retryStoryThread: (bookId: string, logId: string) =>
    req<StoryThreadRow[]>(`${BASE}/${bookId}/logs/${logId}/retry`, { method: "POST" }),
  updateLogNotes: (bookId: string, logId: string, notes: string) =>
    req<LogRow>(`${BASE}/${bookId}/logs/${logId}`, { method: "PATCH", body: JSON.stringify({ notes }) }),
  generateReflection: (bookId: string) =>
    req<Pick<BookRow, 'reflection_text' | 'reflection_at'>>(`${BASE}/${bookId}/reflection`, { method: "POST" }),
  getDueReviews: () => req<ReviewCardRow[]>("/api/reviews/due"),
  submitReview: (id: string, remembered: boolean) =>
    req<ReviewCardRow>(`/api/reviews/${id}`, { method: "POST", body: JSON.stringify({ remembered }) }),
  getWeeklyGoal: () => req<WeeklyGoalProgress>("/api/goals/weekly"),
  getTodayDashboard: () => req<TodayDashboard>("/api/today"),
  getAchievements: () => req<AchievementsResponse>("/api/achievements"),
  getEntitlements: () => req<EntitlementsResponse>("/api/entitlements/me"),
  getMembershipPlans: () => req<MembershipPlansResponse>("/api/entitlements/plans"),
  getUpgradePrompts: (bookId: string) => req<UpgradePromptsResponse>(`/api/entitlements/prompts?bookId=${encodeURIComponent(bookId)}`),
  dismissUpgradePrompt: (key: string) => req<void>(`/api/entitlements/prompts/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ action: "dismiss" }) }),
  getPodcastCatalog: () => req<PodcastCatalogBook[]>("/api/podcasts/catalog"),
  getBookPodcast: (bookId: string) => req<PodcastCatalogBook>(`/api/podcasts/books/${bookId}`),
  createPodcast: (bookId: string, chapterKey: string, voiceGender?: "female" | "male") =>
    req<PodcastEpisode>("/api/podcasts", { method: "POST", body: JSON.stringify({ book_id: bookId, chapter_key: chapterKey, voice_gender: voiceGender }) }),
  regeneratePodcast: (episodeId: string) => req<PodcastEpisode>(`/api/podcasts/${episodeId}/regenerate`, { method: "POST" }),
  getOnboarding: () => req<{ dismissed_steps: string[] }>("/api/onboarding"),
  saveOnboarding: (dismissed_steps: string[]) => req<{ dismissed_steps: string[] }>("/api/onboarding", { method: "PATCH", body: JSON.stringify({ dismissed_steps }) }),
  saveWeeklyGoal: (metric: WeeklyGoalMetric, target: number) =>
    req<WeeklyGoalRow>("/api/goals/weekly", { method: "PUT", body: JSON.stringify({ metric, target }) }),
  getQuotes: (query: QuoteQuery = {}) => {
    const params = new URLSearchParams();
    if (query.limit) params.set("limit", String(query.limit));
    if (query.offset) params.set("offset", String(query.offset));
    if (query.q?.trim()) params.set("q", query.q.trim());
    if (query.bookId) params.set("bookId", query.bookId);
    if (query.sort) params.set("sort", query.sort);
    const suffix = params.toString();
    return req<QuotePage>(`/api/quotes${suffix ? `?${suffix}` : ""}`);
  },
  getStats: () => req<{
    velocity: { date: string; pages_read: number }[];
    insights: { insight: string; freq: number }[];
    bookCounts: { active: number; finished: number; paused: number; queued: number };
    globalStats: { total_days_read: number; last_read: string };
  }>("/api/stats"),

  // ── AI Reader / Book Wiki ─────────────────────────────────
  request: <T = any>(url: string, opts?: RequestInit) => req<T>(url, opts),
  getWiki: (bookId: string) => req<any | null>(`${BASE}/${bookId}/wiki`),
  getWikiStatus: (bookId: string) => req<{
    hasFile: boolean; totalSessions: number; chunksProcessed: number;
    wikiExists: boolean; pagesCovered: number; wikiGeneratedAt: string | null;
    outputLanguage: "auto" | "vi" | "en"; schemaVersion: number;
  }>(`${BASE}/${bookId}/wiki/status`),
  regenerateWiki: (bookId: string) => req<{ ok: boolean; updated: boolean }>(
    `${BASE}/${bookId}/wiki/regenerate`, { method: "POST" }
  ),
};

export interface UploadResult {
  file_path: string;
  file_type: "pdf" | "epub";
  filename: string;
  size: number;
  books_dir: string;
}

/** Delete an uploaded-but-not-saved file by its stored path. */
export async function deleteUpload(filePath: string): Promise<void> {
  await fetch(`/api/upload?path=${encodeURIComponent(filePath)}`, { method: "DELETE" });
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
export interface QuoteCard {
  quote: string;
  date: string;
  book_id: string;
  title: string;
  author: string;
}

export interface QuoteBookOption {
  id: string;
  title: string;
  author: string;
}

export interface QuoteQuery {
  limit?: number;
  offset?: number;
  q?: string;
  bookId?: string;
  sort?: 'newest' | 'oldest' | 'mixed';
}

export interface QuotePage {
  items: QuoteCard[];
  total: number;
  books: QuoteBookOption[];
}

export function progressPct(b: BookRow): number {
  if (!b.total_pages) return 0;
  return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
}

/** Estimate how many reading days remain to finish the book. */
export function daysToFinish(b: BookRow): number | null {
  if (!b.daily_pages || b.daily_pages <= 0) return null;
  const remaining = b.total_pages - b.current_page;
  if (remaining <= 0) return null; // finished or no pages left
  return Math.ceil(remaining / b.daily_pages);
}

/** Returns true if any session exists for today for this book. */
export function hasTodaySession(logs: LogRow[]): boolean {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  return logs.some(l => String(l.date).slice(0, 10) === today);
}

/** Compute current streak (consecutive days up to today) from log dates.
 *  Uses LOCAL date (not UTC) so streaks align with the user's calendar day. */
export function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => {
    // ISO datetime from server (e.g. "2026-07-20T17:00:00.000Z") needs
    // Asia/Bangkok conversion — the plain slice(0,10) would give the UTC day.
    const s = String(d);
    return s.includes("T")
      ? new Date(s).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
      : s.slice(0, 10);
  }));
  let streak = 0;
  // "Today" in the app timezone (Asia/Bangkok / UTC+7), not the viewer's local tz.
  const parts = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).split("-");
  const cur = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
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
