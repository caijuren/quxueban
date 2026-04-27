import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  BookOpen,
  Upload,
  X,
  Library as LibraryIcon,
  Loader2,
  CheckCircle2,
  Bookmark,
  FolderHeart,
  History,
  Clock3,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import type { ReactNode } from 'react';
import { PageToolbar, PageToolbarTitle } from '@/components/parent/PageToolbar';

// Import components
import { BookCard, BookFilter, EmptyState } from '@/components/parent/library';
import type { Book, BookList, ReadStatus } from '@/types/library';
import { bookTypes } from '@/types/library';

// Schema
const bookSchema = z.object({
  name: z.string().min(1, '请输入书名'),
  author: z.string().optional(),
  isbn: z.string().optional(),
  publisher: z.string().optional(),
  type: z.enum(['children', 'tradition', 'science', 'character', 'other']),
  characterTag: z.string().optional(),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  totalPages: z.number().min(0, '页数不能为负数').optional(),
  wordCount: z.number().min(0, '字数不能为负数').optional(),
  childId: z.number().optional(),
});

type BookFormData = z.infer<typeof bookSchema>;

function normalizeBookType(type?: string): BookFormData['type'] {
  if (type === 'children' || type === 'tradition' || type === 'science' || type === 'character' || type === 'other') {
    return type;
  }
  return 'children';
}

// API functions
async function fetchBooks(search?: string, type?: string, sortBy?: string, childId?: number): Promise<Book[]> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (type && type !== 'all') params.append('type', type);
  if (sortBy) params.append('sortBy', sortBy);
  if (childId) params.append('childId', String(childId));
  const { data } = await apiClient.get(`/library?${params}`);
  return data.data || [];
}

async function fetchBookByISBN(isbn: string): Promise<any> {
  const { data } = await apiClient.get(`/library/fetch-by-isbn/${isbn}`);
  return data.data;
}

async function searchBooksByTitle(title: string, filters?: { author?: string; publisher?: string; publishYear?: string }): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.author) params.append('author', filters.author);
    if (filters?.publisher) params.append('publisher', filters.publisher);
    if (filters?.publishYear) params.append('publishYear', filters.publishYear);
    const query = params.toString();
    const { data } = await apiClient.get(`/library/search-by-title/${encodeURIComponent(title)}${query ? `?${query}` : ''}`);
    return data.data || [];
  } catch (error) {
    console.error('[Search] Error:', error);
    throw error;
  }
}

async function createBook(book: BookFormData): Promise<Book> {
  const { data } = await apiClient.post('/library', book);
  return data.data;
}

async function updateBook(id: number, book: Partial<BookFormData>): Promise<Book> {
  const { data } = await apiClient.put(`/library/${id}`, book);
  return data.data;
}

async function deleteBook(id: number): Promise<void> {
  await apiClient.delete(`/library/${id}`);
}

const getScopedStorageKey = (key: string, childId: number | null) => `${key}_${childId ?? 'pending'}`;

function getBookReadStatus(book: Book): { label: string; className: string; detail: string } {
  if (book.readState?.status === 'finished') {
    return { label: '已读完', className: 'bg-emerald-100 text-emerald-700', detail: '已读完' };
  }
  if (book.readState?.status === 'reading') {
    return { label: '在读中', className: 'bg-blue-100 text-blue-700', detail: '阅读中' };
  }
  return { label: '未记录', className: 'bg-slate-100 text-slate-600', detail: '暂无阅读状态' };
}

function hasReadingState(book: Book) {
  return book.readState?.status === 'reading' || book.readState?.status === 'finished';
}

function isReadingBook(book: Book) {
  return book.readState?.status === 'reading';
}

function isFinishedBook(book: Book) {
  return book.readState?.status === 'finished';
}

function isUnrecordedBook(book: Book) {
  return !hasReadingState(book);
}

function getBookProgressPages(book: Book) {
  if (book.readState?.status === 'finished' && book.totalPages > 0) return book.totalPages;
  const activeReadPages = Math.max(...(book.activeReadings || []).map(reading => reading.readPages || 0), 0);
  return Math.max(activeReadPages, book.totalReadPages || 0);
}

function getBookProgressPercent(book: Book): number {
  if (!book.totalPages || book.totalPages <= 0) return 0;
  return Math.min(100, Math.round((getBookProgressPages(book) / book.totalPages) * 100));
}

