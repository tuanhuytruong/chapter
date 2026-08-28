export interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  startDate?: string;
  endDate?: string;
  status: "reading" | "completed" | "to_read";
  coverUrl?: string;
  rating?: number;
  dailyTargetPages?: number;
  notes?: string;
}

export interface ReadingLog {
  id: string;
  bookId: string;
  date: string;
  pagesRead: number;
  summary?: string;
  // Extended for AI Daily Book Reading Companion
  pageStart?: number;
  pageEnd?: number;
  rawText?: string;
  keyInsights?: string[];
  quote?: string | null;
  telegramSent?: boolean;
}

// New server-side DB row shapes (snake_case from Postgres)
export type SummaryMode = "casual" | "deep_reading";
export type ReadingExperience = "analytical" | "story";

export interface BookRow {
  id: string;
  title: string;
  author: string;
  file_path: string;
  file_type: "pdf" | "epub";
  status: "active" | "paused" | "finished" | "queued";
  current_page: number;
  current_reading_round: number;
  total_pages: number;
  daily_pages: number;
  queue_order?: number;
  summary_lang: "auto" | "vi" | "en";
  summary_mode: SummaryMode;
  reading_experience: ReadingExperience;
  cover_url?: string;
  reflection_text?: string | null;
  reflection_at?: string | null;
  /** Owner-private reason for choosing this book; never exposed to shared readers. */
  reading_intention?: string | null;
  created_at: string;
  progress?: number;
  owner_id?: string | null;
  owner_name?: string | null;
  can_edit?: boolean;
}

export type ReadingLensAnalysis = {
  coreArgument: string;
  argumentMap: Array<{ claim: string; support: string; implication: string }>;
  assumptionsAndLimits: string[];
  keyConcepts: Array<{ term: string; definition: string }>;
  questionsToCarryForward: string[];
  durableInsights: string[];
  quote: string | null;
  confidenceNotes: string[];
};

export interface ReadingRoundRow {
  reading_round: number;
  status: "active" | "paused" | "finished" | "queued";
  started_at: string;
  finished_at: string | null;
  final_page: number;
}

export interface ReadingProgressItem { text: string; refs: Array<{ logId: string; session: number; pageStart: number; pageEnd: number }>; }
export interface ReadingProgressCompanionRow { book_id: string; reading_round: number; schema_version: number; main_thread: ReadingProgressItem; converging: ReadingProgressItem[]; open_threads: ReadingProgressItem[]; carry_forward: ReadingProgressItem[]; output_language: "vi" | "en"; sessions_covered: number; last_log_id: string | null; last_log_date: string | null; last_log_session: number | null; source_revision: number; stale: boolean; generated_at: string; }

export interface ReadingLensRow {
  id: string;
  book_id: string;
  log_id: string;
  schema_version: number;
  analysis: ReadingLensAnalysis;
  analyst_summary: string;
  generated_at: string;
}

export type StoryThreadStatus =
  "open" | "escalating" | "resolved" | "uncertain";
export interface StoryThreadAnalysis {
  storyRecap: string;
  changedEvents: string[];
  threads: Array<{
    id: string;
    label: string;
    status: StoryThreadStatus;
    detail: string;
  }>;
  characterPulse: Array<{ name: string; pulse: string }>;
  readerMemory: string[];
  confidenceNotes: string[];
}
export interface StoryThreadRow {
  id: string;
  book_id: string;
  log_id: string;
  schema_version: number;
  analysis: StoryThreadAnalysis;
  story_recap: string;
  generated_at: string;
  reading_round: number;
  session: number;
  page_start: number;
  page_end: number;
}

export type ReadingMarkerKind = "idea" | "question" | "quote" | "return_to";

export interface ReadingMarkerRow {
  id: string;
  book_id: string;
  log_id: string;
  reading_round: number;
  page_position: number;
  kind: ReadingMarkerKind;
  note: string;
  created_at: string;
  session: number;
  page_start: number;
  page_end: number;
  position_label: string;
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
