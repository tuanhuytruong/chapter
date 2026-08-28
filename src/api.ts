// API client for the Chapter reading-companion backend (Phase 1 routes).
import type {
  BookRow,
  ReadingProgressCompanionRow,
  ReadingLensRow,
  ReadingMarkerKind,
  ReadingMarkerRow,
  StoryThreadRow,
  SummaryMode,
} from "./types";
import type { ReviewCardRow } from "./review";
import type { CalendarLogRow } from "./calendar";
import type {
  WeeklyGoalMetric,
  WeeklyGoalProgress,
  WeeklyGoalRow,
} from "./weekly-goal";
import type { AchievementsResponse } from "./achievements";

export type MembershipTier = "free" | "plus" | "deep_reader";
export type MembershipPlan = {
  tier: MembershipTier;
  name: string;
  tagline: string;
  monthlyPrice: string | null;
  annualPrice: string | null;
  annualLabel: string | null;
  checkoutAvailable: false;
  benefits: Array<{ label: string; availableNow: boolean }>;
};

export type BillingCatalogResponse = {
  enabled: boolean;
  provider: "vietqr_static";
  bank: "MB";
  catalog: Array<{
    id: string;
    tier: "plus" | "deep_reader";
    period: "month" | "year";
    amountVnd: number;
    currency: "VND";
    available: boolean;
  }>;
};
export type BillingOrder = {
  id: string;
  sku: string;
  tier: "plus" | "deep_reader";
  period: "month" | "year";
  amountVnd: number;
  currency: "VND";
  status: string;
  transferReference: string;
  expiresAt: string;
  createdAt: string;
  qrUrl: string | null;
};
export type BillingMeResponse = {
  orders: BillingOrder[];
  transactions: Array<{
    id: string;
    orderId: string;
    sku: string;
    amountVnd: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
  }>;
};
export interface MembershipPlansResponse {
  policyVersion: number;
  checkoutAvailable: false;
  plans: MembershipPlan[];
}

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
  subscription: {
    tier: MembershipTier;
    status: string;
    active: boolean;
    source: string;
    periodEnd: string | null;
  };
  retention: {
    accessEndsAt: string | null;
    endsSoon: boolean;
    cancellationScheduled: boolean;
  };
  features: Record<
    string,
    {
      available: boolean;
      usage: {
        used: number;
        reserved: number;
        limit: number | "unlimited" | "unavailable";
        remaining: number | null;
      };
    }
  >;
  policyVersion: number;
}

export interface MonthlyReviewArtifact {
  id: string;
  periodKey: string;
  schemaVersion: number;
  outputLanguage: "vi" | "en";
  title: string;
  opening: string;
  themes: Array<{ title: string; detail: string; evidence: string[] }>;
  books: Array<{
    bookId: string;
    title: string;
    sessions: number;
    contribution: string;
  }>;
  carryForward: string[];
  gentleNextStep: string;
  sourceSessionCount: number;
  generatedAt: string;
}
export interface MonthlyReviewResponse {
  periodKey: string;
  review: MonthlyReviewArtifact | null;
  sourceSessionCount: number;
  hasSource: boolean;
  available: boolean;
  usage: {
    used: number;
    reserved: number;
    limit: number | "unlimited" | "unavailable";
  };
}

export interface CrossBookConnectionArtifact {
  id: string;
  requestKey: string;
  schemaVersion: number;
  outputLanguage: "vi" | "en";
  opening: string;
  connections: Array<{
    title: string;
    synthesis: string;
    sourceRefs: Array<{
      sourceType: string;
      sourceId: string;
      bookId: string;
      bookTitle: string;
      occurredAt: string;
    }>;
  }>;
  carryForward: string[];
  sourceBookCount: number;
  sourceSessionCount: number;
  generatedAt: string;
}
export interface CrossBookConnectionsResponse {
  connection: CrossBookConnectionArtifact | null;
  sourceBookCount: number;
  sourceSessionCount: number;
  hasSource: boolean;
  available: boolean;
  usage: {
    used: number;
    reserved: number;
    limit: number | "unlimited" | "unavailable";
  };
}