function CoverSlot({ book, className }: { book?: Partial<Book> | null; className?: string }) {
  if (book?.coverUrl) {
    return <img src={book.coverUrl} alt={book.name || '书籍封面'} className={cn('h-full w-full object-cover', className)} />;
  }

  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50 text-slate-300', className)}>
      <BookOpen className="h-8 w-8" />
    </div>
  );
}

function LibraryMetric({
  icon,
  label,
  value,
  unit,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  unit: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', tone)}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-950">
          {value}<span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const { selectedChildId, selectedChild } = useSelectedChild();
  const storageKeys = useMemo(() => ({
    bookLists: getScopedStorageKey('library_book_lists', selectedChildId),
    importHistory: getScopedStorageKey('library_import_history', selectedChildId),
  }), [selectedChildId]);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedReadStatus, setSelectedReadStatus] = useState<ReadStatus>('all');
  const [sortBy, setSortBy] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [formReturnTo, setFormReturnTo] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStats, setImportStats] = useState({ imported: 0, skipped: 0 });

  // Add form state
  const [addMode, setAddMode] = useState<'manual' | 'isbn' | 'search'>('manual');
  const [isbnInput, setIsbnInput] = useState('');
  const [titleSearch, setTitleSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isbnLoading, setIsbnLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<50 | 100>(50);

  // Book lists
  const [bookLists, setBookLists] = useState<BookList[]>([]);
  const [showBookListDialog, setShowBookListDialog] = useState(false);
  const [newListName, setNewListName] = useState('');

  // Import history
  const [importHistory, setImportHistory] = useState<Array<{ date: string; count: number; filename: string }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      name: '',
      author: '',
      type: 'children',
      characterTag: '',
      description: '',
      coverUrl: '',
      totalPages: 0,
      wordCount: 0,
    },
  });

  const selectedTypeValue = watch('type');
  const coverUrl = watch('coverUrl');

  useEffect(() => {
    setBookLists(JSON.parse(localStorage.getItem(storageKeys.bookLists) || '[]'));
    setImportHistory(JSON.parse(localStorage.getItem(storageKeys.importHistory) || '[]'));
  }, [storageKeys]);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['library', searchQuery, selectedType, sortBy, selectedChildId],
    queryFn: () => fetchBooks(searchQuery, selectedType, sortBy, selectedChildId || undefined),
    enabled: !!selectedChildId,
  });

  // Filter books
  const filteredBooks = useMemo(() => {
    let result = books;

    if (searchInput.trim()) {
      const query = searchInput.toLowerCase().trim();
      result = result.filter(book =>
        book.name.toLowerCase().includes(query) ||
        (book.author && book.author.toLowerCase().includes(query)) ||
        (book.publisher && book.publisher.toLowerCase().includes(query)) ||
        (book.description && book.description.toLowerCase().includes(query)) ||
        (book.characterTag && book.characterTag.toLowerCase().includes(query))
      );
    }

    if (selectedReadStatus !== 'all') {
      result = result.filter(book => {
        if (selectedReadStatus === 'finished') {
          return isFinishedBook(book);
        }
        if (selectedReadStatus === 'reading') {
          return isReadingBook(book);
        }
        return true;
      });
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'recently_finished') {
        return new Date(b.readState?.finishedAt || 0).getTime() - new Date(a.readState?.finishedAt || 0).getTime();
      }
      if (sortBy === 'most_pages') {
        return (b.totalReadPages || 0) - (a.totalReadPages || 0);
      }
      if (sortBy === 'most_minutes') {
        return (b.totalReadMinutes || 0) - (a.totalReadMinutes || 0);
      }

      const aFinished = a.readState?.status === 'finished' ? 1 : 0;
      const bFinished = b.readState?.status === 'finished' ? 1 : 0;
      if (aFinished !== bFinished) return aFinished - bFinished;

      const aTime = new Date(a.lastReadDate || a.readState?.finishedAt || 0).getTime();
      const bTime = new Date(b.lastReadDate || b.readState?.finishedAt || 0).getTime();
      return bTime - aTime;
    });
  }, [books, selectedReadStatus, searchInput, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchInput, selectedType, selectedReadStatus, sortBy, selectedChildId, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedBooks = filteredBooks.slice(pageStartIndex, pageStartIndex + pageSize);
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredBooks.length);
  const currentReadingBooks = useMemo(
    () => books.filter(isReadingBook),
    [books]
  );
  const finishedBooksList = useMemo(
    () => books.filter(isFinishedBook),
    [books]
  );
  const featuredReadingBook = currentReadingBooks[0] || null;
  const totalReadPages = useMemo(
    () => books.reduce((sum, book) => sum + (book.totalReadPages || 0), 0),
    [books]
  );
  const thisMonthRead = useMemo(() => {
    const now = new Date();
    return finishedBooksList.filter((book) => {
      if (!book.readState?.finishedAt) return false;
      const finishedAt = new Date(book.readState.finishedAt);
      return finishedAt.getFullYear() === now.getFullYear() && finishedAt.getMonth() === now.getMonth();
    }).length;
  }, [finishedBooksList]);
  const totalReadMinutes = books.reduce((sum, book) => sum + (book.totalReadMinutes || 0), 0);
  const readingHours = totalReadMinutes > 0 ? (totalReadMinutes / 60).toFixed(1) : '0.0';
  const recentReadingItems = useMemo(() => (
    books
      .filter(book => hasReadingState(book) || (book.readLogCount || 0) > 0)
      .sort((a, b) => {
        const aTime = new Date(a.lastReadDate || a.readState?.finishedAt || 0).getTime();
        const bTime = new Date(b.lastReadDate || b.readState?.finishedAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 3)
  ), [books]);
  const recentReadingDays = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return new Set(
      books
        .map(book => book.lastReadDate || book.readState?.finishedAt)
        .filter((date): date is string => Boolean(date))
        .map(date => new Date(date))
        .filter(date => date >= start && date <= now)
        .map(date => date.getDay())
    );
  }, [books]);
  const ensureSelectedChild = (action: () => void, message = '请先在左侧选择孩子，再继续管理图书馆') => {
    if (!selectedChildId) {
      toast.error(message);
      return;
    }
    action();
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: createBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
      toast.success('图书添加成功');
      closeForm();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BookFormData> }) => updateBook(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['book', String(variables.id)] });
      queryClient.invalidateQueries({ queryKey: ['book', variables.id] });
      toast.success('图书更新成功');
      closeForm();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
      toast.success('图书已删除');
      setDeleteDialogOpen(false);
      setBookToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Handlers
  const handleISBNLookup = async () => {
    if (!isbnInput.trim()) {
      toast.error('请输入ISBN号');
      return;
    }
    setIsbnLoading(true);
    try {
      const bookData = await fetchBookByISBN(isbnInput.trim());
      if (bookData) {
        setValue('name', bookData.name || '');
        setValue('author', bookData.author || '');
        setValue('isbn', bookData.isbn || '');
        setValue('publisher', bookData.publisher || '');
        setValue('coverUrl', bookData.coverUrl || '');
        setValue('totalPages', bookData.totalPages || 0);
        toast.success('已自动填充书籍信息');
      } else {
        toast.error('未找到该ISBN对应的书籍');
      }
    } catch (error) {
      toast.error('查询失败，请检查ISBN是否正确');
    } finally {
      setIsbnLoading(false);
    }
  };

  const handleTitleSearch = async () => {
    if (!titleSearch.trim()) {
      toast.error('请输入书名');
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchBooksByTitle(titleSearch.trim(), {
        author: watch('author') || undefined,
        publisher: watch('publisher') || undefined,
      });
      setSearchResults(results);
      if (results.length === 0) {
        toast.info('未找到相关书籍，请尝试手动输入');
      }
    } catch (error) {
      toast.error('搜索暂时不可用，请手动输入');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (book: any) => {
    setValue('name', book.name || '');
    setValue('author', book.author || '');
    setValue('coverUrl', book.coverUrl || '');
    setValue('totalPages', book.totalPages || 0);
    setAddMode('manual');
    toast.success('已填充书籍信息，可继续编辑');
  };

  const onSubmit = (data: BookFormData) => {
    const form = document.getElementById('book-form') as HTMLFormElement | null;
    const formDescription = form ? String(new FormData(form).get('description') || '') : '';
    const normalizedData = {
      ...data,
      type: normalizeBookType(data.type),
      description: data.description ?? formDescription,
    };
    if (editingBook) {
      updateMutation.mutate({ id: editingBook.id, data: normalizedData });
    } else {
      createMutation.mutate({ ...normalizedData, childId: selectedChildId || undefined });
    }
  };

  const closeForm = () => {
    const returnPath = formReturnTo;
    setEditingBook(null);
    setShowAddForm(false);
    setFormReturnTo(null);
    reset();
    setAddMode('manual');
    setIsbnInput('');
    setTitleSearch('');
    setSearchResults([]);
    if (returnPath) {
      navigate(returnPath, { replace: true });
    }
  };

  const handleEdit = useCallback((book: Book, returnTo?: string) => {
    setEditingBook(book);
    setFormReturnTo(returnTo || null);
    reset({
      name: book.name,
      author: book.author,
      isbn: book.isbn,
      publisher: book.publisher,
      type: normalizeBookType(book.type),
      characterTag: book.characterTag,
      description: book.description || '',
      coverUrl: book.coverUrl,
      totalPages: book.totalPages,
      wordCount: book.wordCount || 0,
    });
    setShowAddForm(true);
  }, [reset]);

  useEffect(() => {
    const state = location.state as { editBookId?: number; returnTo?: string } | null;
    if (!state || books.length === 0) return;

    const targetBook = books.find((book) => book.id === Number(state.editBookId));
    if (!targetBook) return;

    if (state.editBookId) {
      handleEdit(targetBook, state.returnTo);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [books, handleEdit, location.pathname, location.state, navigate]);

  const handleDelete = (book: Book) => {
    setBookToDelete(book);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (bookToDelete) {
      deleteMutation.mutate(bookToDelete.id);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过2MB');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('cover', file);
      const { data } = await apiClient.post('/library/upload-cover', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedCoverUrl = data?.data?.coverUrl || data?.coverUrl;
      if (uploadedCoverUrl) {
        setValue('coverUrl', uploadedCoverUrl);
        toast.success('封面上传成功');
      } else {
        toast.error('上传成功，但没有返回封面链接');
      }
    } catch (error) {
      toast.error(getErrorMessage(error) || '上传失败，请重试');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error('请选择Excel文件 (.xlsx, .xls 或 .csv)');
      return;
    }
    setImporting(true);
    setImportResult(null);
    setImportProgress(0);
    setImportStats({ imported: 0, skipped: 0 });
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedChildId) {
        formData.append('childId', selectedChildId.toString());
      }
      const token = localStorage.getItem('auth_token');
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${baseUrl}/library/import`, {
        method: 'POST',
        body: formData,
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `导入失败: ${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        for (const line of lines.slice(0, -1)) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.status === 'progress') {
                setImportProgress(data.data.progress);
                setImportStats({ imported: data.data.imported, skipped: data.data.skipped });
              } else if (data.status === 'success') {
                setImportResult(data.data);
                queryClient.invalidateQueries({ queryKey: ['library'] });
                queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
                toast.success(data.message);
                const newHistoryItem = { date: new Date().toISOString(), count: data.data.imported || 0, filename: file.name };
                const newHistory = [newHistoryItem, ...importHistory].slice(0, 10);
                setImportHistory(newHistory);
                localStorage.setItem(storageKeys.importHistory, JSON.stringify(newHistory));
              } else if (data.status === 'error') {
                throw new Error(data.message);
              }
            } catch (error) {
              if (error instanceof Error && error.message.startsWith('导入失败')) {
                throw error;
              }
            }
          }
        }
        buffer = lines[lines.length - 1] || '';
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setImporting(false);
      setImportProgress(0);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleExportBooks = () => {
    const dataStr = JSON.stringify(books, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `library-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('书籍数据已导出');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={`stats-${i}`} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!selectedChildId) {
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 shadow-sm">
          <CardContent className="p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">当前孩子视角</Badge>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">先选择孩子，再进入图书馆</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  图书馆按孩子独立管理。选择当前孩子后，页面会只展示这个孩子的书目、阅读进度、阅读记录和习惯养成辅助信息。
                </p>
              </div>
              <div className="rounded-3xl border border-indigo-100 bg-white/90 p-5 shadow-sm">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <LibraryIcon className="size-7" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">建议下一步</p>
                <p className="mt-1 text-sm text-muted-foreground">在左侧切换当前孩子后，再添加图书或导入书单。</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['书目管理', '按孩子维护个人书库、分类、封面和阅读阶段。'],
            ['阅读进度', '聚焦这个孩子的在读书、已读书和阅读记录。'],
            ['习惯养成', '将目标、打卡、阅读记录和书单都放在同一个孩子上下文里。'],
          ].map(([title, description]) => (
            <Card key={title} className="rounded-2xl border border-border/70 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1360px] space-y-5">
      <PageToolbar
        left={
          <PageToolbarTitle
            icon={LibraryIcon}
            title="图书馆"
            description={`${selectedChild?.name || '当前孩子'}的书库、阅读状态和图书导入管理`}
          />
        }
        right={
          <>
            <Button
              variant="outline"
              onClick={() => ensureSelectedChild(() => importInputRef.current?.click(), '请先选择孩子，再导入图书')}
              className="h-11 rounded-xl bg-white"
            >
              <Upload className="mr-1.5 size-4" />
              导入
            </Button>
            <Button
              onClick={() => ensureSelectedChild(() => setShowAddForm(true), '请先选择孩子，再添加图书')}
              className="h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm hover:from-indigo-600 hover:to-violet-600"
            >
              <Plus className="mr-1.5 size-4" />
              添加图书
            </Button>
          </>
        }
      />
      <section className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="grid gap-5 rounded-2xl border border-border bg-white p-5 shadow-sm md:grid-cols-4">
          <LibraryMetric
            icon={<BookOpen className="h-7 w-7 text-primary" />}
            label="在读书籍"
            value={currentReadingBooks.length}
            unit="本"
            hint="继续阅读"
            tone="bg-violet-100"
          />
          <LibraryMetric
            icon={<CheckCircle2 className="h-7 w-7 text-emerald-600" />}
            label="已读书籍"
            value={finishedBooksList.length}
            unit="本"
            hint="已完成阅读"
            tone="bg-emerald-100"
          />
          <LibraryMetric
            icon={<Bookmark className="h-7 w-7 text-orange-500" />}
            label="阅读总页数"
            value={totalReadPages.toLocaleString()}
            unit="页"
            hint="来自阅读记录"
            tone="bg-orange-100"
          />
          <LibraryMetric
            icon={<Clock3 className="h-7 w-7 text-indigo-600" />}
            label="阅读时长"
            value={readingHours}
            unit="小时"
            hint="累计记录"
            tone="bg-indigo-100"
          />
        </div>

        <div className="rounded-2xl border border-border bg-gradient-to-br from-white to-violet-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">阅读习惯养成</h2>
            <HelpCircle className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {recentReadingDays.size > 0 ? `近 7 天有 ${recentReadingDays.size} 天阅读记录` : '开始记录后展示阅读习惯'}
          </p>
          <div className="mt-6 grid grid-cols-7 gap-2">
            {[
              ['一', 1],
              ['二', 2],
              ['三', 3],
              ['四', 4],
              ['五', 5],
              ['六', 6],
              ['日', 0],
            ].map(([day, dayIndex]) => (
              <div key={day} className="flex flex-col items-center gap-2">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-white', recentReadingDays.has(dayIndex as number) ? 'bg-primary' : 'bg-slate-200')}>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-xs text-slate-500">{day}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">最近在读</h2>
            <button
              className={cn('text-sm font-medium', featuredReadingBook ? 'text-primary' : 'text-slate-400')}
              onClick={() => featuredReadingBook && navigate(`/parent/library/${featuredReadingBook.id}`)}
              disabled={!featuredReadingBook}
            >
              继续阅读 &gt;
            </button>
          </div>
          {featuredReadingBook ? (
            <div className="mt-5 flex flex-col gap-5 md:flex-row">
              <div className="h-48 w-32 shrink-0 overflow-hidden rounded-lg bg-slate-100 shadow-lg shadow-slate-200">
                <CoverSlot book={featuredReadingBook} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <h3 className="text-xl font-semibold text-slate-950">{featuredReadingBook.name}</h3>
                <p className="mt-3 text-sm text-slate-500">{featuredReadingBook.author || '未知作者'}</p>
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">阅读进度</span>
                    <span className="font-medium text-slate-700">{getBookProgressPercent(featuredReadingBook)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${getBookProgressPercent(featuredReadingBook)}%` }} />
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-500">已读 {getBookProgressPages(featuredReadingBook)}/{featuredReadingBook.totalPages || '?'} 页</p>
                <p className="mt-2 text-sm text-slate-500">阅读时长：{featuredReadingBook.totalReadMinutes || 0} 分钟</p>
                <Button onClick={() => navigate(`/parent/library/${featuredReadingBook.id}`)} className="mt-5 h-10 w-fit rounded-xl bg-primary px-6 text-white hover:bg-primary/90">
                  继续阅读
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">暂无在读图书</p>
              <Button onClick={() => ensureSelectedChild(() => setShowAddForm(true))} variant="outline" className="mt-4 rounded-xl bg-white">
                添加第一本书
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">阅读记录</h2>
            <span className="text-sm font-medium text-slate-400">按最近阅读展示</span>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {recentReadingItems.length > 0 ? recentReadingItems.map((book) => {
              const status = getBookReadStatus(book);
              return (
              <div key={book.id} className="flex items-center gap-4 py-3.5">
                <div className="h-16 w-12 overflow-hidden rounded-md bg-gradient-to-br from-slate-100 to-indigo-50">
                  <CoverSlot book={book} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-950">{book.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{status.detail}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-medium', status.className)}>
                  {status.label}
                </span>
              </div>
              );
            }) : (
              <div className="py-10 text-center text-sm text-slate-500">暂无阅读记录</div>
            )}
          </div>
        </div>
      </section>

      {/* Page Control Bar */}
      <BookFilter
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedReadStatus={selectedReadStatus}
        onReadStatusChange={setSelectedReadStatus}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onImportClick={() => ensureSelectedChild(() => importInputRef.current?.click(), '请先选择孩子，再导入图书')}
        onAddClick={() => ensureSelectedChild(() => setShowAddForm(true), '请先选择孩子，再添加图书')}
        onExportClick={handleExportBooks}
        importing={importing}
        importProgress={importProgress}
        resultCount={filteredBooks.length}
      />

      <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />

      {/* Import Result & History */}
      {(importResult || importHistory.length > 0) && (
        <Card className="border border-border/70 rounded-2xl overflow-hidden shadow-sm">
          <CardContent className="p-5">
            {importResult && (
              <div className="mb-4 pb-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      导入完成
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      成功导入 {importResult.imported} 本图书
                      {importResult.createdBooks > 0 && `，新建 ${importResult.createdBooks} 本`}
                      {importResult.matchedBooks > 0 && `，匹配 ${importResult.matchedBooks} 本已有图书`}
                      {importResult.skipped > 0 && `，跳过 ${importResult.skipped} 条`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setImportResult(null)}>关闭</Button>
                </div>
              </div>
            )}
            {importHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    导入历史
                  </h4>
                </div>
                <div className="space-y-2">
                  {importHistory.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{new Date(item.date).toLocaleDateString('zh-CN')}</span>
                        <span className="text-foreground truncate max-w-[150px]">{item.filename}</span>
                      </div>
                      <Badge variant="secondary">+{item.count} 本</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Book Lists */}
      {bookLists.length > 0 && (
        <Card className="border border-border rounded-xl overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                  <FolderHeart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{selectedChild?.name || '当前孩子'}的书单</h3>
                  <p className="text-sm text-muted-foreground">共 {bookLists.length} 个书单</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowBookListDialog(true)}>
                <Plus className="w-4 h-4 mr-1" />新建书单
              </Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {bookLists.map((list) => (
                <div key={list.id} className="flex-shrink-0 w-48 bg-muted/50 rounded-xl p-4 cursor-pointer hover:bg-muted transition-colors group">
                  <div className="flex items-start justify-between mb-2">
                    <Bookmark className="w-5 h-5 text-pink-500" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newLists = bookLists.filter(l => l.id !== list.id);
                        setBookLists(newLists);
                        localStorage.setItem(storageKeys.bookLists, JSON.stringify(newLists));
                        toast.success('书单已删除');
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                  <h4 className="font-medium text-foreground truncate">{list.name}</h4>
                  <p className="text-sm text-muted-foreground">{list.bookIds.length} 本书</p>
                  <div className="flex gap-1 mt-2">
                    {list.bookIds.slice(0, 3).map((bookId, idx) => {
                      const book = books.find(b => b.id === bookId);
                      return book?.coverUrl ? (
                        <img key={idx} src={book.coverUrl} alt="" className="w-8 h-10 object-cover rounded" />
                      ) : (
                        <div key={idx} className="w-8 h-10 bg-muted rounded flex items-center justify-center">
                          <BookOpen className="w-3 h-3 text-muted-foreground" />
                        </div>
                      );
                    })}
                    {list.bookIds.length > 3 && (
                      <div className="w-8 h-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">+{list.bookIds.length - 3}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Books Grid/List */}
      {filteredBooks.length === 0 ? (
        <EmptyState
          hasBooks={books.length > 0}
          onAddByISBN={() => { setShowAddForm(true); setAddMode('isbn'); }}
          onImport={() => ensureSelectedChild(() => importInputRef.current?.click(), '请先选择孩子，再导入图书')}
          onManualAdd={() => { setShowAddForm(true); setAddMode('manual'); }}
          onClearFilters={() => {
            setSearchInput('');
            setSelectedType('all');
            setSelectedReadStatus('all');
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {paginatedBooks.map((book, index) => (
              <BookCard
                key={book.id}
                book={book}
                index={index}
                onDelete={handleDelete}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              显示 {pageStartIndex + 1}-{pageEndIndex} 本，共 {filteredBooks.length} 本
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">每页</span>
              {[50, 100].map((size) => (
                <Button
                  key={size}
                  type="button"
                  variant={pageSize === size ? 'default' : 'outline'}
                  size="sm"
                  className="h-9 rounded-lg"
                  onClick={() => setPageSize(size as 50 | 100)}
                >
                  {size}
                </Button>
              ))}
              <div className="mx-1 h-5 w-px bg-border" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                上一页
              </Button>
              <span className="min-w-16 text-center text-sm font-medium text-foreground">
                {safeCurrentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                下一页
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={closeForm}>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={closeForm} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-slate-50/70 p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                    {editingBook ? '编辑模式' : '新增模式'}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    当前孩子：{selectedChild?.name || '未选择'}
                  </Badge>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
                  {editingBook ? '编辑图书信息' : '为当前孩子添加图书'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  先确定录入方式，再补充基础信息、阅读属性和展示信息。这样后面做统计和筛选也会更稳定。
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeForm} className="rounded-full"><X className="w-5 h-5" /></Button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {!editingBook && (
                <div className="mb-6 rounded-2xl border border-border bg-slate-50/70 p-4">
                  <div className="mb-3">
                    <Label className="text-sm font-medium text-gray-700">录入方式</Label>
                    <p className="mt-1 text-xs text-muted-foreground">先选择最顺手的方式，识别到的信息会自动带入下面的表单。</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {([
                      { value: 'manual', title: '手动输入', description: '适合录入家里已有的图书。' },
                      { value: 'isbn', title: 'ISBN 查询', description: '适合通过封底 ISBN 快速带入信息。' },
                      { value: 'search', title: '书名搜索', description: '适合先查找，再补全细节。' },
                    ] as const).map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setAddMode(mode.value)}
                        className={cn(
                          'rounded-2xl border px-4 py-4 text-left transition-all',
                          addMode === mode.value
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        )}
                      >
                        <p className={cn('text-sm font-semibold', addMode === mode.value ? 'text-primary' : 'text-foreground')}>{mode.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{mode.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!editingBook && addMode === 'isbn' && (
                <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50/80 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1">
                      <Label className="text-sm font-medium text-gray-700">输入 ISBN 号</Label>
                      <Input
                        value={isbnInput}
                        onChange={(e) => setIsbnInput(e.target.value)}
                        placeholder="输入 10 位或 13 位 ISBN 号"
                        className="mt-2 h-12 rounded-xl bg-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleISBNLookup()}
                      />
                    </div>
                    <Button type="button" onClick={handleISBNLookup} disabled={isbnLoading} className="h-12 rounded-xl px-6">
                      {isbnLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : '查询并填充'}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">ISBN 通常印在书籍封底，形如 `978-7-xxx-xxxxx-x`。</p>
                </div>
              )}

              {!editingBook && addMode === 'search' && (
                <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1">
                      <Label className="text-sm font-medium text-gray-700">按书名搜索</Label>
                      <Input
                        value={titleSearch}
                        onChange={(e) => setTitleSearch(e.target.value)}
                        placeholder="输入书名搜索"
                        className="mt-2 h-12 rounded-xl bg-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleTitleSearch()}
                      />
                    </div>
                    <Button type="button" onClick={handleTitleSearch} disabled={isSearching} className="h-12 rounded-xl px-6">
                      {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : '搜索'}
                    </Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-4 grid gap-2">
                      {searchResults.map((book, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSearchResult(book)}
                          className="flex items-center gap-3 rounded-2xl border border-white bg-white/90 p-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt={book.name} className="h-16 w-12 rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-gray-100">
                              <BookOpen className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">{book.name}</p>
                            <p className="mt-1 truncate text-xs text-gray-500">{book.author || '未知作者'}</p>
                          </div>
                          <span className="text-xs font-medium text-emerald-600">选用</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <form id="book-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-foreground">基础信息</p>
                      <p className="mt-1 text-xs text-muted-foreground">这些字段决定书目识别、排序和后续搜索效果。</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Label className="text-sm font-medium text-gray-700">书名 *</Label>
                        <Input {...register('name')} placeholder="输入书名" className="mt-2 h-12 rounded-xl bg-gray-50 border-0" />
                        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">作者</Label>
                        <Input {...register('author')} placeholder="输入作者" className="mt-2 h-12 rounded-xl bg-gray-50 border-0" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">出版社</Label>
                        <Input {...register('publisher')} placeholder="输入出版社" className="mt-2 h-12 rounded-xl bg-gray-50 border-0" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">ISBN</Label>
                        <Input {...register('isbn')} placeholder="输入 ISBN 号" className="mt-2 h-12 rounded-xl bg-gray-50 border-0" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-foreground">阅读属性</p>
                      <p className="mt-1 text-xs text-muted-foreground">用于后续筛选、推荐和阅读记录管理。</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Label className="text-sm font-medium text-gray-700">图书类型</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
                          {bookTypes.map((type) => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setValue('type', type.value as any)}
                              className={cn(
                                'rounded-xl border px-3 py-3 text-xs font-medium transition-all',
                                selectedTypeValue === type.value
                                  ? 'border-transparent bg-primary text-white shadow-sm'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              )}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">总页数</Label>
                        <Input type="number" {...register('totalPages', { valueAsNumber: true })} placeholder="输入总页数" className="mt-2 h-12 rounded-xl bg-gray-50 border-0" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">总字数</Label>
                        <Input type="number" {...register('wordCount', { valueAsNumber: true })} placeholder="输入总字数" className="mt-2 h-12 rounded-xl bg-gray-50 border-0" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm font-medium text-gray-700">书籍简介</Label>
                        <textarea
                          {...register('description')}
                          rows={4}
                          placeholder="简要记录这本书的内容、主题或适合后续查看的说明"
                          className="mt-2 w-full resize-none rounded-xl border-0 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-foreground">封面与展示</p>
                      <p className="mt-1 text-xs text-muted-foreground">封面会直接影响卡片浏览体验和书单展示效果。</p>
                    </div>
                    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-slate-50 p-5 text-center">
                      <div className="flex h-40 w-28 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
                        {coverUrl ? <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" /> : <BookOpen className="h-10 w-10 text-gray-300" />}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-4 rounded-xl">
                        <Upload className="mr-2 h-4 w-4" />
                        上传封面
                      </Button>
                      <p className="mt-2 text-xs text-gray-400">支持 JPG、PNG，最大 2MB</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
                    <p className="text-sm font-semibold text-amber-900">录入建议</p>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-800">
                      <li>优先保证书名、类型和页数准确，这会影响列表筛选和阅读进度。</li>
                      <li>如果暂时没有完整信息，可以先保存核心字段，后面再补封面和标签。</li>
                      <li>当前录入会自动归到 {selectedChild?.name || '当前孩子'} 名下。</li>
                    </ul>
                  </div>
                </div>
              </form>
            </div>
            <div className="border-t border-gray-100 bg-gray-50 p-6">
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={closeForm} className="h-12 flex-1 rounded-xl">取消</Button>
                <Button type="submit" form="book-form" className="h-12 flex-1 rounded-xl bg-primary text-primary-foreground" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : editingBook ? '保存修改' : '添加图书'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Dialogs */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除「{bookToDelete?.name}」吗？此操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBookListDialog} onOpenChange={setShowBookListDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>创建新书单</AlertDialogTitle>
            <AlertDialogDescription>给书单起个名字，方便管理和查找。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">书单名称</Label>
            <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="如：暑假阅读计划、科普书单..." className="h-12" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewListName('')}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (newListName.trim()) {
                const newList = { id: Date.now().toString(), name: newListName.trim(), bookIds: [], createdAt: new Date().toISOString() };
                const newLists = [...bookLists, newList];
                setBookLists(newLists);
                localStorage.setItem(storageKeys.bookLists, JSON.stringify(newLists));
                toast.success('书单创建成功');
                setNewListName('');
                setShowBookListDialog(false);
              } else {
                toast.error('请输入书单名称');
              }
            }} className="bg-primary hover:bg-primary/90">创建书单</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
