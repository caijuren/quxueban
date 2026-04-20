import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  User,
  Tag,
  Plus,
  Trash2,
  Star,
  MessageSquare,
  Brain,
  Clock,
  FileText,
  Play,
  Heart,
  Edit3,
  Quote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { cn } from '@/lib/utils';

interface ReadingLog {
  id: number;
  readDate: string;
  effect: string;
  performance: string;
  note: string;
  readStage: string;
  pages: number;
  minutes: number;
  startPage: number;
  endPage: number;
  evidenceUrl: string;
  childId?: number;
  child?: {
    id: number;
    name: string;
    avatar: string;
  };
}

interface Book {
  id: number;
  name: string;
  author: string;
  type: string;
  coverUrl: string;
  readCount: number;
  totalPages: number;
  lastReadDate?: string | null;
  activeReadings: Array<{
    id: number;
    childId: number;
    readPages: number;
  }>;
  readingLogs: ReadingLog[];
  readState?: {
    id: number;
    status: string;
    finishedAt: string | null;
  } | null;
  totalReadPages: number;
  totalReadMinutes: number;
}

async function fetchBook(id: number): Promise<Book> {
  const { data } = await apiClient.get(`/library/${id}`);
  return data.data;
}

async function addReadingLog(bookId: number, log: Partial<ReadingLog>): Promise<ReadingLog> {
  const { data } = await apiClient.post(`/reading-logs/books/${bookId}/logs`, log);
  return data.data;
}

async function deleteReadingLog(id: number): Promise<void> {
  await apiClient.delete(`/reading-logs/logs/${id}`);
}

async function startNewReading(bookId: number, childId: number): Promise<void> {
  await apiClient.post(`/library/${bookId}/start`, { childId });
}

async function updateBookState(bookId: number, childId: number, status: string, finishedAt?: string): Promise<void> {
  await apiClient.post(`/library/${bookId}/state`, { childId, status, finishedAt });
}

