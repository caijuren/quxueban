import { useState, useRef } from 'react';
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

// Types
interface Book {
  id: number;
  name: string;
  author: string;
  type: string;
  characterTag: string;
  coverUrl: string;
  totalPages: number;
  readCount: number;
  activeReadings: Array<{
    id: number;
    childId: number;
    readPages: number;
  }>;
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
}

// Schema
const bookSchema = z.object({
  name: z.string().min(1, '请输入书名'),
  author: z.string().optional(),
  type: z.enum(['fiction', 'nonfiction', 'science', 'history', 'biography', 'other']),
  characterTag: z.string().optional(),
  coverUrl: z.string().optional(),
  totalPages: z.number().min(0, '页数不能为负数').optional(),
});

type BookFormData = z.infer<typeof bookSchema>;

// API functions
async function fetchBooks(search?: string, type?: string): Promise<Book[]> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (type && type !== 'all') params.append('type', type);
  const { data } = await apiClient.get(`/library?${params}`);
  return data.data || [];
}

async function fetchLibraryStats(): Promise<LibraryStats> {
  const { data } = await apiClient.get('/library/stats');
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
  { value: 'fiction', label: '虚构类' },
  { value: 'nonfiction', label: '非虚构' },
  { value: 'science', label: '科普' },
  { value: 'history', label: '历史' },
  { value: 'biography', label: '传记' },
  { value: 'other', label: '其他' },
];

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [startReadingBook, setStartReadingBook] = useState<Book | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{imported: number; skipped: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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
      type: 'fiction',
      characterTag: '',
      coverUrl: '',
      totalPages: 0,
    },
  });

  const selectedTypeValue = watch('type');
  const coverUrl = watch('coverUrl');

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['library', searchQuery, selectedType],
    queryFn: () => fetchBooks(searchQuery, selectedType),
  });

  const { data: stats } = useQuery({
    queryKey: ['libraryStats'],
    queryFn: fetchLibraryStats,
  });

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
  });

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

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('请选择Excel文件 (.xlsx 或 .xls)');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const { data } = await apiClient.post('/library/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportResult({
        imported: data.data.imported,
        skipped: data.data.skipped,
      });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">图书馆</h1>
          <p className="text-gray-500 mt-1">管理家庭藏书，开始新的阅读之旅</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="rounded-xl h-11"
          >
            <Upload className="w-5 h-5 mr-2" />
            {importing ? '导入中...' : '批量导入'}
          </Button>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl px-6 h-11 shadow-lg shadow-purple-500/25"
          >
            <Plus className="w-5 h-5 mr-2" />
            添加图书
          </Button>
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
                  ✅ 成功导入 {importResult.imported} 本，跳过 {importResult.skipped} 本（已存在）
                </p>
              </div>
              <Button variant="ghost" onClick={() => setImportResult(null)}>关闭</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">总藏书</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats?.totalBooks || 0}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <LibraryIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">本月新增</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                +{stats?.newThisMonth || 0}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">阅读次数最多</p>
              <p className="text-lg font-bold text-gray-900 mt-1 truncate">
                {stats?.topBooks?.[0]?.name || '暂无'}
              </p>
              <p className="text-xs text-gray-400">
                {stats?.topBooks?.[0]?.readCount
                  ? `已读 ${stats.topBooks[0].readCount} 次`
                  : ''}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <span className="text-2xl">🏆</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="搜索书名..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl h-12 bg-white border-gray-200"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedType('all')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              selectedType === 'all'
                ? 'bg-purple-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            )}
          >
            全部
          </button>
          {bookTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                selectedType === type.value
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Books Grid */}
      {books.length === 0 ? (
        <div className="text-center py-16 bg-white/50 rounded-3xl border border-dashed border-gray-200">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <LibraryIcon className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 text-lg">图书馆还是空的</h3>
          <p className="text-gray-500 mt-1">添加第一本书开始阅读之旅</p>
          <Button
            onClick={() => setShowAddForm(true)}
            className="mt-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white"
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
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
                {/* Cover */}
                <div className="aspect-[3/4] relative bg-gradient-to-br from-gray-100 to-gray-200">
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  {/* Character Tag */}
                  {book.characterTag && (
                    <div className="absolute top-2 left-2">
                      <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded-full">
                        {book.characterTag}
                      </span>
                    </div>
                  )}
                  {/* Reading Badge */}
                  {book.activeReadings.length > 0 && (
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded-full">
                        在读中
                      </span>
                    </div>
                  )}
                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setStartReadingBook(book)}
                      className="bg-white text-gray-900 hover:bg-gray-100 rounded-full"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      开始阅读
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 cursor-pointer" onClick={() => navigate(`/parent/library/${book.id}`)}>
                  <h4 className="font-semibold text-gray-900 text-sm truncate">
                    {book.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {book.author || '未知作者'}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      {book.totalPages > 0 ? `${book.totalPages}页` : '页数未知'}
                    </span>
                    <span className="text-xs text-gray-400">
                      已读{book.readCount}次
                    </span>
                  </div>
                </div>
              </div>

              {/* More Actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 bg-white/90 hover:bg-white rounded-full"
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
                      className="text-red-600"
                    >
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
              onClick={closeForm}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[480px] lg:max-h-[85vh] bg-white rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
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
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 space-y-3">
                <Button
                  type="submit"
                  form="book-form"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25"
                >
                  {editingBook ? '保存修改' : '添加图书'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-xl"
                  onClick={closeForm}
                >
                  取消
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Start Reading Dialog */}
      <AlertDialog
        open={!!startReadingBook}
        onOpenChange={() => setStartReadingBook(null)}
      >
        <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">选择阅读的孩子</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              选择要开始阅读《{startReadingBook?.name}》的孩子
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() =>
                  startReadingBook &&
                  startReadingMutation.mutate({
                    bookId: startReadingBook.id,
                    childId: child.id,
                  })
                }
                disabled={
                  startReadingBook?.activeReadings.some(
                    (r) => r.childId === child.id
                  ) || startReadingMutation.isPending
                }
                className={cn(
                  'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                  startReadingBook?.activeReadings.some((r) => r.childId === child.id)
                    ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'border-gray-200 hover:border-purple-500 hover:bg-purple-50'
                )}
              >
                <span className="text-2xl">{child.avatar}</span>
                <span className="font-medium">{child.name}</span>
                {startReadingBook?.activeReadings.some((r) => r.childId === child.id) && (
                  <span className="ml-auto text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full">
                    已在读
                  </span>
                )}
              </button>
            ))}
          </div>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl h-11">取消</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">确认删除图书？</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              删除后无法恢复，确定要删除《{bookToDelete?.name}》吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl h-11">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 rounded-xl h-11"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
