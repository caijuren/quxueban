import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

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
  readingLogs: ReadingLog[];
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

  const { data: book, isLoading } = useQuery({
    queryKey: ['book', id],
    queryFn: () => fetchBook(Number(id)),
    enabled: !!id,
  });

  const addMutation = useMutation({
    mutationFn: (log: Partial<ReadingLog>) => addReadingLog(Number(id), log),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      toast.success('阅读记录添加成功');
      setShowAddForm(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReadingLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      toast.success('阅读记录删除成功');
      setLogToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">书籍不存在</p>
        <Button onClick={() => navigate('/parent/library')} className="mt-4">返回图书馆</Button>
      </div>
    );
  }

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
      <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex gap-6">
            {/* Cover */}
            <div className="size-32 rounded-2xl bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-6xl shrink-0 shadow-lg">
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
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="px-4 py-2 rounded-xl bg-purple-100 text-purple-700 font-medium">
                  📚 已读 {book.readCount} 次
                </div>
                <Button 
                  onClick={() => navigate(`/parent/library/${id}/insights`)}
                  className="gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white"
                >
                  <Brain className="size-4" />
                  AI阅读洞察
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reading Logs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">阅读记录</h3>
          <Button onClick={() => setShowAddForm(true)} className="gap-2 rounded-xl">
            <Plus className="size-4" />
            添加记录
          </Button>
        </div>

        {book.readingLogs.length === 0 ? (
          <Card className="border-0 shadow-lg rounded-3xl">
            <CardContent className="py-12 text-center">
              <BookOpen className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无阅读记录</p>
              <Button onClick={() => setShowAddForm(true)} className="mt-4 rounded-xl">添加第一条记录</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {book.readingLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-0 shadow-md rounded-2xl hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Calendar className="size-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {new Date(log.readDate).toLocaleDateString('zh-CN')}
                          </span>
                          {log.readStage && (
                            <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700 text-xs">
                              {log.readStage}
                            </span>
                          )}
                          {log.startPage > 0 && log.endPage > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-green-100 text-green-700 text-xs">
                              第 {log.startPage}-{log.endPage} 页
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-3 space-y-2">
                          {log.effect && (
                            <div className="flex items-center gap-2">
                              <Star className="size-4 text-amber-500" />
                              <span className="text-gray-700">阅读效果：{log.effect}</span>
                            </div>
                          )}
                          {log.performance && (
                            <div className="flex items-center gap-2">
                              <MessageSquare className="size-4 text-purple-500" />
                              <span className="text-gray-700">表现：{log.performance}</span>
                            </div>
                          )}
                          {log.evidenceUrl && (
                            <div className="flex items-center gap-2">
                              <img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=document%20evidence%20icon&image_size=square" alt="证据" className="size-4" />
                              <a href={log.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">查看证据</a>
                            </div>
                          )}
                          {log.note && (
                            <p className="text-gray-500 text-sm mt-2 pl-6">{log.note}</p>
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
      </div>

      {/* Add Reading Log Dialog */}
      {showAddForm && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowAddForm(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 lg:inset-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-[480px] bg-white rounded-3xl shadow-2xl z-50 p-6 max-h-[80vh] overflow-auto"
          >
            <h3 className="text-lg font-semibold mb-4">添加阅读记录</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addMutation.mutate({
                  readDate: formData.get('readDate') as string || new Date().toISOString(),
                  effect: formData.get('effect') as string,
                  performance: formData.get('performance') as string,
                  note: formData.get('note') as string,
                  readStage: formData.get('readStage') as string,
                  startPage: parseInt(formData.get('startPage') as string) || 0,
                  endPage: parseInt(formData.get('endPage') as string) || 0,
                  evidenceUrl: formData.get('evidenceUrl') as string,
                });
              }}
              className="space-y-4"
            >
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
                <label className="block text-sm font-medium text-gray-700 mb-1">孩子表现</label>
                <input
                  type="text"
                  name="performance"
                  placeholder="孩子阅读时的表现"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">阅读阶段</label>
                <input
                  type="text"
                  name="readStage"
                  placeholder="如：中班上"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">证据链接（可选）</label>
                <input
                  type="url"
                  name="evidenceUrl"
                  placeholder="如：照片或视频链接"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  name="note"
                  rows={2}
                  placeholder="其他备注..."
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className="flex-1 rounded-xl">取消</Button>
                <Button type="submit" disabled={addMutation.isPending} className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white">保存</Button>
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
    </div>
  );
}
