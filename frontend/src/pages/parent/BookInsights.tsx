import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Clock,
  Lightbulb,
  Users,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, getErrorMessage } from '@/lib/api-client';
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
}

async function fetchBookInsights(bookId: number): Promise<BookAIInsight | null> {
  const { data } = await apiClient.get(`/ai-insights/books/${bookId}`);
  return data.data;
}

async function generateBookInsights(bookId: number, childId?: number): Promise<BookAIInsight> {
  const { data } = await apiClient.post(`/ai-insights/books/${bookId}/generate`, { childId });
  return data.data;
}

async function fetchBook(bookId: number): Promise<Book> {
  const { data } = await apiClient.get(`/library/${bookId}`);
  return data.data;
}

export default function BookInsightsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [childId, setChildId] = useState<number | undefined>();

  const { data: book, isLoading: isLoadingBook } = useQuery({
    queryKey: ['book', id],
    queryFn: () => fetchBook(Number(id)),
    enabled: !!id,
  });

  const { data: insights, isLoading: isLoadingInsights } = useQuery({
    queryKey: ['book-insights', id],
    queryFn: () => fetchBookInsights(Number(id)),
    enabled: !!id,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateBookInsights(Number(id), childId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-insights', id] });
      toast.success('AI分析已生成');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoadingBook || isLoadingInsights) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
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
        <Button variant="ghost" onClick={() => navigate(`/parent/library/${id}`)} className="rounded-xl">
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">AI阅读洞察</h1>
      </div>

      {/* Book Info Card */}
      <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
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
                    <BookOpen className="size-4" />
                    <span>{book.author}</span>
                  </div>
                )}
                {book.publisher && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4" />
                    <span>{book.publisher}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4" />
                  <span>{book.totalPages} 页</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Brain className="size-5 text-purple-500" />
            阅读分析报告
          </h3>
          <Button 
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2 rounded-xl"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                重新生成
              </>
            )}
          </Button>
        </div>

        {insights ? (
          insights.status === 'completed' ? (
            <div className="space-y-4">
              {/* Content Analysis */}
              <Card className="border-0 shadow-md rounded-2xl">
                <CardContent className="p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <BookOpen className="size-4 text-blue-500" />
                    📖 故事里有什么？
                  </h4>
                  <p className="text-gray-700">{insights.insights.contentAnalysis}</p>
                </CardContent>
              </Card>

              {/* Reading Progress */}
              <Card className="border-0 shadow-md rounded-2xl">
                <CardContent className="p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="size-4 text-green-500" />
                    🎯 {book.name}的阅读画像
                  </h4>
                  <p className="text-gray-700">{insights.insights.readingProgress}</p>
                </CardContent>
              </Card>

              {/* Ability Development */}
              <Card className="border-0 shadow-md rounded-2xl">
                <CardContent className="p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Brain className="size-4 text-purple-500" />
                    💡 一起来聊聊
                  </h4>
                  <p className="text-gray-700">{insights.insights.abilityDevelopment}</p>
                </CardContent>
              </Card>

              {/* Reading Suggestions */}
              <Card className="border-0 shadow-md rounded-2xl">
                <CardContent className="p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="size-4 text-yellow-500" />
                    🔍 接下来读什么？
                  </h4>
                  <p className="text-gray-700">{insights.insights.readingSuggestions}</p>
                </CardContent>
              </Card>

              {/* Parent Guidance */}
              <Card className="border-0 shadow-md rounded-2xl">
                <CardContent className="p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="size-4 text-red-500" />
                    👨‍👩‍👧‍👦 家长指导
                  </h4>
                  <p className="text-gray-700">{insights.insights.parentGuidance}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-0 shadow-md rounded-2xl">
              <CardContent className="py-12 text-center">
                <Brain className="size-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">AI分析正在生成中，请稍后刷新页面</p>
                <Button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['book-insights', id] })}
                  className="mt-4 rounded-xl"
                >
                  刷新状态
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="py-12 text-center">
              <Brain className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">还没有生成阅读分析报告</p>
              <Button 
                onClick={() => generateMutation.mutate()}
                className="mt-4 rounded-xl bg-primary text-primary-foreground"
              >
                生成分析报告
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
