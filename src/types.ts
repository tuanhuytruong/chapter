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
  cover_url?: string;
  created_at: string;
  progress?: number;
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

export interface Comment {
  id: string;
  authorName: string;
  authorAvatar: string;
  authorBio: string;
  content: string;
  timestamp: string;
}

export interface CommunityPost {
  id: string;
  authorName: string;
  authorAvatar: string;
  authorBio: string;
  bookTitle: string;
  bookAuthor: string;
  book_id?: string;       // link back to the reading log's book
  summary: string;        // The short summary
  content: string;        // The thoughts/reflection
  likes: number;
  comments: Comment[];
  timestamp: string;
  isUserPost?: boolean;
}

export interface CommunityPersona {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  specialty: string;
  color: string;
  systemPrompt: string;
}
