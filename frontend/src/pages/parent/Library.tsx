import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  BookOpen,
  MoreVertical,
  Play,
  Upload,
  X,
  Library as LibraryIcon,
  Loader2,
  CheckSquare,
  Square,
  CheckCircle2,
  Clock,
  BarChart2,
  BookMarked,
  LayoutGrid,
  List,
  Target,
  TrendingUp,
  Calendar,
  Award,
  Bookmark,
  FolderHeart,
  BookUp,
  BookDown,
  Sparkles,
  Download,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

// Import components
import { BookCard, BookFilter, BatchActionBar, EmptyState } from '@/components/parent/library';
import type { Book, Child, LibraryStats, BorrowRecord, BookList } from '@/types/library';
import { bookTypes, readStages } from '@/types/library';

// Schema
const bookSchema = z.object({
  name: z.string().min(1, '请输入书名'),
  author: z.string().optional(),
  isbn: z.string().optional(),
  publisher: z.string().optional(),
  type: z.enum(['children', 'tradition', 'science', 'character', 'other']),
  characterTag: z.string().optional(),
  coverUrl: z.string().optional(),
  totalPages: z.number().min(0, '页数不能为负数').optional(),
  wordCount: z.number().min(0, '字数不能为负数').optional(),
  suitableAge: z.string().optional(),
});

type BookFormData = z.infer<typeof bookSchema>;

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

async function searchBooksByTitle(title: string): Promise<any[]> {
  try {
    const { data } = await apiClient.get(`/library/search-by-title/${encodeURIComponent(title)}`);
    return data.data || [];
  } catch (error) {
    console.error('[Search] Error:', error);
    throw error;
  }
}

async function updateBookState(bookId: number, childId: number, status: string, finishedAt?: string): Promise<any> {
  const { data } = await apiClient.post(`/library/${bookId}/state`, { childId, status, finishedAt });
  return data.data;
}

async function batchFinishBooks(childId: number, readStage?: string, bookIds?: number[]): Promise<any> {
  const { data } = await apiClient.post('/library/batch/finish', { childId, readStage, bookIds });
  return data.data;
}

async function fetchLibraryStats(childId?: number): Promise<LibraryStats> {
  const params = childId ? `?childId=${childId}` : '';
  const { data } = await apiClient.get(`/library/stats${params}`);
  return data.data;
}

