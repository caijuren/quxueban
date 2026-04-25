import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Clock,
  TrendingUp,
  Plus,
  Minus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// Types
interface ActiveReading {
  id: number;
  bookId: number;
  childId: number;
  readPages: number;
  readCount: number;
  status: string;
  startedAt: string;
  book: {
    id: number;
    name: string;
    coverUrl: string;
    totalPages: number;
  };
}

interface ReadingStats {
  readingCount: number;
  weekReadCount: number;
  monthReadCount: number;
}

// API functions
async function fetchActiveReadings(childId?: number): Promise<ActiveReading[]> {
  const params = childId ? `?childId=${childId}` : '';
  const { data } = await apiClient.get(`/reading${params}`);
  return data.data || [];
}

async function fetchReadingStats(childId?: number): Promise<ReadingStats> {
  const params = childId ? `?childId=${childId}` : '';
  const { data } = await apiClient.get(`/reading/stats${params}`);
  return data.data;
}

async function updateProgress(id: number, pagesRead: number): Promise<void> {
  await apiClient.post(`/reading/${id}/progress`, { pagesRead });
}

async function stopReading(id: number): Promise<void> {
  await apiClient.delete(`/reading/${id}`);
}

export default function ReadingPage() {
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedReading, setSelectedReading] = useState<ActiveReading | null>(null);
  const [pagesRead, setPagesRead] = useState('');
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [readingToStop, setReadingToStop] = useState<ActiveReading | null>(null);

  const queryClient = useQueryClient();
  const { selectedChildId, selectedChild } = useSelectedChild();

  const { data: readings = [], isLoading } = useQuery({
    queryKey: ['reading', selectedChildId],
    queryFn: () =>
      fetchActiveReadings(selectedChildId || undefined),
  });

  const { data: stats } = useQuery({
    queryKey: ['readingStats', selectedChildId],
    queryFn: () =>
      fetchReadingStats(selectedChildId || undefined),
  });

  const progressMutation = useMutation({
    mutationFn: ({ id, pages }: { id: number; pages: number }) =>
      updateProgress(id, pages),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading'] });
      queryClient.invalidateQueries({ queryKey: ['readingStats'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success('阅读进度已更新');
      setProgressDialogOpen(false);
      setSelectedReading(null);
      setPagesRead('');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const stopMutation = useMutation({
    mutationFn: stopReading,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading'] });
      queryClient.invalidateQueries({ queryKey: ['readingStats'] });
      toast.success('已停止阅读');
      setStopDialogOpen(false);
      setReadingToStop(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const handleUpdateProgress = (reading: ActiveReading) => {
    setSelectedReading(reading);
    setPagesRead('');
    setProgressDialogOpen(true);
  };

  const handleSubmitProgress = () => {
    const pages = parseInt(pagesRead);
    if (!pages || pages < 1) {
      toast.error('请输入有效的页数');
      return;
    }
    if (selectedReading) {
      progressMutation.mutate({ id: selectedReading.id, pages });
    }
  };

  const handleStopReading = (reading: ActiveReading) => {
    setReadingToStop(reading);
    setStopDialogOpen(true);
  };

  const confirmStop = () => {
    if (readingToStop) {
      stopMutation.mutate(readingToStop.id);
    }
  };

  const getProgressPercentage = (read: number, total: number) => {
    if (total <= 0) return 0;
    return Math.min(Math.round((read / total) * 100), 100);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-sky-50/70 via-white to-indigo-50/40 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="rounded-full px-3 py-1">阅读中心</Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                {selectedChild?.name || '当前孩子'} 的在读图书与阅读进度
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                这里集中查看当前在读、最近阅读次数和本月阅读节奏。更新进度后，图书馆和统计页会同步变化。
              </p>
            </div>
            <Button
              onClick={() => (window.location.href = '/parent/library')}
              className="rounded-xl shadow-sm"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              去图书馆选书
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-border/70"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">在读中</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats?.readingCount || 0}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-border/70"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">本周阅读</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats?.weekReadCount || 0}次
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-border/70"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">本月阅读</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats?.monthReadCount || 0}次
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </motion.div>
      </div>



      {/* Reading List */}
      {readings.length === 0 ? (
        <div className="text-center py-16 bg-white/60 rounded-3xl border border-dashed border-gray-200">
          <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 text-lg">暂无在读图书</h3>
          <p className="text-gray-500 mt-1">先去图书馆挑一本书，再回来持续记录阅读进度。</p>
          <Button
            onClick={() => (window.location.href = '/parent/library')}
            className="mt-4 rounded-xl bg-primary text-primary-foreground"
          >
            去图书馆选书
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {readings.map((reading, index) => {
            const progress = getProgressPercentage(
              reading.readPages,
              reading.book.totalPages
            );
            return (
              <motion.div
                key={reading.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl p-5 shadow-sm border border-border/70 hover:shadow-md transition-all duration-300"
              >
                <div className="flex gap-4">
                  {/* Cover */}
                  <div className="w-20 h-28 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden">
                    {reading.book.coverUrl ? (
                      <img
                        src={reading.book.coverUrl}
                        alt={reading.book.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {reading.book.name}
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      开始于 {new Date(reading.startedAt).toLocaleDateString()}
                    </p>

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">
                          已读 {reading.readPages}/
                          {reading.book.totalPages || '?'} 页
                        </span>
                        <span className="font-medium text-primary">
                          {progress}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            progress >= 100
                              ? 'bg-emerald-500'
                              : 'bg-primary'
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                      <span>已读 {reading.readCount} 次</span>
                      <span>{reading.readPages}/{reading.book.totalPages || '?'} 页</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateProgress(reading)}
                        className="flex-1 rounded-xl bg-primary text-primary-foreground"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        更新进度
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStopReading(reading)}
                        className="rounded-xl"
                      >
                        <Minus className="w-4 h-4 mr-1" />
                        停止阅读
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Update Progress Dialog */}
      <AlertDialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">更新阅读进度</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              《{selectedReading?.book.name}》
              <br />
              当前已读 {selectedReading?.readPages}/
              {selectedReading?.book.totalPages} 页
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium text-gray-700">
              本次阅读页数
            </Label>
            <Input
              type="number"
              min={1}
              value={pagesRead}
              onChange={(e) => setPagesRead(e.target.value)}
              placeholder="输入本次阅读的页数"
              className="mt-2 rounded-xl h-12"
              autoFocus
            />
          </div>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl h-11">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitProgress}
              disabled={progressMutation.isPending}
              className="bg-purple-500 hover:bg-purple-600 rounded-xl h-11"
            >
              {progressMutation.isPending ? '更新中...' : '确认更新'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stop Reading Dialog */}
      <AlertDialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">确认停止阅读？</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              停止后《{readingToStop?.book.name}》将从阅读列表移除，
              但阅读记录会保留在图书馆中。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl h-11">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStop}
              className="bg-red-500 hover:bg-red-600 rounded-xl h-11"
            >
              确认停止
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