export interface PodcastRecapArtifact {
  id: string;
  requestKey: string;
  status: string;
  outputLanguage: "vi" | "en";
  voiceModel: string;
  payload: {
    title: string;
    opening: string;
    recap: string;
    nextDirection: string;
    sourceRefs: Array<{
      sourceType: string;
      sourceId: string;
      bookId: string;
      bookTitle: string;
      occurredAt: string;
    }>;
  };
  sourceBookCount: number;
  sourceSessionCount: number;
  scriptText: string | null;
  durationS: number | null;
  hasAudio: boolean;
  generatedAt: string;
}
export interface PodcastRecapResponse {
  recap: PodcastRecapArtifact | null;
  available: boolean;
  hasSource: boolean;
  sourceBookCount: number;
  sourceSessionCount: number;
  usage: {
    used: number;
    reserved: number;
    limit: number | "unlimited" | "unavailable";
  };
}

export interface AskReadingAnswer {
  id: string;
  requestKey: string;
  question: string;
  outputLanguage: "vi" | "en";
  answer: string;
  sourceRefs: Array<{
    sourceType: string;
    sourceId: string;
    bookTitle: string;
    occurredAt: string;
  }>;
  sourceCount: number;
  createdAt: string;
}
export interface AskReadingResponse {
  answers: AskReadingAnswer[];
  available: boolean;
}

export interface TodayInsights {
  selection: {
    all_books: boolean;
    book_id: string | null;
    reading_round: number | null;
  };
  books: Array<{
    id: string;
    title: string;
    author: string;
    current_reading_round: number;
  }>;
  rounds: Array<{ reading_round: number; status: string }>;
  insights: Array<{ text: string; occurrences: number }>;
}

export interface TodayDashboard {
  today: string;
  active_books: BookRow[];
  active_book: BookRow | null;
  next_queued_book: BookRow | null;
  today_progress: { sessions: number; units: number };
  due_reviews: number;
  weekly_goal: WeeklyGoalProgress;
}