const typeLabels: Record<string, string> = {
  children: '儿童故事',
  tradition: '传统文化',
  science: '科普',
  character: '性格养成、其他',
};

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [logToDelete, setLogToDelete] = useState<number | null>(null);
  const { selectedChildId } = useSelectedChild();
  const detailStoragePrefix = useMemo(
    () => `${selectedChildId ?? 'pending'}_${id ?? 'book'}`,
    [selectedChildId, id]
  );
  
  // P1-9: 书籍详情增强 - 评分、评论、笔记
  const [bookRating, setBookRating] = useState<number>(() => {
    const saved = localStorage.getItem(`book_rating_${detailStoragePrefix}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [bookReview, setBookReview] = useState<string>(() => {
    return localStorage.getItem(`book_review_${detailStoragePrefix}`) || '';
  });
  const [bookNotes, setBookNotes] = useState<string>(() => {
    return localStorage.getItem(`book_notes_${detailStoragePrefix}`) || '';
  });
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    const saved = localStorage.getItem(`book_favorite_${detailStoragePrefix}`);
    return saved ? saved === 'true' : false;
  });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [reviewInput, setReviewInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  useEffect(() => {
    const savedRating = localStorage.getItem(`book_rating_${detailStoragePrefix}`);
    const savedReview = localStorage.getItem(`book_review_${detailStoragePrefix}`) || '';
    const savedNotes = localStorage.getItem(`book_notes_${detailStoragePrefix}`) || '';
    const savedFavorite = localStorage.getItem(`book_favorite_${detailStoragePrefix}`);

    setBookRating(savedRating ? parseInt(savedRating, 10) : 0);
    setBookReview(savedReview);
    setBookNotes(savedNotes);
    setIsFavorite(savedFavorite === 'true');
  }, [detailStoragePrefix]);

  const { data: book, isLoading, error } = useQuery({
    queryKey: ['book', id],
    queryFn: async () => {
      const bookId = Number(id);
      console.log('[BookDetail] Fetching book with ID:', bookId, 'URL ID:', id);
      const data = await fetchBook(bookId);
      console.log('[BookDetail] Received book:', data);
      // 验证返回的数据 ID 是否匹配
      if (data.id !== bookId) {
        console.error(`[BookDetail] ID mismatch! Expected ${bookId}, got ${data.id}`);
        throw new Error(`数据错误：请求的书籍ID(${bookId})与返回的ID(${data.id})不匹配`);
      }
      return data;
    },
    enabled: !!id,
  });

  const addMutation = useMutation({
    mutationFn: (log: Partial<ReadingLog>) => addReadingLog(Number(id), log),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success('阅读记录添加成功');
      setShowAddForm(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReadingLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success('阅读记录删除成功');
      setLogToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const startNewReadingMutation = useMutation({
    mutationFn: (childId: number) => startNewReading(Number(id), childId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success('已开始新一轮阅读');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateReadStateMutation = useMutation({
    mutationFn: ({ status }: { status: string }) => updateBookState(Number(id), selectedChildId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success('阅读状态已更新');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // 计算阅读进度
  const calculateProgress = () => {
    if (!book || !book.totalPages) return 0;
    return Math.round((book.totalReadPages / book.totalPages) * 100);
  };
  
  // P1-9: 保存评分
  const handleRateBook = (rating: number) => {
    setBookRating(rating);
    localStorage.setItem(`book_rating_${detailStoragePrefix}`, String(rating));
    toast.success(`已评分 ${rating} 星`);
  };
  
  // P1-9: 保存评论
  const handleSaveReview = () => {
    if (reviewInput.trim()) {
      setBookReview(reviewInput.trim());
      localStorage.setItem(`book_review_${detailStoragePrefix}`, reviewInput.trim());
      toast.success('评论已保存');
      setShowReviewForm(false);
    }
  };
  
  // P1-9: 保存笔记
  const handleSaveNotes = () => {
    if (notesInput.trim()) {
      setBookNotes(notesInput.trim());
      localStorage.setItem(`book_notes_${detailStoragePrefix}`, notesInput.trim());
      toast.success('笔记已保存');
      setShowNotesForm(false);
    }
  };
  
  // P1-9: 切换收藏
  const handleToggleFavorite = () => {
    const newValue = !isFavorite;
    setIsFavorite(newValue);
    localStorage.setItem(`book_favorite_${detailStoragePrefix}`, String(newValue));
    toast.success(newValue ? '已添加到收藏' : '已取消收藏');
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-medium">加载失败</p>
        <p className="text-gray-500 text-sm mt-2">{getErrorMessage(error)}</p>
        <p className="text-gray-400 text-xs mt-1">书籍ID: {id}</p>
        <Button onClick={() => navigate('/parent/library')} className="mt-4">返回图书馆</Button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">书籍不存在</p>
        <p className="text-gray-400 text-xs mt-1">书籍ID: {id}</p>
        <Button onClick={() => navigate('/parent/library')} className="mt-4">返回图书馆</Button>
      </div>
    );
  }

  const progress = calculateProgress();
  const isFinished = book.readState?.status === 'finished';
  const readingStatus = isFinished ? '已读完' : book.activeReadings?.length > 0 ? '在读中' : book.readState?.status === 'paused' ? '搁置中' : '想读';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/parent/library')} className="rounded-xl">
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">书籍详情</h1>
      </div>

      {/* Book Info Card */}
      <Card className="border border-border/70 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex gap-6">
            {/* Cover */}
            <div className="size-32 rounded-2xl bg-primary/80 flex items-center justify-center text-6xl shrink-0 shadow-lg">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.name} className="size-full rounded-2xl object-cover" />
              ) : (
                '📖'
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{book.name}</h2>
              <div className="mt-2 space-y-1 text-gray-600">
                {book.author && (
                  <div className="flex items-center gap-2">
                    <User className="size-4" />
                    <span>{book.author}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Tag className="size-4" />
                  <span>{typeLabels[book.type] || book.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="size-4" />
                  <span>{book.totalPages} 页</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4" />
                  <span>已读 {book.totalReadMinutes} 分钟</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {readingStatus}
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  已读 {book.readCount} 次
                </div>
                {book.totalPages > 0 && (
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                    {book.totalReadPages}/{book.totalPages} 页
                  </div>
                )}
              </div>
              
              {/* Reading Progress */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">阅读进度</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-slate-50/80 p-4">
                  <p className="text-xs text-muted-foreground">当前状态</p>
                  <p className="mt-2 text-base font-semibold text-foreground">{readingStatus}</p>
                </div>
                <div className="rounded-2xl border border-border bg-slate-50/80 p-4">
                  <p className="text-xs text-muted-foreground">累计记录</p>
                  <p className="mt-2 text-base font-semibold text-foreground">{book.readingLogs.length} 条</p>
                </div>
                <div className="rounded-2xl border border-border bg-slate-50/80 p-4">
                  <p className="text-xs text-muted-foreground">最近阅读</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {book.lastReadDate ? new Date(book.lastReadDate).toLocaleDateString('zh-CN') : '暂无'}
                  </p>
                </div>
              </div>

              {/* P1-9: 评分和收藏 */}
              <div className="mt-5 flex items-center gap-4 flex-wrap">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={readingStatus === '想读' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => updateReadStateMutation.mutate({ status: 'want_to_read' })}
                    disabled={!selectedChildId || updateReadStateMutation.isPending}
                  >
                    想读
                  </Button>
                  <Button
                    variant={readingStatus === '在读中' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => {
                      if (book.activeReadings?.length > 0) {
                        updateReadStateMutation.mutate({ status: 'reading' });
                      } else if (selectedChildId) {
                        startNewReadingMutation.mutate(selectedChildId);
                      }
                    }}
                    disabled={!selectedChildId || startNewReadingMutation.isPending || updateReadStateMutation.isPending}
                  >
                    在读
                  </Button>
                  <Button
                    variant={readingStatus === '已读完' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => updateReadStateMutation.mutate({ status: 'finished' })}
                    disabled={!selectedChildId || updateReadStateMutation.isPending}
                  >
                    已读
                  </Button>
                  <Button
                    variant={readingStatus === '搁置中' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => updateReadStateMutation.mutate({ status: 'paused' })}
                    disabled={!selectedChildId || updateReadStateMutation.isPending}
                  >
                    搁置
                  </Button>
                </div>

                {/* 评分 */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRateBook(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={cn(
                          "size-5 transition-colors",
                          star <= bookRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-300 hover:text-amber-300"
                        )}
                      />
                    </button>
                  ))}
                  {bookRating > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {bookRating} 星
                    </span>
                  )}
                </div>
                
                {/* 收藏按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleFavorite}
                  className={cn(
                    "gap-1 rounded-lg",
                    isFavorite && "text-red-500 hover:text-red-600"
                  )}
                >
                  <Heart
                    className={cn(
                      "size-4",
                      isFavorite && "fill-current"
                    )}
                  />
                  {isFavorite ? '已收藏' : '收藏'}
                </Button>
                
                {isFinished && selectedChildId && (
                  <Button 
                    onClick={() => startNewReadingMutation.mutate(selectedChildId)}
                    className="gap-2 rounded-xl bg-primary text-white"
                  >
                    <Play className="size-4" />
                    开始新一轮阅读
                  </Button>
                )}
                <Button 
                  onClick={() => navigate(`/parent/library/${id}/insights`)}
                  className="gap-2 rounded-xl bg-primary text-primary-foreground"
                >
                  <Brain className="size-4" />
                  AI阅读洞察
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        {/* 阅读记录主区 */}
        <Card className="border border-border/70 shadow-sm rounded-3xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                <h3 className="font-semibold text-gray-900">阅读记录</h3>
              </div>
              <Button onClick={() => setShowAddForm(true)} className="gap-2 rounded-xl">
                <Plus className="size-4" />
                添加记录
              </Button>
            </div>

            {book.readingLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-12 text-center">
                <BookOpen className="size-12 text-gray-300 mx-auto mb-4" />
                <p className="text-base font-medium text-gray-700">还没有阅读记录</p>
                <p className="text-sm mt-2 text-gray-500">记录每次阅读的页数、时长和备注，才能看见真实的阅读进展。</p>
                <Button onClick={() => setShowAddForm(true)} className="mt-4 rounded-xl">添加第一条记录</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {book.readingLogs.map((log, index) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border border-border/70 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">
                                {new Date(log.readDate).toLocaleDateString('zh-CN')}
                              </span>
                              {log.startPage > 0 && log.endPage > 0 && (
                                <Badge variant="secondary" className="rounded-full">
                                  第 {log.startPage}-{log.endPage} 页
                                </Badge>
                              )}
                              {log.minutes > 0 && (
                                <Badge variant="outline" className="rounded-full">
                                  {log.minutes} 分钟
                                </Badge>
                              )}
                              {log.readStage && (
                                <Badge variant="outline" className="rounded-full">
                                  {log.readStage}
                                </Badge>
                              )}
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700">
                              {log.effect && (
                                <div className="flex items-center gap-2">
                                  <Star className="size-4 text-amber-500" />
                                  <span>阅读效果：{log.effect}</span>
                                </div>
                              )}
                              {log.performance && (
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="size-4 text-purple-500" />
                                  <span>孩子表现：{log.performance}</span>
                                </div>
                              )}
                              {log.note && (
                                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-gray-600">
                                  {log.note}
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLogToDelete(log.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes & Insights */}
        <div className="space-y-4">
          <Card className="border border-border/70 shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-5 text-blue-500" />
                  <h3 className="font-semibold text-gray-900">我的评论</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReviewInput(bookReview);
                    setShowReviewForm(true);
                  }}
                  className="rounded-lg"
                >
                  <Edit3 className="size-4 mr-1" />
                  {bookReview ? '编辑' : '写评论'}
                </Button>
              </div>
              {bookReview ? (
                <div className="bg-blue-50 rounded-xl p-4">
                  <Quote className="size-4 text-blue-400 mb-2" />
                  <p className="text-gray-700 leading-relaxed">{bookReview}</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无评论，写下你的读后感吧</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70 shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-green-500" />
                  <h3 className="font-semibold text-gray-900">阅读笔记</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNotesInput(bookNotes);
                    setShowNotesForm(true);
                  }}
                  className="rounded-lg"
                >
                  <Edit3 className="size-4 mr-1" />
                  {bookNotes ? '编辑' : '记笔记'}
                </Button>
              </div>
              {bookNotes ? (
                <div className="bg-green-50 rounded-xl p-4">
                  <pre className="text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{bookNotes}</pre>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无笔记，记录阅读心得和摘抄</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Reading Log Dialog */}
      {showAddForm && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowAddForm(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-x-4 top-8 bottom-8 lg:inset-auto lg:top-1/2 lg:-translate-y-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:w-[560px] lg:max-h-[84vh] bg-white rounded-3xl shadow-2xl z-50 p-6 overflow-auto"
          >
            <h3 className="text-lg font-semibold mb-2">添加阅读记录</h3>
            <p className="text-sm text-muted-foreground mb-5">记录这次阅读读了多少、读了多久，以及孩子的表现和备注。</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedChildId) {
                  toast.error('请选择一个孩子');
                  return;
                }
                const formData = new FormData(e.currentTarget);
                addMutation.mutate({
                  childId: selectedChildId,
                  readDate: formData.get('readDate') as string || new Date().toISOString(),
                  effect: formData.get('effect') as string,
                  performance: formData.get('performance') as string,
                  note: formData.get('note') as string,
                  readStage: formData.get('readStage') as string,
                  pages: parseInt(formData.get('pages') as string) || 0,
                  minutes: parseInt(formData.get('minutes') as string) || 0,
                  startPage: parseInt(formData.get('startPage') as string) || 0,
                  endPage: parseInt(formData.get('endPage') as string) || 0,
                  evidenceUrl: formData.get('evidenceUrl') as string || '',
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">阅读日期</label>
                  <input
                    type="date"
                    name="readDate"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">阅读时长（分钟）</label>
                  <input
                    type="number"
                    name="minutes"
                    placeholder="30"
                    min="0"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始页数</label>
                  <input
                    type="number"
                    name="startPage"
                    placeholder="0"
                    min="0"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束页数</label>
                  <input
                    type="number"
                    name="endPage"
                    placeholder="0"
                    min="0"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">阅读阶段</label>
                <input
                  type="text"
                  name="readStage"
                  placeholder="如：中班上 / 自主阅读 / 亲子共读"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">孩子表现</label>
                <input
                  type="text"
                  name="performance"
                  placeholder="如：比较专注、需要提醒、愿意复述内容"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">阅读效果</label>
                <select
                  name="effect"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">选择效果</option>
                  <option value="很好">很好 ⭐⭐⭐⭐⭐</option>
                  <option value="较好">较好 ⭐⭐⭐⭐</option>
                  <option value="一般">一般 ⭐⭐⭐</option>
                  <option value="需加强">需加强 ⭐⭐</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">证据链接（可选）</label>
                <input
                  type="url"
                  name="evidenceUrl"
                  placeholder="如：照片或视频链接"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注 / 心得</label>
                <textarea
                  name="note"
                  rows={3}
                  placeholder="记录读了哪一章、孩子的反馈、值得记下的内容..."
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className="flex-1 rounded-xl">取消</Button>
                <Button type="submit" disabled={addMutation.isPending} className="flex-1 rounded-xl bg-primary text-primary-foreground">保存</Button>
              </div>
            </form>
          </motion.div>
        </>
      )}

      {/* Delete Confirmation */}
      {logToDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setLogToDelete(null)}>
          <Card className="border-0 shadow-2xl rounded-3xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 text-center">
              <p className="text-gray-700 mb-4">确定删除这条阅读记录吗？</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setLogToDelete(null)} className="flex-1 rounded-xl">取消</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(logToDelete)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 rounded-xl"
                >
                  删除
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* P1-9: 评论编辑对话框 */}
      {showReviewForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReviewForm(false)}>
          <Card className="border-0 shadow-2xl rounded-3xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="size-5 text-blue-500" />
                {bookReview ? '编辑评论' : '写评论'}
              </h3>
              <textarea
                value={reviewInput}
                onChange={(e) => setReviewInput(e.target.value)}
                placeholder="分享你的读后感..."
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowReviewForm(false)} className="flex-1 rounded-xl">
                  取消
                </Button>
                <Button onClick={handleSaveReview} className="flex-1 rounded-xl bg-blue-500 hover:bg-blue-600 text-white">
                  保存评论
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* P1-9: 笔记编辑对话框 */}
      {showNotesForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNotesForm(false)}>
          <Card className="border-0 shadow-2xl rounded-3xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="size-5 text-green-500" />
                {bookNotes ? '编辑笔记' : '记笔记'}
              </h3>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="记录阅读心得、摘抄好词好句..."
                rows={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none font-mono text-sm"
              />
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowNotesForm(false)} className="flex-1 rounded-xl">
                  取消
                </Button>
                <Button onClick={handleSaveNotes} className="flex-1 rounded-xl bg-green-500 hover:bg-green-600 text-white">
                  保存笔记
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
