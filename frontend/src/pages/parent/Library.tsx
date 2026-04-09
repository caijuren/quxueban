import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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

// Types
interface Book {
  id: number;
  name: string;
  author: string;
  type: string;
  characterTag: string;
  coverUrl: string;
  totalPages: number;
  wordCount?: number;
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

interface Child {
  id: number;
  name: string;
  avatar: string;
}

interface LibraryStats {
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

// Schema
const bookSchema = z.object({
  name: z.string().min(1, '请输入书名'),
  author: z.string().optional(),
  type: z.enum(['fiction', 'nonfiction', 'science', 'history', 'biography', 'other']),
  characterTag: z.string().optional(),
  coverUrl: z.string().optional(),
  totalPages: z.number().min(0, '页数不能为负数').optional(),
  wordCount: z.number().min(0, '字数不能为负数').optional(),
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
  console.log('[Search] Starting search for:', title);
  try {
    const { data } = await apiClient.get(`/library/search-by-title/${encodeURIComponent(title)}`);
    console.log('[Search] Success:', data);
    if (data.message) {
      console.log('[Search] Message:', data.message);
    }
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
  const { data } = await apiClient.get('/auth/children');
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

const bookTypes = [
  { value: 'children', label: '儿童故事' },
  { value: 'tradition', label: '传统文化' },
  { value: 'science', label: '科普' },
  { value: 'character', label: '性格养成' },
  { value: 'other', label: '其他' },
];

const readStages = [
  { value: '小班', label: '小班' },
  { value: '中班', label: '中班' },
  { value: '大班', label: '大班' },
  { value: '一年级', label: '一年级' },
];

const formatBookName = (name: string): string => {
  return name.replace(/《|》|【|】/g, '').trim();
};

// 格式化字数显示
const formatWordCount = (count: number | undefined): string => {
  if (!count) return '0';
  if (count >= 10000) {
    return `${Math.round(count / 10000)}万`;
  }
  return String(count);
};

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [sortBy, setSortBy] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [startReadingBook, setStartReadingBook] = useState<Book | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // 智能添加相关状态
  const [addMode, setAddMode] = useState<'manual' | 'isbn' | 'search'>('manual');
  const [isbnInput, setIsbnInput] = useState('');
  const [titleSearch, setTitleSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isbnLoading, setIsbnLoading] = useState(false);
  
  // P1-6: 批量管理状态
  const [batchMode, setBatchMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const [batchReadStage, setBatchReadStage] = useState<string>('');
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  
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
      type: 'fiction',
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

  const { data: stats } = useQuery({
    queryKey: ['libraryStats', selectedChildId],
    queryFn: () => fetchLibraryStats(selectedChildId || undefined),
    enabled: !!selectedChildId,
  });

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
  });



  // 批量选择相关
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
    if (selectedBookIds.size === books.length) {
      setSelectedBookIds(new Set());
    } else {
      setSelectedBookIds(new Set(books.map(b => b.id)));
    }
  };

  const clearSelection = () => {
    setSelectedBookIds(new Set());
    setBatchMode(false);
  };

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
    mutationFn: ({ id, data }: { id: number; data: Partial<BookFormData> }) =>
      updateBook(id, data),
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
    mutationFn: ({ bookId, childId }: { bookId: number; childId: number }) =>
      startReading(bookId, childId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['reading'] });
      toast.success('已开始阅读，可在阅读管理查看');
      setStartReadingBook(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateStateMutation = useMutation({
    mutationFn: ({ bookId, childId, status, finishedAt }: { bookId: number; childId: number; status: string; finishedAt?: string }) =>
      updateBookState(bookId, childId, status, finishedAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
      toast.success('阅读状态已更新');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // P1-6: 批量标记已读完
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
      const message = getErrorMessage(error);
      console.error('[Title Search Error]', error);
      toast.error(`搜索暂时不可用，请手动输入: ${message}`);
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

  const handleMarkFinished = (book: Book, childId: number) => {
    updateStateMutation.mutate({
      bookId: book.id,
      childId,
      status: 'finished',
      finishedAt: new Date().toISOString()
    });
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
      type: book.type as any,
      characterTag: book.characterTag,
      coverUrl: book.coverUrl,
      totalPages: book.totalPages,
      wordCount: book.wordCount || 0,
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setValue('coverUrl', base64);
    };
    reader.readAsDataURL(file);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error('请选择Excel文件 (.xlsx, .xls 或 .csv)');
      return;
    }

    setImporting(true);
    setImportPreview(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const { data } = await apiClient.post('/library/import-logs/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportPreview(data.data);
      setShowImportDialog(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  const executeImport = async () => {
    if (!importPreview || !selectedChildId) return;
    
    setImporting(true);
    try {
      const { data } = await apiClient.post('/library/import-logs/execute', {
        childId: selectedChildId,
        records: importPreview.records,
        createNewBooks: true
      });
      
      setImportResult(data.data);
      setImportPreview(null);
      setShowImportDialog(false);
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
      toast.success(`成功导入 ${data.data.imported} 条记录，创建 ${data.data.createdBooks} 本新书`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  // 执行批量标记已读完
  const executeBatchFinish = () => {
    if (!selectedChildId) return;
    
    if (selectedBookIds.size > 0) {
      batchFinishMutation.mutate({
        childId: selectedChildId,
        bookIds: Array.from(selectedBookIds)
      });
    } else if (batchReadStage) {
      batchFinishMutation.mutate({
        childId: selectedChildId,
        readStage: batchReadStage
      });
    }
  };

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
      {/* Page Control Bar */}
      <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Empty space for alignment */}
          <div className="flex-1"></div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportFile}
              className="hidden"
            />
            {/* P1-6: 批量管理按钮 */}
            <Button
              variant="outline"
              onClick={() => {
                setBatchMode(!batchMode);
                if (batchMode) {
                  clearSelection();
                }
              }}
              className={cn("h-10 rounded-lg", batchMode && "bg-primary/10 border-primary text-primary")}
            >
              {batchMode ? <CheckSquare className="w-4 h-4 mr-1.5" /> : <Square className="w-4 h-4 mr-1.5" />}
              <span className="text-sm">{batchMode ? '退出批量' : '批量管理'}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="h-10 rounded-lg"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              <span className="text-sm">{importing ? '处理中...' : '批量导入'}</span>
            </Button>
            <Button
              onClick={() => setShowAddForm(true)}
              className="h-10 rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm min-w-20"
            >
              <Plus className="size-4 mr-1.5" />
              <span className="text-sm">添加图书</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <Card className="border-2 border-green-200 bg-green-50 rounded-3xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">导入完成</h3>
                <p className="text-sm text-gray-600">
                  ✅ 成功导入 {importResult.imported} 条阅读记录
                  {importResult.createdBooks > 0 && `，创建 ${importResult.createdBooks} 本新书`}
                  {importResult.matchedBooks > 0 && `，匹配 ${importResult.matchedBooks} 条到现有书籍`}
                  {importResult.skipped > 0 && `，跳过 ${importResult.skipped} 条`}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setImportResult(null)}>关闭</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* P1-6: 批量操作栏 */}
      {batchMode && (
        <Card className="border-2 border-indigo-200 bg-indigo-50 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">
                  已选择 <strong>{selectedBookIds.size}</strong> 本书
                </span>
                <Button variant="ghost" size="sm" onClick={selectAllBooks}>
                  {selectedBookIds.size === books.length ? '取消全选' : '全选'}
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  清空选择
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={batchReadStage}
                  onChange={(e) => setBatchReadStage(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                >
                  <option value="">选择阅读阶段</option>
                  {readStages.map(stage => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
                <Button
                  onClick={() => setShowBatchDialog(true)}
                  disabled={selectedBookIds.size === 0 && !batchReadStage}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  标记已读完
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards - 阅读成长中心 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-border rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">已读书籍</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {stats?.finishedBooks || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">本</p>
            </div>
            <div className="w-10 h-10 rounded flex items-center justify-center bg-success/10">
              <span className="text-xl">📚</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-border rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">总页数</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {stats?.totalPages || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">页</p>
            </div>
            <div className="w-10 h-10 rounded flex items-center justify-center bg-primary/10">
              <span className="text-xl">📄</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-border rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">总字数</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {formatWordCount(stats?.totalWords)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">字</p>
            </div>
            <div className="w-10 h-10 rounded flex items-center justify-center bg-warning/10">
              <span className="text-xl">✍️</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border border-border rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">阅读时长</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {stats?.totalHours || 0}<span className="text-sm">h</span> {stats?.remainingMinutes || 0}<span className="text-sm">m</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">共 {stats?.totalMinutes || 0} 分钟</p>
            </div>
            <div className="w-10 h-10 rounded flex items-center justify-center bg-primary/10">
              <span className="text-xl">⏱️</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Search, Filter and Sort */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索书名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-lg h-9 bg-muted border-border"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedType('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                selectedType === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              全部
            </button>
            {bookTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                  selectedType === type.value
                    ? 'bg-primary text-white'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
        {/* 排序按钮 */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground py-2">排序：</span>
          {[
            { value: '', label: '默认' },
            { value: 'recently_finished', label: '最近读完' },
            { value: 'most_pages', label: '页数最多' },
            { value: 'most_minutes', label: '时长最长' },
          ].map((sort) => (
            <button
              key={sort.value}
              onClick={() => setSortBy(sort.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                sortBy === sort.value
                  ? 'bg-primary text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              {sort.label}
            </button>
          ))}
        </div>
      </div>

      {/* Books Grid */}
      {books.length === 0 ? (
        <div className="text-center py-16 bg-muted rounded-lg border border-dashed border-border">
          <div className="w-16 h-16 bg-primary/10 rounded flex items-center justify-center mx-auto mb-4">
            <LibraryIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground text-lg">图书馆还是空的</h3>
          <p className="text-muted-foreground mt-1">添加第一本书开始阅读之旅</p>
          <Button
            onClick={() => setShowAddForm(true)}
            className="mt-4 rounded-lg bg-primary text-white"
          >
            添加图书
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {books.map((book, index) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative"
            >
              {/* P1-6: 批量选择复选框 */}
              {batchMode && (
                <div 
                  className="absolute top-2 left-2 z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookSelection(book.id);
                  }}
                >
                  <div className={cn(
                    "w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
                    selectedBookIds.has(book.id)
                      ? "bg-primary border-primary"
                      : "bg-white border-border hover:border-primary"
                  )}>
                    {selectedBookIds.has(book.id) && (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              )}
              
              <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-border hover:shadow-md transition-all duration-300">
                {/* Cover */}
                <div 
                  className="aspect-[3/4] relative bg-muted cursor-pointer"
                  onClick={() => batchMode ? toggleBookSelection(book.id) : navigate(`/parent/library/${book.id}`)}
                >
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={formatBookName(book.name)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-muted-foreground/50" />
                    </div>
                  )}
                  {/* Character Tag */}
                  {book.characterTag && (
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-primary text-white px-2 py-0.5 rounded">
                        {book.characterTag}
                      </span>
                    </div>
                  )}
                  {/* Reading Badge */}
                  {book.activeReadings?.length > 0 && (
                    <div className="absolute bottom-2 left-2">
                      <span className="text-xs bg-success text-white px-2 py-0.5 rounded">
                        在读中
                      </span>
                    </div>
                  )}
                  {/* Reading State Badge */}
                  {book.readState?.status === 'finished' && (
                    <div className="absolute bottom-2 left-2">
                      <span className="text-xs bg-primary text-white px-2 py-0.5 rounded">
                        已读完
                      </span>
                    </div>
                  )}
                  {/* Hover Actions - 非批量模式才显示 */}
                  {!batchMode && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 flex-wrap p-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStartReadingBook(book);
                        }}
                        className="bg-white text-foreground hover:bg-muted rounded text-xs"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        开始阅读
                      </Button>
                      {book.readState?.status !== 'finished' && selectedChildId && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkFinished(book, selectedChildId);
                          }}
                          disabled={updateStateMutation.isPending}
                          className="bg-success text-white hover:bg-success/90 rounded text-xs"
                        >
                          ✓ 标记读完
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h4 className="font-medium text-foreground text-sm truncate">
                    {formatBookName(book.name)}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {book.author || '未知作者'}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {book.totalPages > 0 ? `${book.totalPages}页` : '页数未知'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      已读{book.readLogCount || 0}次
                    </span>
                  </div>
                </div>
              </div>

              {/* More Actions - 非批量模式才显示 */}
              {!batchMode && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 bg-white/90 hover:bg-white rounded"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(book)}>
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(book)}
                        className="text-destructive"
                      >
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={closeForm}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm"
              onClick={closeForm}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-[520px] max-h-[90vh] overflow-hidden flex flex-col z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingBook ? '编辑图书' : '添加图书'}
                </h2>
                <Button variant="ghost" size="icon" onClick={closeForm} className="rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto p-6">
                {/* 添加模式选择 */}
                {!editingBook && (
                  <div className="mb-6">
                    <Label className="text-sm font-medium text-gray-700 mb-3 block">添加方式</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAddMode('manual')}
                        className={cn(
                          'flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all border-2',
                          addMode === 'manual'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        ✏️ 手动输入
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddMode('isbn')}
                        className={cn(
                          'flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all border-2',
                          addMode === 'isbn'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        🔍 ISBN查询
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddMode('search')}
                        className={cn(
                          'flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all border-2',
                          addMode === 'search'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        📚 书名搜索
                      </button>
                    </div>
                  </div>
                )}

                {/* ISBN 查询模式 */}
                {!editingBook && addMode === 'isbn' && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-2xl">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">输入ISBN号</Label>
                    <div className="flex gap-2">
                      <Input
                        value={isbnInput}
                        onChange={(e) => setIsbnInput(e.target.value)}
                        placeholder="输入10位或13位ISBN号"
                        className="flex-1 rounded-xl h-12 bg-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleISBNLookup()}
                      />
                      <Button
                        type="button"
                        onClick={handleISBNLookup}
                        disabled={isbnLoading}
                        className="px-6 h-12 rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        {isbnLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '查询'}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      📖 ISBN通常印在书籍封底，形如 978-7-xxx-xxxxx-x
                    </p>
                  </div>
                )}

                {/* 书名搜索模式 */}
                {!editingBook && addMode === 'search' && (
                  <div className="mb-6 p-4 bg-green-50 rounded-2xl">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">搜索书籍</Label>
                    <div className="flex gap-2">
                      <Input
                        value={titleSearch}
                        onChange={(e) => setTitleSearch(e.target.value)}
                        placeholder="输入书名搜索..."
                        className="flex-1 rounded-xl h-12 bg-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleTitleSearch()}
   />
                      <Button
                        type="button"
                        onClick={handleTitleSearch}
                        disabled={isSearching}
                        className="px-6 h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white"
                      >
                        {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : '搜索'}
                      </Button>
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-60 overflow-auto">
                        {searchResults.map((book, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectSearchResult(book)}
                            className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-left"
                          >
                            {book.coverUrl ? (
                              <img src={book.coverUrl} alt={formatBookName(book.name)} className="w-10 h-14 object-cover rounded" loading="lazy" />
                            ) : (
                              <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{formatBookName(book.name)}</p>
                              <p className="text-xs text-gray-500 truncate">{book.author || '未知作者'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <form id="book-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Cover Upload */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">书籍封面</Label>
                    <div className="mt-2 flex items-center gap-4">
                      <div className="w-24 h-32 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                        {coverUrl ? (
                          <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen className="w-8 h-8 text-gray-300" />
                        )}
                      </div>
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-xl"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          上传封面
                        </Button>
                        <p className="text-xs text-gray-400 mt-2">支持 JPG、PNG，最大 2MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">书名 *</Label>
                    <Input
                      {...register('name')}
                      placeholder="输入书名"
                      className="mt-2 rounded-xl h-12 bg-gray-50 border-0"
                    />
                    {errors.name && (
                      <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Author */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">作者</Label>
                    <Input
                      {...register('author')}
                      placeholder="输入作者"
                      className="mt-2 rounded-xl h-12 bg-gray-50 border-0"
                    />
                  </div>

                  {/* Character Tag */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">性格养成标签</Label>
                    <Input
                      {...register('characterTag')}
                      placeholder="如：勇敢、诚实、坚持"
                      className="mt-2 rounded-xl h-12 bg-gray-50 border-0"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">图书类型</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {bookTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setValue('type', type.value as any)}
                          className={cn(
                            'px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                            selectedTypeValue === type.value
                              ? 'border-transparent text-white bg-gradient-to-r from-purple-500 to-blue-500'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                          )}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Total Pages */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">总页数</Label>
                    <Input
                      type="number"
                      {...register('totalPages', { valueAsNumber: true })}
                      placeholder="输入总页数"
                      className="mt-2 rounded-xl h-12 bg-gray-50 border-0"
                    />
                  </div>

                  {/* Word Count */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">总字数</Label>
                    <Input
                      type="number"
                      {...register('wordCount', { valueAsNumber: true })}
                      placeholder="输入总字数"
                      className="mt-2 rounded-xl h-12 bg-gray-50 border-0"
                    />
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeForm}
                    className="flex-1 rounded-xl h-12"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    form="book-form"
                    className="flex-1 rounded-xl h-12 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : editingBook ? (
                      '保存修改'
                    ) : (
                      '添加图书'
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Start Reading Dialog */}
      <AlertDialog open={!!startReadingBook} onOpenChange={() => setStartReadingBook(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>开始阅读</AlertDialogTitle>
            <AlertDialogDescription>
              选择孩子开始阅读「{startReadingBook && formatBookName(startReadingBook.name)}」
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            {children.map((child) => (
              <AlertDialogAction
                key={child.id}
                onClick={() => {
                  startReadingMutation.mutate({
                    bookId: startReadingBook!.id,
                    childId: child.id,
                  });
                }}
              >
                {child.avatar} {child.name}
              </AlertDialogAction>
            ))}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{bookToDelete && formatBookName(bookToDelete.name)}」吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>导入预览</AlertDialogTitle>
            <AlertDialogDescription>
              找到 {importPreview?.totalRecords || 0} 条记录，其中 {importPreview?.matchedCount || 0} 条可匹配现有书籍，{importPreview?.willCreateCount || 0} 条将创建新书
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-60 overflow-auto my-4">
            {importPreview?.records?.slice(0, 20).map((record: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 py-2 border-b border-gray-100 text-sm">
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs",
                  record.matchStatus === 'matched' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                )}>
                  {record.matchStatus === 'matched' ? '匹配' : '新建'}
                </span>
                <span className="font-medium">{record.bookName}</span>
                <span className="text-gray-400">{record.pages}页</span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowImportDialog(false)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={executeImport} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认导入'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* P1-6: Batch Finish Dialog */}
      <AlertDialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量标记已读完</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedBookIds.size > 0 
                ? `确定要将选中的 ${selectedBookIds.size} 本书标记为已读完吗？`
                : batchReadStage 
                  ? `确定要将「${batchReadStage}」阶段的所有书籍标记为已读完吗？`
                  : '请先选择书籍或阅读阶段'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBatchFinish}
              disabled={batchFinishMutation.isPending}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {batchFinishMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '确认标记'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}