async function fetchChildren(): Promise<Child[]> {
  const { data } = await apiClient.get('/children');
  return data.data || [];
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

async function startReading(bookId: number, childId: number): Promise<void> {
  await apiClient.post(`/library/${bookId}/start`, { childId });
}

const formatWordCount = (count: number | undefined): string => {
  if (!count) return '0';
  if (count >= 10000) {
    return `${Math.round(count / 10000)}万`;
  }
  return String(count);
};

export default function LibraryPage() {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedReadStatus, setSelectedReadStatus] = useState<'all' | 'finished' | 'reading' | 'unread'>('all');
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [startReadingBook, setStartReadingBook] = useState<Book | null>(null);
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

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const [batchReadStage, setBatchReadStage] = useState<string>('');
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Goal state
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('library_monthly_goal');
    return saved ? parseInt(saved, 10) : 10;
  });
  const [goalInput, setGoalInput] = useState(String(monthlyGoal));

  // Batch dialogs
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [showBatchTypeDialog, setShowBatchTypeDialog] = useState(false);
  const [batchTypeValue, setBatchTypeValue] = useState('');

  // Book lists
  const [bookLists, setBookLists] = useState<BookList[]>(() => {
    const saved = localStorage.getItem('library_book_lists');
    return saved ? JSON.parse(saved) : [];
  });
  const [showBookListDialog, setShowBookListDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [showAddToListDialog, setShowAddToListDialog] = useState(false);

  // Borrow records
  const [borrowRecords, setBorrowRecords] = useState<BorrowRecord[]>(() => {
    const saved = localStorage.getItem('library_borrow_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [showBorrowDialog, setShowBorrowDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [selectedBorrowBook, setSelectedBorrowBook] = useState<Book | null>(null);
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowDate, setBorrowDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Check in
  const [checkInRecords, setCheckInRecords] = useState<string[]>(() => {
    const saved = localStorage.getItem('library_checkin_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const hasCheckedInToday = checkInRecords.includes(today);

  // Import history
  const [importHistory, setImportHistory] = useState<Array<{ date: string; count: number; filename: string }>>(() => {
    const saved = localStorage.getItem('library_import_history');
    return saved ? JSON.parse(saved) : [];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedChildId } = useSelectedChild();

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
      coverUrl: '',
      totalPages: 0,
      wordCount: 0,
    },
  });

  const selectedTypeValue = watch('type');
  const coverUrl = watch('coverUrl');

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['library', searchQuery, selectedType, sortBy, selectedChildId],
    queryFn: () => fetchBooks(searchQuery, selectedType, sortBy, selectedChildId || undefined),
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
        (book.characterTag && book.characterTag.toLowerCase().includes(query))
      );
    }

    if (selectedReadStatus !== 'all') {
      result = result.filter(book => {
        if (selectedReadStatus === 'finished') {
          return book.readState?.status === 'finished';
        } else if (selectedReadStatus === 'reading') {
          return book.activeReadings?.length > 0 && book.readState?.status !== 'finished';
        } else if (selectedReadStatus === 'unread') {
          return !book.activeReadings?.length && book.readState?.status !== 'finished';
        }
        return true;
      });
    }

    if (selectedAgeRange !== 'all') {
      result = result.filter(book => {
        if (!book.suitableAge) return false;
        const age = book.suitableAge;
        switch (selectedAgeRange) {
          case '0-3':
            return age.includes('0') || age.includes('1') || age.includes('2') || age.includes('3');
          case '3-6':
            return age.includes('3') || age.includes('4') || age.includes('5') || age.includes('6');
          case '6-9':
            return age.includes('6') || age.includes('7') || age.includes('8') || age.includes('9');
          case '9-12':
            return age.includes('9') || age.includes('10') || age.includes('11') || age.includes('12');
          case '12+':
            return age.includes('12') || age.includes('13') || age.includes('14') || age.includes('15');
          default:
            return true;
        }
      });
    }

    return result;
  }, [books, selectedReadStatus, selectedAgeRange, searchInput]);

  // Recommended books
  const recommendedBooks = useMemo(() => {
    if (books.length === 0) return [];
    const finishedBooks = books.filter(b => b.readState?.status === 'finished');
    const favoriteTypes = finishedBooks.reduce((acc, book) => {
      acc[book.type] = (acc[book.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topType = Object.entries(favoriteTypes).sort((a, b) => b[1] - a[1])[0]?.[0];
    return books
      .filter(b => b.type === topType && !b.readState?.status)
      .slice(0, 5);
  }, [books]);

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['libraryStats', selectedChildId],
    queryFn: () => fetchLibraryStats(selectedChildId || undefined),
    enabled: !!selectedChildId,
  });

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
  });

  // Batch selection
  const toggleBookSelection = (bookId: number) => {
    const newSelection = new Set(selectedBookIds);
    if (newSelection.has(bookId)) {
      newSelection.delete(bookId);
    } else {
      newSelection.add(bookId);
    }
    setSelectedBookIds(newSelection);
  };

  const selectAllBooks = () => {
    if (selectedBookIds.size === filteredBooks.length) {
      setSelectedBookIds(new Set());
    } else {
      setSelectedBookIds(new Set(filteredBooks.map(b => b.id)));
    }
  };

  const clearSelection = () => {
    setSelectedBookIds(new Set());
    setBatchMode(false);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
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

  const startReadingMutation = useMutation({
    mutationFn: ({ bookId, childId }: { bookId: number; childId: number }) => startReading(bookId, childId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['reading'] });
      toast.success('已开始阅读，可在阅读管理查看');
      setStartReadingBook(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const batchFinishMutation = useMutation({
    mutationFn: ({ childId, readStage, bookIds }: { childId: number; readStage?: string; bookIds?: number[] }) =>
      batchFinishBooks(childId, readStage, bookIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
      toast.success(`已将 ${data.updated} 本书标记为已读完`);
      setShowBatchDialog(false);
      clearSelection();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (bookIds: number[]) => {
      const results = await Promise.all(
        bookIds.map(id => deleteBook(id).catch(() => null))
      );
      return { deleted: results.filter(r => r !== null).length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
      toast.success(`已删除 ${data.deleted} 本书`);
      setShowBatchDeleteDialog(false);
      clearSelection();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const batchUpdateTypeMutation = useMutation({
    mutationFn: async ({ bookIds, type }: { bookIds: number[]; type: string }) => {
      const results = await Promise.all(
        bookIds.map(id => updateBook(id, { type: type as any }).catch(() => null))
      );
      return { updated: results.filter(r => r !== null).length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success(`已修改 ${data.updated} 本书的分类`);
      setShowBatchTypeDialog(false);
      setBatchTypeValue('');
      clearSelection();
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
      const results = await searchBooksByTitle(titleSearch.trim());
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
    if (editingBook) {
      updateMutation.mutate({ id: editingBook.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const closeForm = () => {
    setEditingBook(null);
    setShowAddForm(false);
    reset();
    setAddMode('manual');
    setIsbnInput('');
    setTitleSearch('');
    setSearchResults([]);
  };

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    reset({
      name: book.name,
      author: book.author,
      isbn: book.isbn,
      publisher: book.publisher,
      type: book.type as any,
      characterTag: book.characterTag,
      coverUrl: book.coverUrl,
      totalPages: book.totalPages,
      wordCount: book.wordCount || 0,
      suitableAge: book.suitableAge,
    });
    setShowAddForm(true);
  };

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
      if (data && data.coverUrl) {
        setValue('coverUrl', data.coverUrl);
        toast.success('封面上传成功');
      }
    } catch (error) {
      toast.error('上传失败，请重试');
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
      const parentToken = localStorage.getItem('parent_token');
      const childToken = localStorage.getItem('child_token');
      const token = parentToken || childToken;
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
                localStorage.setItem('library_import_history', JSON.stringify(newHistory));
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

  const executeBatchFinish = () => {
    if (!selectedChildId) return;
    if (selectedBookIds.size > 0) {
      batchFinishMutation.mutate({ childId: selectedChildId, bookIds: Array.from(selectedBookIds) });
    } else if (batchReadStage) {
      batchFinishMutation.mutate({ childId: selectedChildId, readStage: batchReadStage });
    }
  };

  // Calculate streak
  const calculateStreak = () => {
    if (checkInRecords.length === 0) return 0;
    const sorted = [...checkInRecords].sort().reverse();
    let streak = 0;
    let currentDate = new Date();
    for (const dateStr of sorted) {
      const date = new Date(dateStr);
      const diffDays = Math.floor((currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0 || diffDays === streak) {
        streak++;
        currentDate = date;
      } else {
        break;
      }
    }
    return streak;
  };

  const streakDays = calculateStreak();
  const totalCheckIns = checkInRecords.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Component */}
      <BookFilter
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedReadStatus={selectedReadStatus}
        onReadStatusChange={setSelectedReadStatus}
        selectedAgeRange={selectedAgeRange}
        onAgeRangeChange={setSelectedAgeRange}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        batchMode={batchMode}
        onBatchModeToggle={() => {
          setBatchMode(!batchMode);
          if (batchMode) clearSelection();
        }}
        onImportClick={() => importInputRef.current?.click()}
        onAddBookClick={() => setShowAddForm(true)}
        importing={importing}
        importProgress={importProgress}
        resultCount={filteredBooks.length}
      />

      <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />

      {/* Batch Action Bar */}
      {batchMode && (
        <BatchActionBar
          selectedCount={selectedBookIds.size}
          totalCount={filteredBooks.length}
          onSelectAll={selectAllBooks}
          onClearSelection={clearSelection}
          onBatchFinish={() => setShowBatchDialog(true)}
          onBatchDelete={() => setShowBatchDeleteDialog(true)}
          onBatchTypeChange={(type) => {
            setBatchTypeValue(type);
            setShowBatchTypeDialog(true);
          }}
          onAddToList={(listId) => {
            setSelectedListId(listId);
            setShowAddToListDialog(true);
          }}
          bookLists={bookLists}
          onCreateList={() => setShowBookListDialog(true)}
          batchReadStage={batchReadStage}
          onBatchReadStageChange={setBatchReadStage}
          isProcessing={batchFinishMutation.isPending || batchDeleteMutation.isPending || batchUpdateTypeMutation.isPending}
        />
      )}

      {/* Import Result & History */}
      {(importResult || importHistory.length > 0) && (
        <Card className="border border-border rounded-xl overflow-hidden">
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
                      成功导入 {importResult.imported} 条阅读记录
                      {importResult.createdBooks > 0 && `，创建 ${importResult.createdBooks} 本新书`}
                      {importResult.matchedBooks > 0 && `，匹配 ${importResult.matchedBooks} 条到现有书籍`}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
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
                    }}
                    className="gap-1"
                  >
                    <Download className="w-4 h-4" />
                    导出数据
                  </Button>
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

      {/* Recommended Books */}
      {recommendedBooks.length > 0 && (
        <Card className="border border-amber-200 bg-gradient-to-r from-amber-50/50 to-transparent rounded-xl overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-foreground">为你推荐</h3>
              <span className="text-xs text-muted-foreground ml-2">根据你的阅读偏好</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recommendedBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => navigate(`/parent/library/${book.id}`)}
                  className="flex-shrink-0 w-32 cursor-pointer group"
                >
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted mb-2">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge className="text-xs bg-amber-500 text-white">{bookTypes.find(t => t.value === book.type)?.label}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-foreground text-center truncate font-medium">{book.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Currently Reading */}
      {books.filter(b => b.activeReadings?.length > 0 && b.readState?.status !== 'finished').length > 0 && (
        <Card className="border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent rounded-xl overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">正在阅读</h3>
              <Badge variant="secondary" className="ml-auto">
                {books.filter(b => b.activeReadings?.length > 0 && b.readState?.status !== 'finished').length} 本
              </Badge>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {books
                .filter(b => b.activeReadings?.length > 0 && b.readState?.status !== 'finished')
                .slice(0, 5)
                .map((book) => {
                  const totalPages = book.totalPages || 0;
                  const readPages = book.totalReadPages || 0;
                  const progress = totalPages > 0 ? Math.round((readPages / totalPages) * 100) : 0;
                  return (
                    <div
                      key={book.id}
                      onClick={() => navigate(`/parent/library/${book.id}`)}
                      className="flex-shrink-0 w-32 cursor-pointer group"
                    >
                      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted mb-2">
                        {book.coverUrl ? (
                          <img src={book.coverUrl} alt={book.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center truncate">{progress}% 已读</p>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reading Goal */}
      <Card className="border border-border rounded-xl overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">本月阅读目标</h3>
                <p className="text-sm text-muted-foreground">已读 {stats?.thisMonthRead || 0} / {monthlyGoal} 本</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setGoalInput(String(monthlyGoal)); setShowGoalDialog(true); }}>
              设置目标
            </Button>
          </div>
          <div className="relative">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(((stats?.thisMonthRead || 0) / monthlyGoal) * 100, 100)}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full transition-colors",
                  (stats?.thisMonthRead || 0) >= monthlyGoal ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-amber-400 to-orange-500"
                )}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>0%</span>
              <span className={cn("font-medium", (stats?.thisMonthRead || 0) >= monthlyGoal ? "text-green-500" : "text-amber-500")}>
                {Math.round(((stats?.thisMonthRead || 0) / monthlyGoal) * 100)}% 完成{(stats?.thisMonthRead || 0) >= monthlyGoal && " "}
              </span>
              <span>100%</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <Button
              onClick={() => setShowCheckInDialog(true)}
              disabled={hasCheckedInToday}
              className={cn(
                "w-full h-12 rounded-xl font-medium",
                hasCheckedInToday ? "bg-green-100 text-green-700 hover:bg-green-100 cursor-default" : "bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white"
              )}
            >
              {hasCheckedInToday ? <><CheckCircle2 className="w-5 h-5 mr-2" />今日已打卡</> : <><Award className="w-5 h-5 mr-2" />今日阅读打卡</>}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">本周阅读</span>
              </div>
              <p className="text-lg font-semibold text-foreground">{Math.ceil((stats?.thisMonthRead || 0) / 4)}</p>
              <p className="text-xs text-muted-foreground">本</p>
            </div>
            <div className="text-center border-x border-border">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">日均阅读</span>
              </div>
              <p className="text-lg font-semibold text-foreground">{stats?.totalHours ? Math.round((stats.totalHours * 60 + (stats.remainingMinutes || 0)) / 30) : 0}</p>
              <p className="text-xs text-muted-foreground">分钟</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Award className="w-4 h-4" />
                <span className="text-xs">连续打卡</span>
              </div>
              <p className="text-lg font-semibold text-foreground">{streakDays}</p>
              <p className="text-xs text-muted-foreground">天</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Borrow Records */}
      {borrowRecords.filter(r => r.status === 'borrowed' || r.status === 'overdue').length > 0 && (
        <Card className="border border-border rounded-xl overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                  <BookUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">借阅管理</h3>
                  <p className="text-sm text-muted-foreground">
                    {borrowRecords.filter(r => r.status === 'borrowed').length} 本借出, {borrowRecords.filter(r => r.status === 'overdue').length} 本逾期
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {borrowRecords.filter(r => r.status === 'borrowed' || r.status === 'overdue').slice(0, 3).map((record) => {
                const book = books.find(b => b.id === record.bookId);
                const isOverdue = new Date(record.dueDate) < new Date();
                const daysLeft = Math.ceil((new Date(record.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={record.id} className={cn("flex items-center gap-3 p-3 rounded-lg", isOverdue ? "bg-red-50 border border-red-100" : "bg-muted/50")}>
                    {book?.coverUrl ? (
                      <img src={book.coverUrl} alt="" className="w-10 h-14 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{book?.name || '未知书籍'}</p>
                      <p className="text-sm text-muted-foreground">借给: {record.borrowerName}</p>
                      <p className={cn("text-xs", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                        {isOverdue ? `已逾期 ${Math.abs(daysLeft)} 天` : `还有 ${daysLeft} 天到期`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedBorrowBook(book || null); setShowReturnDialog(true); }}>
                      <BookDown className="w-4 h-4 mr-1" />归还
                    </Button>
                  </div>
                );
              })}
            </div>
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
                  <h3 className="font-semibold text-foreground">我的书单</h3>
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
                        localStorage.setItem('library_book_lists', JSON.stringify(newLists));
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="已读书籍"
          value={stats?.finishedBooks || 0}
          subtext={stats?.thisMonthRead && stats.thisMonthRead > 0 ? `本月已读 ${stats.thisMonthRead} 本` : ''}
          icon={BookOpen}
          color="green"
          className="rounded-[10px] border-[#eaedf3] shadow-none hover:shadow-sm"
          onClick={() => { setSelectedType('all'); setSortBy('recently_finished'); toast.info('已筛选：已读完的书籍'); }}
          isLoading={isLoadingStats}
        />
        <MetricCard
          title="阅读总量"
          value={stats?.totalPages || 0}
          subtext={`${formatWordCount(stats?.totalWords)} 字`}
          icon={BookMarked}
          color="blue"
          className="rounded-[10px] border-[#eaedf3] shadow-none hover:shadow-sm"
          isLoading={isLoadingStats}
        />
        <MetricCard
          title="阅读时长"
          value={`${stats?.totalHours || 0}h ${stats?.remainingMinutes || 0}m`}
          subtext="累计阅读时间"
          icon={Clock}
          color="orange"
          className="rounded-[10px] border-[#eaedf3] shadow-none hover:shadow-sm"
          isLoading={isLoadingStats}
        />
        <MetricCard
          title="热门书籍"
          value={stats?.topBooks?.length || 0}
          subtext={stats?.favoriteType ? `最爱: ${stats.favoriteType}` : ''}
          icon={BarChart2}
          color="purple"
          className="rounded-[10px] border-[#eaedf3] shadow-none hover:shadow-sm"
          onClick={() => { setSortBy('most_read'); toast.info('已按阅读热度排序'); }}
          isLoading={isLoadingStats}
        />
      </div>

      {/* Books Grid/List */}
      {filteredBooks.length === 0 ? (
        <EmptyState
          hasBooks={books.length > 0}
          onAddByISBN={() => { setShowAddForm(true); setAddMode('isbn'); }}
          onImport={() => importInputRef.current?.click()}
          onManualAdd={() => { setShowAddForm(true); setAddMode('manual'); }}
          onClearFilters={() => {
            setSearchInput('');
            setSelectedType('all');
            setSelectedReadStatus('all');
            setSelectedAgeRange('all');
          }}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredBooks.map((book, index) => (
            <BookCard
              key={book.id}
              book={book}
              index={index}
              batchMode={batchMode}
              isSelected={selectedBookIds.has(book.id)}
              onToggleSelection={() => toggleBookSelection(book.id)}
              onStartReading={() => setStartReadingBook(book)}
              onEdit={() => handleEdit(book)}
              onDelete={() => handleDelete(book)}
              onBorrow={() => {
                setSelectedBorrowBook(book);
                setBorrowDate(new Date().toISOString().split('T')[0]);
                const due = new Date();
                due.setDate(due.getDate() + 14);
                setDueDate(due.toISOString().split('T')[0]);
                setShowBorrowDialog(true);
              }}
              viewMode={viewMode}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBooks.map((book, index) => (
            <BookCard
              key={book.id}
              book={book}
              index={index}
              batchMode={batchMode}
              isSelected={selectedBookIds.has(book.id)}
              onToggleSelection={() => toggleBookSelection(book.id)}
              onStartReading={() => setStartReadingBook(book)}
              onEdit={() => handleEdit(book)}
              onDelete={() => handleDelete(book)}
              onBorrow={() => {
                setSelectedBorrowBook(book);
                setBorrowDate(new Date().toISOString().split('T')[0]);
                const due = new Date();
                due.setDate(due.getDate() + 14);
                setDueDate(due.toISOString().split('T')[0]);
                setShowBorrowDialog(true);
              }}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={closeForm}>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={closeForm} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingBook ? '编辑图书' : '添加图书'}</h2>
              <Button variant="ghost" size="icon" onClick={closeForm} className="rounded-full"><X className="w-5 h-5" /></Button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {!editingBook && (
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">添加方式</Label>
                  <div className="flex gap-2">
                    {(['manual', 'isbn', 'search'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAddMode(mode)}
                        className={cn(
                          'flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all border-2',
                          addMode === mode ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        {mode === 'manual' && '手动输入'}
                        {mode === 'isbn' && 'ISBN查询'}
                        {mode === 'search' && '书名搜索'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!editingBook && addMode === 'isbn' && (
                <div className="mb-6 p-4 bg-blue-50 rounded-2xl">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">输入ISBN号</Label>
                  <div className="flex gap-2">
                    <Input value={isbnInput} onChange={(e) => setIsbnInput(e.target.value)} placeholder="输入10位或13位ISBN号" className="flex-1 rounded-xl h-12 bg-white" onKeyDown={(e) => e.key === 'Enter' && handleISBNLookup()} />
                    <Button type="button" onClick={handleISBNLookup} disabled={isbnLoading} className="px-6 h-12 rounded-xl">
                      {isbnLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '查询'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">ISBN通常印在书籍封底，形如 978-7-xxx-xxxxx-x</p>
                </div>
              )}
              {!editingBook && addMode === 'search' && (
                <div className="mb-6 p-4 bg-green-50 rounded-2xl">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">搜索书籍</Label>
                  <div className="flex gap-2">
                    <Input value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} placeholder="输入书名搜索..." className="flex-1 rounded-xl h-12 bg-white" onKeyDown={(e) => e.key === 'Enter' && handleTitleSearch()} />
                    <Button type="button" onClick={handleTitleSearch} disabled={isSearching} className="px-6 h-12 rounded-xl">
                      {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : '搜索'}
                    </Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-60 overflow-auto">
                      {searchResults.map((book, idx) => (
                        <button key={idx} type="button" onClick={() => handleSelectSearchResult(book)} className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-left">
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt={book.name} className="w-10 h-14 object-cover rounded" loading="lazy" />
                          ) : (
                            <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center"><BookOpen className="w-5 h-5 text-gray-400" /></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{book.name}</p>
                            <p className="text-xs text-gray-500 truncate">{book.author || '未知作者'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <form id="book-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label className="text-sm font-medium text-gray-700">书籍封面</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="w-24 h-32 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                      {coverUrl ? <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" /> : <BookOpen className="w-8 h-8 text-gray-300" />}
                    </div>
                    <div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-xl"><Upload className="w-4 h-4 mr-2" />上传封面</Button>
                      <p className="text-xs text-gray-400 mt-2">支持 JPG、PNG，最大 2MB</p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">书名 *</Label>
                  <Input {...register('name')} placeholder="输入书名" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">作者</Label>
                  <Input {...register('author')} placeholder="输入作者" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">性格养成标签</Label>
                  <Input {...register('characterTag')} placeholder="如：勇敢、诚实、坚持" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">图书类型</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {bookTypes.map((type) => (
                      <button key={type.value} type="button" onClick={() => setValue('type', type.value as any)} className={cn('px-3 py-2 rounded-xl text-xs font-medium transition-all border', selectedTypeValue === type.value ? 'border-transparent text-white bg-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white')}>
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">ISBN</Label>
                  <Input {...register('isbn')} placeholder="输入ISBN号" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">出版社</Label>
                  <Input {...register('publisher')} placeholder="输入出版社" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">总页数</Label>
                  <Input type="number" {...register('totalPages', { valueAsNumber: true })} placeholder="输入总页数" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">总字数</Label>
                  <Input type="number" {...register('wordCount', { valueAsNumber: true })} placeholder="输入总字数" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">适读年龄</Label>
                  <Input {...register('suitableAge')} placeholder="如：3-6岁" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={closeForm} className="flex-1 rounded-xl h-12">取消</Button>
                <Button type="submit" form="book-form" className="flex-1 rounded-xl h-12 bg-primary text-primary-foreground" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : editingBook ? '保存修改' : '添加图书'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Dialogs */}
      <AlertDialog open={!!startReadingBook} onOpenChange={() => setStartReadingBook(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>开始阅读</AlertDialogTitle>
            <AlertDialogDescription>选择孩子开始阅读「{startReadingBook?.name}」</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            {children.map((child) => (
              <AlertDialogAction key={child.id} onClick={() => startReadingMutation.mutate({ bookId: startReadingBook!.id, childId: child.id })}>
                {child.avatar} {child.name}
              </AlertDialogAction>
            ))}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <AlertDialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量标记已读完</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedBookIds.size > 0 ? `确定要将选中的 ${selectedBookIds.size} 本书标记为已读完吗？` : batchReadStage ? `确定要将「${batchReadStage}」阶段的所有书籍标记为已读完吗？` : '请先选择书籍或阅读阶段'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={executeBatchFinish} disabled={batchFinishMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600">
              {batchFinishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认标记'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>设置月度阅读目标</AlertDialogTitle>
            <AlertDialogDescription>设定一个合理的月度阅读目标，帮助孩子养成良好的阅读习惯。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">每月目标阅读书籍数量</Label>
            <div className="flex items-center gap-4">
              <Input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} min={1} max={100} className="text-center text-lg font-semibold" />
              <span className="text-muted-foreground whitespace-nowrap">本 / 月</span>
            </div>
            <div className="flex gap-2 mt-3">
              {[5, 10, 15, 20, 30].map(num => (
                <button key={num} onClick={() => setGoalInput(String(num))} className={cn("px-3 py-1 rounded-lg text-sm transition-all", goalInput === String(num) ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}>{num}本</button>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGoalInput(String(monthlyGoal))}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const newGoal = parseInt(goalInput, 10);
              if (newGoal > 0 && newGoal <= 100) {
                setMonthlyGoal(newGoal);
                localStorage.setItem('library_monthly_goal', String(newGoal));
                toast.success(`月度阅读目标已设置为 ${newGoal} 本`);
                setShowGoalDialog(false);
              } else {
                toast.error('请输入 1-100 之间的数字');
              }
            }} className="bg-primary hover:bg-primary/90">保存设置</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除选中的 <strong>{selectedBookIds.size}</strong> 本书吗？此操作不可恢复，请谨慎操作。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => batchDeleteMutation.mutate(Array.from(selectedBookIds))} disabled={batchDeleteMutation.isPending} className="bg-red-500 hover:bg-red-600">
              {batchDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBatchTypeDialog} onOpenChange={setShowBatchTypeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认修改分类</AlertDialogTitle>
            <AlertDialogDescription>确定要将选中的 <strong>{selectedBookIds.size}</strong> 本书的分类修改为「<strong>{bookTypes.find(t => t.value === batchTypeValue)?.label}</strong>」吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBatchTypeValue('')}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => batchUpdateTypeMutation.mutate({ bookIds: Array.from(selectedBookIds), type: batchTypeValue })} disabled={batchUpdateTypeMutation.isPending} className="bg-primary hover:bg-primary/90">
              {batchUpdateTypeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认修改'}
            </AlertDialogAction>
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
                localStorage.setItem('library_book_lists', JSON.stringify(newLists));
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

      <AlertDialog open={showAddToListDialog} onOpenChange={setShowAddToListDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>添加到书单</AlertDialogTitle>
            <AlertDialogDescription>确定要将选中的 <strong>{selectedBookIds.size}</strong> 本书添加到「<strong>{bookLists.find(l => l.id === selectedListId)?.name}</strong>」吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedListId('')}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const list = bookLists.find(l => l.id === selectedListId);
              if (list) {
                const newBookIds = [...new Set([...list.bookIds, ...Array.from(selectedBookIds)])];
                const newLists = bookLists.map(l => l.id === selectedListId ? { ...l, bookIds: newBookIds } : l);
                setBookLists(newLists);
                localStorage.setItem('library_book_lists', JSON.stringify(newLists));
                toast.success(`已添加 ${selectedBookIds.size} 本书到书单`);
                setSelectedListId('');
                setShowAddToListDialog(false);
                clearSelection();
              }
            }} className="bg-primary hover:bg-primary/90">确认添加</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBorrowDialog} onOpenChange={setShowBorrowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>借出书籍</AlertDialogTitle>
            <AlertDialogDescription>记录「{selectedBorrowBook?.name}」的借出信息</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">借给</Label>
              <Input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="输入借书人姓名" className="h-12" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">借出日期</Label>
                <Input type="date" value={borrowDate} onChange={(e) => setBorrowDate(e.target.value)} className="h-12" />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">应还日期</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-12" />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setBorrowerName(''); setBorrowDate(''); setDueDate(''); }}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (borrowerName.trim() && borrowDate && dueDate && selectedBorrowBook) {
                const newRecord = { id: Date.now().toString(), bookId: selectedBorrowBook.id, borrowerName: borrowerName.trim(), borrowDate, dueDate, status: 'borrowed' as const };
                const newRecords = [...borrowRecords, newRecord];
                setBorrowRecords(newRecords);
                localStorage.setItem('library_borrow_records', JSON.stringify(newRecords));
                toast.success('借出记录已保存');
                setBorrowerName('');
                setBorrowDate('');
                setDueDate('');
                setShowBorrowDialog(false);
              } else {
                toast.error('请填写完整信息');
              }
            }} className="bg-blue-500 hover:bg-blue-600">确认借出</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>归还书籍</AlertDialogTitle>
            <AlertDialogDescription>确认「{selectedBorrowBook?.name}」已归还？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (selectedBorrowBook) {
                const record = borrowRecords.find(r => r.bookId === selectedBorrowBook.id && r.status === 'borrowed');
                if (record) {
                  const newRecords = borrowRecords.map(r => r.id === record.id ? { ...r, status: 'returned' as const, returnDate: new Date().toISOString().split('T')[0] } : r);
                  setBorrowRecords(newRecords);
                  localStorage.setItem('library_borrow_records', JSON.stringify(newRecords));
                  toast.success('书籍已归还');
                }
                setShowReturnDialog(false);
              }
            }} className="bg-green-500 hover:bg-green-600">确认归还</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>今日阅读打卡</AlertDialogTitle>
            <AlertDialogDescription>确认今天已完成阅读？</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-4 text-center">
              <div className="text-4xl mb-2"></div>
              <p className="text-lg font-semibold text-foreground">连续打卡 {streakDays} 天</p>
              <p className="text-sm text-muted-foreground mt-1">累计打卡 {totalCheckIns} 天</p>
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">坚持阅读，培养好习惯！</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!checkInRecords.includes(today)) {
                const newRecords = [...checkInRecords, today];
                setCheckInRecords(newRecords);
                localStorage.setItem('library_checkin_records', JSON.stringify(newRecords));
                toast.success('打卡成功！继续保持！');
              }
              setShowCheckInDialog(false);
            }} className="bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600">确认打卡</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
