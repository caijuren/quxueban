export interface Book {
  id: number;
  name: string;
  author: string;
  isbn: string;
  publisher: string;
  type: string;
  characterTag: string;
  coverUrl: string;
  totalPages: number;
  wordCount?: number;
  suitableAge?: string;
  readCount: number;
  lastReadDate?: string | null;
  activeReadings: Array<{
    id: number;
    childId: number;
    readPages: number;
  }>;
  readState?: {
    id: number;
    status: string;
    finishedAt: string | null;
  } | null;
  totalReadPages: number;
  totalReadMinutes: number;
  readLogCount: number;
}

export interface Child {
  id: number;
  name: string;
  avatar: string;
}

export interface LibraryStats {
  totalBooks: number;
  newThisMonth: number;
  topBooks: Array<{
    id: number;
    name: string;
    coverUrl: string;
    readCount: number;
  }>;
  thisMonthRead: number;
  readingTrend: string;
  favoriteType: string;
  finishedBooks: number;
  totalPages: number;
  totalWords: number;
  totalMinutes: number;
  totalHours: number;
  remainingMinutes: number;
}

export interface BorrowRecord {
  id: string;
  bookId: number;
  borrowerName: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'borrowed' | 'returned' | 'overdue';
}

export interface BookList {
  id: string;
  name: string;
  bookIds: number[];
  createdAt: string;
}

export type BookType = 'children' | 'tradition' | 'science' | 'character' | 'other';
export type ReadStatus = 'all' | 'finished' | 'reading' | 'unread';
export type ViewMode = 'grid' | 'list';
export type AddMode = 'manual' | 'isbn' | 'search';

export interface BookTypeOption {
  value: BookType;
  label: string;
}

export interface ReadStage {
  value: string;
  label: string;
}

export const bookTypes: BookTypeOption[] = [
  { value: 'children', label: '儿童故事' },
  { value: 'tradition', label: '传统文化' },
  { value: 'science', label: '科普' },
  { value: 'character', label: '性格养成' },
  { value: 'other', label: '其他' },
];

export const readStages: ReadStage[] = [
  { value: '小班', label: '小班' },
  { value: '中班', label: '中班' },
  { value: '大班', label: '大班' },
  { value: '一年级', label: '一年级' },
];

export const ageRanges = [
  { value: 'all', label: '全部' },
  { value: '0-3', label: '0-3岁' },
  { value: '3-6', label: '3-6岁' },
  { value: '6-9', label: '6-9岁' },
  { value: '9-12', label: '9-12岁' },
  { value: '12+', label: '12岁+' },
];

export const sortOptions = [
  { value: '', label: '默认' },
  { value: 'recently_finished', label: '最近读完' },
  { value: 'most_pages', label: '页数最多' },
  { value: 'most_minutes', label: '时长最长' },
];

export const readStatusOptions = [
  { value: 'all', label: '全部' },
  { value: 'finished', label: '已读完' },
  { value: 'reading', label: '在读中' },
  { value: 'unread', label: '未开始' },
];
