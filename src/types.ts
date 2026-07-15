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
  summary: string; // The short summary
  content: string; // The thoughts/reflection
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