export interface LogRow {
  id: string;
  book_id: string;
  reading_round: number;
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

export interface ReadingRoundRow {
  reading_round: number;
  status: "active" | "paused" | "finished" | "queued";
  started_at: string;
  finished_at: string | null;
  final_page: number;
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
  chapter_key: string;
  chapter_title: string | null;
  chapter_number: number | null;
  status:
    | "queued"
    | "scripting"
    | "synthesizing"
    | "archiving"
    | "archive_pending"
    | "ready"
    | "failed"
    | "unavailable";
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
  chapter_number: number;
  start_unit: number;
  end_unit: number;
  start_page: number | null;
  end_page: number | null;
  char_count: number;
  episode: PodcastEpisode | null;
}

export interface PodcastPlaylistProgress {
  podcast_id: string;
  current_time_seconds: number;
  completed_at: string | null;
  updated_at: string;
}

export interface PodcastNextChapter {
  chapter_key: string;
  chapter_title: string | null;
  chapter_number: number | null;
  start_unit: number;
  end_unit: number;
  start_page: number | null;
  end_page: number | null;
  has_narrator: boolean;
  episode_status: PodcastEpisode["status"] | null;
}

export interface PodcastPlaylist {
  book_id: string;
  chapter_mode?: "headed" | "fallback";
  reading_round: number;
  episodes: PodcastEpisode[];
  progress: PodcastPlaylistProgress | null;
  next_chapter: PodcastNextChapter | null;
}

export interface PodcastCatalogBook {
  id: string;
  chapter_mode?: "headed" | "fallback";
  title: string;
  author: string | null;
  cover_url?: string | null;
  summary_lang: string | null;
  reading_round: number;
  narrator_gender: "female" | "male" | null;
  chapters: PodcastChapter[];
}

export interface RhythmBookItem {
  book_id: string;
  title: string;
  reading_round: number;
  episodes_total: number;
  episodes_listened: number;
}

export interface RhythmResponse {
  reading_days: string[];
  listening_days: string[];
  listening_episodes_total: number;
  total_listen_seconds: number;
  listen_by_day: { day: string; episodes: number; seconds: number }[];
  books: RhythmBookItem[];
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
  listBooks: (scope: "mine" | "all" = "mine") =>
    req<BookRow[]>(`${BASE}?scope=${scope}`),
  getBook: (id: string) => req<BookRow>(`${BASE}/${id}`),
  createBook: (body: Partial<BookRow>) =>
    req<BookRow>(`${BASE}`, { method: "POST", body: JSON.stringify(body) }),
  updateBook: (id: string, body: Partial<BookRow>) =>
    req<BookRow>(`${BASE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  reorderQueue: (bookIds: string[]) =>
    req<BookRow[]>(`${BASE}/queue`, {
      method: "PUT",
      body: JSON.stringify({ bookIds }),
    }),
  deleteBook: (id: string) =>
    req<{ ok: true }>(`${BASE}/${id}`, { method: "DELETE" }),

  getLog: (id: string, round?: number) =>
    req<LogRow[]>(`${BASE}/${id}/log${round ? `?round=${round}` : ""}`),
  getMarkers: (id: string, round: number) =>
    req<ReadingMarkerRow[]>(`${BASE}/${id}/markers?round=${encodeURIComponent(round)}`),
  createMarker: (id: string, body: { log_id: string; page_position: number; kind: ReadingMarkerKind; note?: string }) =>
    req<ReadingMarkerRow>(`${BASE}/${id}/markers`, { method: "POST", body: JSON.stringify(body) }),
  deleteMarker: (id: string, markerId: string) =>
    req<{ ok: true }>(`${BASE}/${id}/markers/${markerId}`, { method: "DELETE" }),
  getReadingRounds: (id: string) =>
    req<ReadingRoundRow[]>(`${BASE}/${id}/rounds`),
  reread: (id: string) =>
    req<{ ok: true; reading_round: number; book: BookRow }>(
      `${BASE}/${id}/reread`,
      { method: "POST" },
    ),
  getBookStreakDates: (scope: "mine" | "all" = "mine") =>
    req<Record<string, string[]>>(`${BASE}/streaks?scope=${scope}`),
  getCalendar: (month: string, bookId = "", round = "") =>
    req<CalendarLogRow[]>(
      `${BASE}/calendar?month=${encodeURIComponent(month)}&bookId=${encodeURIComponent(bookId)}&round=${encodeURIComponent(round)}`,
    ),
  getLogToday: (id: string) => req<LogRow[]>(`${BASE}/${id}/log/today`),
  advance: (id: string) =>
    req<AdvanceResult>(`${BASE}/${id}/advance`, { method: "POST" }),
  retryLog: (bookId: string, logId: string) =>
    req<LogRow>(`${BASE}/${bookId}/logs/${logId}/retry`, { method: "POST" }),
  getReadingLens: (bookId: string, round?: number) =>
    req<ReadingLensRow[]>(`${BASE}/${bookId}/reading-lens${round ? `?round=${round}` : ""}`),
  retryReadingLens: (bookId: string, logId: string) =>
    req<ReadingLensRow>(`${BASE}/${bookId}/logs/${logId}/reading-lens/retry`, {
      method: "POST",
    }),
  getReadingProgress: (bookId: string, round?: number) =>
    req<ReadingProgressCompanionRow | null>(`${BASE}/${bookId}/reading-progress${round ? `?round=${round}` : ""}`),
  refreshReadingProgress: (bookId: string) => req<ReadingProgressCompanionRow>(`${BASE}/${bookId}/reading-progress`, { method: "POST" }),
  getStoryThread: (bookId: string, readingRound?: number) =>
    req<StoryThreadRow[]>(`${BASE}/${bookId}/story-thread${readingRound ? `?round=${encodeURIComponent(readingRound)}` : ""}`),
  getStoryThreadForLog: (bookId: string, logId: string) =>
    req<StoryThreadRow>(`${BASE}/${bookId}/logs/${logId}/story-thread`),
  retryStoryThread: (bookId: string, logId: string) =>
    req<StoryThreadRow[]>(`${BASE}/${bookId}/logs/${logId}/retry`, {
      method: "POST",
    }),
  updateLogNotes: (bookId: string, logId: string, notes: string) =>
    req<LogRow>(`${BASE}/${bookId}/logs/${logId}`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    }),
  generateReflection: (bookId: string) =>
    req<Pick<BookRow, "reflection_text" | "reflection_at">>(
      `${BASE}/${bookId}/reflection`,
      { method: "POST" },
    ),
  getDueReviewCount: () => req<{ count: number }>("/api/reviews/due/count"),
  getDueReviewBooks: () => req<Array<{ id: string; title: string; author: string; cover_url: string | null; due_count: number }>>("/api/reviews/due/books"),
  getDueReviews: (bookId?: string) => req<ReviewCardRow[]>(`/api/reviews/due${bookId ? `?bookId=${encodeURIComponent(bookId)}` : ""}`),
  submitReview: (id: string, remembered: boolean) =>
    req<ReviewCardRow>(`/api/reviews/${id}`, {
      method: "POST",
      body: JSON.stringify({ remembered }),
    }),
  getWeeklyGoal: () => req<WeeklyGoalProgress>("/api/goals/weekly"),
  getTodayDashboard: () => req<TodayDashboard>("/api/today"),
  getTodayInsights: (
    query: { bookId?: string; round?: number; allBooks?: boolean } = {},
  ) => {
    const params = new URLSearchParams();
    if (query.allBooks) params.set("allBooks", "1");
    else {
      if (query.bookId) params.set("bookId", query.bookId);
      if (query.round) params.set("round", String(query.round));
    }
    const suffix = params.toString();
    return req<TodayInsights>(
      `/api/today/insights${suffix ? `?${suffix}` : ""}`,
    );
  },
  getAchievements: () => req<AchievementsResponse>("/api/achievements"),
  getRhythm: (bookId?: string, round?: number) =>
    req<RhythmResponse>(
      `/api/rhythm${bookId ? `?book_id=${encodeURIComponent(bookId)}${round ? `&round=${round}` : ""}` : ""}`,
    ),
  getEntitlements: () => req<EntitlementsResponse>("/api/entitlements/me"),
  getBillingCatalog: () => req<BillingCatalogResponse>("/api/billing/catalog"),
  getBillingMe: () => req<BillingMeResponse>("/api/billing/me"),
  createBillingOrder: (sku: string, requestKey: string) =>
    req<{ status: "created" | "existing"; order: BillingOrder }>(
      "/api/billing/orders",
      { method: "POST", body: JSON.stringify({ sku, requestKey }) },
    ),
  getMembershipPlans: () =>
    req<MembershipPlansResponse>("/api/entitlements/plans"),
  getMonthlyReview: () =>
    req<MonthlyReviewResponse>("/api/monthly-review/current"),
  getAskReading: () => req<AskReadingResponse>("/api/ask-reading/recent"),
  getCrossBookConnections: () =>
    req<CrossBookConnectionsResponse>("/api/cross-book-connections/current"),
  getPodcastRecap: () =>
    req<PodcastRecapResponse>("/api/podcast-recap/current"),
  generatePodcastRecap: (requestKey: string) =>
    req<{
      status: "generated" | "existing" | "no_source" | "voice_required";
      recap: PodcastRecapArtifact | null;
    }>("/api/podcast-recap/generate", {
      method: "POST",
      body: JSON.stringify({ requestKey }),
    }),
  generateCrossBookConnections: (requestKey: string) =>
    req<{
      status: "generated" | "existing" | "no_source";
      connection: CrossBookConnectionArtifact | null;
    }>("/api/cross-book-connections/generate", {
      method: "POST",
      body: JSON.stringify({ requestKey }),
    }),
  answerAskReading: (question: string, requestKey: string) =>
    req<{
      status: "answered" | "existing" | "no_source";
      answer: AskReadingAnswer | null;
    }>("/api/ask-reading/answer", {
      method: "POST",
      body: JSON.stringify({ question, requestKey }),
    }),
  generateMonthlyReview: () =>
    req<{
      status: "generated" | "existing" | "no_source";
      review: MonthlyReviewArtifact | null;
    }>("/api/monthly-review/generate", { method: "POST" }),
  getUpgradePrompts: (bookId: string) =>
    req<UpgradePromptsResponse>(
      `/api/entitlements/prompts?bookId=${encodeURIComponent(bookId)}`,
    ),
  dismissUpgradePrompt: (key: string) =>
    req<void>(`/api/entitlements/prompts/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "dismiss" }),
    }),
  getPodcastCatalog: () => req<PodcastCatalogBook[]>("/api/podcasts/catalog"),
  getBookPodcast: (bookId: string) =>
    req<PodcastCatalogBook>(`/api/podcasts/books/${bookId}`),
  getPodcastPlaylist: (bookId: string) =>
    req<PodcastPlaylist>(`/api/podcasts/books/${bookId}/playlist`),
  savePodcastPlaylistProgress: (bookId: string, podcastId: string, currentTimeSeconds: number, completed: boolean) =>
    req<PodcastPlaylistProgress>(`/api/podcasts/books/${bookId}/playlist/progress`, {
      method: "PUT",
      body: JSON.stringify({ podcast_id: podcastId, current_time_seconds: currentTimeSeconds, completed }),
    }),
  createPodcast: (
    bookId: string,
    chapterKey: string,
    voiceGender?: "female" | "male",
  ) =>
    req<PodcastEpisode>("/api/podcasts", {
      method: "POST",
      body: JSON.stringify({
        book_id: bookId,
        chapter_key: chapterKey,
        voice_gender: voiceGender,
      }),
    }),
  setBookNarrator: (
    bookId: string,
    voiceGender: "female" | "male",
    force = false,
  ) =>
    req<{ ok: boolean; episodes_deleted: number }>(
      `/api/podcasts/books/${bookId}/narrator`,
      {
        method: "POST",
        body: JSON.stringify({ voice_gender: voiceGender, force }),
      },
    ),
  regeneratePodcast: (episodeId: string) =>
    req<PodcastEpisode>(`/api/podcasts/${episodeId}/regenerate`, {
      method: "POST",
    }),
  getOnboarding: () => req<{ dismissed_steps: string[] }>("/api/onboarding"),
  saveOnboarding: (dismissed_steps: string[]) =>
    req<{ dismissed_steps: string[] }>("/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ dismissed_steps }),
    }),
  saveWeeklyGoal: (metric: WeeklyGoalMetric, target: number) =>
    req<WeeklyGoalRow>("/api/goals/weekly", {
      method: "PUT",
      body: JSON.stringify({ metric, target }),
    }),
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
  getStats: () =>
    req<{
      velocity: { date: string; pages_read: number }[];
      insights: { insight: string; freq: number }[];
      bookCounts: {
        active: number;
        finished: number;
        paused: number;
        queued: number;
      };
      globalStats: { total_days_read: number; last_read: string };
    }>("/api/stats"),

  // ── AI Reader / Book Wiki ─────────────────────────────────
  request: <T = any>(url: string, opts?: RequestInit) => req<T>(url, opts),
  getWiki: (bookId: string) => req<any | null>(`${BASE}/${bookId}/wiki`),
  getWikiStatus: (bookId: string) =>
    req<{
      hasFile: boolean;
      totalSessions: number;
      chunksProcessed: number;
      wikiExists: boolean;
      pagesCovered: number;
      wikiGeneratedAt: string | null;
      outputLanguage: "auto" | "vi" | "en";
      schemaVersion: number;
    }>(`${BASE}/${bookId}/wiki/status`),
  regenerateWiki: (bookId: string) =>
    req<{ ok: boolean; updated: boolean }>(
      `${BASE}/${bookId}/wiki/regenerate`,
      { method: "POST" },
    ),
};

