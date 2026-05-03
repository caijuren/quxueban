import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Clock,
  Lightbulb,
  Users,
  RefreshCw,
  Loader2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { toast } from 'sonner';

interface BookAIInsight {
  id: number;
  bookId: number;
  childId: number | null;
  insights: {
    contentAnalysis: string;
    readingProgress: string;
    abilityDevelopment: string;
    readingSuggestions: string;
    parentGuidance: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Book {
  id: number;
  name: string;
  author: string;
  coverUrl: string;
  totalPages: number;
  isbn: string;
  publisher: string;
  description?: string;
  readingLogs?: Array<{
    id: number;
    readDate: string;
    note: string;
    minutes: number;
    startPage: number;
    endPage: number;
  }>;
  totalReadMinutes?: number;
  totalReadPages?: number;
}

async function fetchBookInsights(bookId: number): Promise<BookAIInsight | null> {
  const { data } = await apiClient.get(`/ai-insights/books/${bookId}`);
  return data.data;
}

async function generateBookInsights(bookId: number, childId?: number | null): Promise<BookAIInsight> {
  const { data } = await apiClient.post(`/ai-insights/books/${bookId}/generate`, { childId });
  return data.data;
}

async function fetchBook(bookId: number, childId?: number | null): Promise<Book> {
  const params = childId ? `?childId=${childId}` : '';
  const { data } = await apiClient.get(`/library/${bookId}${params}`);
  return data.data;
}

function InsightCard({
  icon: Icon,
  title,
  children,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  children: string;
  tone: string;
}) {
  return (
    <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <CardContent className="p-6">
        <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-950">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </h4>
        <p className="text-sm leading-7 text-slate-700">{children || '暂无内容，请重新生成分析。'}</p>
      </CardContent>
    </Card>
  );
}

export default function BookInsightsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedChildId, selectedChild } = useSelectedChild();

  const { data: book, isLoading: isLoadingBook } = useQuery({
    queryKey: ['book', id, selectedChildId],
    queryFn: () => fetchBook(Number(id), selectedChildId),
    enabled: !!id,
  });

  const { data: insights, isLoading: isLoadingInsights } = useQuery({
    queryKey: ['book-insights', id],
    queryFn: () => fetchBookInsights(Number(id)),
    enabled: !!id,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateBookInsights(Number(id), selectedChildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-insights', id] });
      toast.success('阅读分析已生成');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoadingBook || isLoadingInsights) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
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

  const readingLogCount = book.readingLogs?.length || 0;

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/parent/library/${id}`)} className="size-9 rounded-lg">
          <ArrowLeft className="size-5" />
        </Button>
        <button onClick={() => navigate(`/parent/library/${id}`)} className="hover:text-primary">返回书籍详情</button>
      </div>

      <Card className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="h-40 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-100 to-violet-400 shadow-lg">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-4 text-center text-xl font-bold text-white">《{book.name.slice(0, 4)}》</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-50">阅读洞察</Badge>
                <Badge variant="outline" className="rounded-full">当前孩子：{selectedChild?.name || '未选择'}</Badge>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-slate-950">{book.name}</h1>
              <p className="mt-2 text-sm font-medium text-slate-600">{book.author || book.publisher || '未知作者'} 著</p>
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">阅读记录</p>
                  <p className="mt-1 font-semibold text-slate-900">{readingLogCount} 条</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">累计时长</p>
                  <p className="mt-1 font-semibold text-slate-900">{book.totalReadMinutes || 0} 分钟</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">累计页数</p>
                  <p className="mt-1 font-semibold text-slate-900">{book.totalReadPages || 0} 页</p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {insights ? '重新生成' : '生成分析'}
            </Button>
          </div>
          <p className="mt-5 rounded-xl bg-purple-50 p-4 text-sm leading-6 text-purple-900">
            分析依据包括：书籍基础信息、书籍简介、阅读记录、章节/备注、阅读时长和页数。报告用于帮助家长理解孩子读这本书的过程，并给出亲子阅读建议。
          </p>
        </CardContent>
      </Card>

      {insights?.status === 'completed' ? (
        <div className="grid gap-4">
          <InsightCard icon={BookOpen} title="内容提炼" tone="bg-blue-50 text-blue-600">
            {insights.insights.contentAnalysis}
          </InsightCard>
          <InsightCard icon={Clock} title="阅读行为画像" tone="bg-emerald-50 text-emerald-600">
            {insights.insights.readingProgress}
          </InsightCard>
          <InsightCard icon={Brain} title="能力发展观察" tone="bg-purple-50 text-purple-600">
            {insights.insights.abilityDevelopment}
          </InsightCard>
          <InsightCard icon={Lightbulb} title="后续阅读建议" tone="bg-amber-50 text-amber-600">
            {insights.insights.readingSuggestions}
          </InsightCard>
          <InsightCard icon={Users} title="家长陪读指导" tone="bg-rose-50 text-rose-600">
            {insights.insights.parentGuidance}
          </InsightCard>
        </div>
      ) : (
        <Card className="rounded-2xl border border-dashed border-slate-200 bg-white shadow-sm">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm font-medium text-slate-600">还没有这本书的阅读分析报告</p>
            <p className="mt-2 text-sm text-slate-500">生成后会基于书籍内容和阅读记录展示分析结果。</p>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="mt-5 rounded-xl">
              {generateMutation.isPending ? '生成中...' : '生成分析报告'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
