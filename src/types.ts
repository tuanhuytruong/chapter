export interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  startDate?: string;
  endDate?: string;
  status: 'reading' | 'completed' | 'to_read';
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

export interface BookRow {
  id: string;
  title: string;
  author: string;
  file_path: string;
  file_type: "pdf" | "epub";
  status: "active" | "paused" | "finished" | "queued";
  current_page: number;
  total_pages: number;
  daily_pages: number;
  queue_order?: number;
  summary_lang: "auto" | "vi" | "en";
  summary_mode: SummaryMode;
  cover_url?: string;
  reflection_text?: string | null;
  reflection_at?: string | null;
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

export interface ReadingLensRow {
  id: string; book_id: string; log_id: string; schema_version: number;
  analysis: ReadingLensAnalysis; analyst_summary: string; generated_at: string;
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