export interface UploadResult {
  file_path: string;
  file_type: "pdf" | "epub";
  filename: string;
  size: number;
  books_dir: string;
}

/** The upload endpoint is the authority for the stored path and detected type. */
export function validateUploadResult(body: unknown): UploadResult {
  const result = body as Partial<UploadResult> | null;
  if (
    !result ||
    typeof result.file_path !== "string" ||
    !result.file_path.trim() ||
    (result.file_type !== "pdf" && result.file_type !== "epub") ||
    typeof result.filename !== "string" ||
    !result.filename.trim()
  ) {
    throw new Error("upload completed without a usable file");
  }
  return result as UploadResult;
}

/** Delete an uploaded-but-not-saved file by its stored path. */
export async function deleteUpload(filePath: string): Promise<void> {
  await fetch(`/api/upload?path=${encodeURIComponent(filePath)}`, {
    method: "DELETE",
  });
}

/** Upload a book file (max 100MB) to the server. Returns stored path. */
export async function uploadBook(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const xhr = new XMLHttpRequest();
  return new Promise<UploadResult>((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: any = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(validateUploadResult(body));
        } catch (error) {
          reject(error);
        }
      } else reject(new Error(body?.error || "Could not upload this file. Please try again."));
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
  sort?: "newest" | "oldest" | "mixed";
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
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
  return logs.some((l) => String(l.date).slice(0, 10) === today);
}

/** Compute current streak (consecutive days up to today) from log dates.
 *  Uses LOCAL date (not UTC) so streaks align with the user's calendar day. */
export function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = new Set(
    dates.map((d) => {
      // ISO datetime from server (e.g. "2026-07-20T17:00:00.000Z") needs
      // Asia/Bangkok conversion — the plain slice(0,10) would give the UTC day.
      const s = String(d);
      return s.includes("T")
        ? new Date(s).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
        : s.slice(0, 10);
    }),
  );
  let streak = 0;
  // "Today" in the app timezone (Asia/Bangkok / UTC+7), not the viewer's local tz.
  const parts = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
    .split("-");
  const cur = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
  );
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
      `https://openlibrary.org/search.json?title=${q}&limit=1`,
    );
    const data = await res.json();
    const coverId = data?.docs?.[0]?.cover_i;
    if (!coverId) return null;
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  } catch {
    return null;
  }
}
