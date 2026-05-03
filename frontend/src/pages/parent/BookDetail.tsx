import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Trash2,
  MessageSquare,
  Brain,
  CalendarDays,
  Clock3,
  FileText,
  Edit3,
  CheckCircle2,
  Layers3,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { EmptyPanel } from '@/components/parent/PageToolbar';
import { readStages } from '@/types/library';
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
  isbn?: string;
  publisher?: string;
  type: string;
  characterTag?: string;
  description?: string;
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

interface ChildSemesterConfig {
  readingStage?: string;
}

interface BookMetadata {
  notes: string;
  chapters: string[];
}

async function fetchBook(id: number, childId?: number | null): Promise<Book> {
  const params = childId ? `?childId=${childId}` : '';
  const { data } = await apiClient.get(`/library/${id}${params}`);
  return data.data;
}

async function addReadingLog(bookId: number, log: Partial<ReadingLog>): Promise<ReadingLog> {
  const { data } = await apiClient.post(`/reading-logs/books/${bookId}/logs`, log);
  return data.data;
}

async function updateReadingLog(id: number, log: Partial<ReadingLog>): Promise<ReadingLog> {
  const { data } = await apiClient.put(`/reading-logs/logs/${id}`, log);
  return data.data;
}

async function deleteReadingLog(id: number): Promise<void> {
  await apiClient.delete(`/reading-logs/logs/${id}`);
}

async function deleteBook(bookId: number): Promise<void> {
  await apiClient.delete(`/library/${bookId}`);
}

async function markBookFinished(bookId: number, childId: number): Promise<void> {
  await apiClient.post(`/library/${bookId}/state`, {
    childId,
    status: 'finished',
    finishedAt: new Date().toISOString(),
  });
}

async function fetchChildSemesterConfig(childId: number): Promise<ChildSemesterConfig | null> {
  const { data } = await apiClient.get(`/children/${childId}/semester`);
  return data.data || null;
}

async function fetchBookMetadata(bookId: number, childId: number): Promise<BookMetadata> {
  const { data } = await apiClient.get(`/library/${bookId}/metadata?childId=${childId}`);
  return data.data || { notes: '', chapters: [] };
}

async function updateBookMetadata(bookId: number, childId: number, metadata: BookMetadata): Promise<BookMetadata> {
  const { data } = await apiClient.put(`/library/${bookId}/metadata`, { childId, ...metadata });
  return data.data || metadata;
}

const typeLabels: Record<string, string> = {
  children: '儿童故事',
  tradition: '传统文化',
  science: '科普',
  character: '性格养成、其他',
  other: '其他',
  fiction: '儿童故事',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

const effectOptions = [
  { value: '非常好', label: '非常好', stars: '★★★★★' },
  { value: '好', label: '好', stars: '★★★★' },
  { value: '一般', label: '一般', stars: '★★★' },
  { value: '需加强', label: '需加强', stars: '★★' },
];

function parseChapterCatalog(input: string): string[] {
  const normalized = input
    .replace(/\r/g, '\n')
    .replace(/(第[一二三四五六七八九十百千万零〇两\d]+[章节回篇卷部])/g, '\n$1')
    .replace(/(\d+[.、．]\s*)/g, '\n$1')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function parseReadingNote(note?: string, chapters: string[] = []) {
  const raw = (note || '').trim();
  if (!raw) return { chapter: '', remark: '' };

  const chapterMatch = raw.match(/(?:当前章节|章节)\s*[:：]?\s*([\s\S]*?)(?=\s*备注[:：]|$)/);
  const remarkMatch = raw.match(/备注[:：]\s*([\s\S]+)/);
  if (chapterMatch || remarkMatch) {
    return {
      chapter: chapterMatch?.[1]?.trim() || '',
      remark: remarkMatch?.[1]?.trim() || '',
    };
  }

  if (chapters.includes(raw)) return { chapter: raw, remark: '' };
  const firstLine = raw.split('\n')[0]?.trim() || '';
  if (/^(第[一二三四五六七八九十百千万零〇两\d]+[章节回篇卷部]|[0-9]+[.、．])/.test(firstLine)) {
    return {
      chapter: firstLine,
      remark: raw.split('\n').slice(1).join('\n').trim(),
    };
  }
  return { chapter: '', remark: raw };
}

function getReadingLogChapter(log: ReadingLog | undefined, chapters: string[]) {
  if (!log) return '';
  const parsed = parseReadingNote(log.note, chapters);
  if (parsed.chapter) return parsed.chapter;

  const raw = (log.note || '').trim();
  return chapters.find(chapter => raw.includes(chapter)) || '';
}

function sortReadingLogs(logs: ReadingLog[]) {
  return [...logs].sort((a, b) => {
    const dateDiff = new Date(b.readDate).getTime() - new Date(a.readDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.id - a.id;
  });
}

function buildReadingNote(chapter: string, remark: string) {
  const parts = [];
  if (chapter.trim()) parts.push(`章节：${chapter.trim()}`);
  if (remark.trim()) parts.push(`备注：${remark.trim()}`);
  return parts.join('\n');
}

function formatBookTitle(name: string) {
  return name.trim().replace(/^《(.+)》$/, '$1');
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </div>
  );
}

function getDateKey(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(date: string | null | undefined) {
  if (!date) return '未记录';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '未记录' : parsed.toLocaleDateString('zh-CN');
}

function getInclusiveDays(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return 0;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.max(1, Math.floor((endTime - startTime) / 86400000) + 1);
}

function getStageTrail(logs: ReadingLog[]) {
  const stages = logs
    .map(log => log.readStage?.trim())
    .filter((stage): stage is string => Boolean(stage));

  const trail = stages.filter((stage, index) => index === 0 || stage !== stages[index - 1]);
  return {
    currentStage: stages[stages.length - 1] || '',
    changedTimes: Math.max(0, trail.length - 1),
    label: trail.length > 1 ? trail.join(' → ') : (trail[0] || '未记录'),
  };
}

function getTopEffect(logs: ReadingLog[]) {
  const counts = new Map<string, number>();
  logs.forEach((log) => {
    if (!log.effect) return;
    counts.set(log.effect, (counts.get(log.effect) || 0) + 1);
  });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '未记录';
}

function getLogPageCount(log: ReadingLog) {
  if (log.pages && log.pages > 0) return log.pages;
  if (log.startPage && log.endPage && log.endPage >= log.startPage) {
    return log.endPage - log.startPage + 1;
  }
  return 0;
}

function formatPageRange(log: ReadingLog, emptyLabel = '页码未记录') {
  const { startPage, endPage } = log;
  if (startPage && endPage && endPage >= startPage) return `${startPage}-${endPage} 页`;
  if (endPage) return `读到第 ${endPage} 页`;
  if (startPage) return `从第 ${startPage} 页开始`;
  return emptyLabel;
}

function getReadingLogPageIssue(log: ReadingLog) {
  if (log.startPage && log.endPage && log.endPage < log.startPage) return '页码倒挂';
  if ((log.minutes || 0) > 0 && !getLogPageCount(log)) return '缺有效页数';
  return '';
}

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const readingRecordsRef = useRef<HTMLDivElement | null>(null);
  const shouldFocusReadingIssue = searchParams.get('issue') === 'reading-page';
  const [showAddForm, setShowAddForm] = useState(false);
  const [showChapterManager, setShowChapterManager] = useState(false);
  const [logToDelete, setLogToDelete] = useState<number | null>(null);
  const [showDeleteBookConfirm, setShowDeleteBookConfirm] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const { selectedChildId } = useSelectedChild();
  const detailStoragePrefix = useMemo(
    () => `${selectedChildId ?? 'pending'}_${id ?? 'book'}`,
    [selectedChildId, id]
  );

  // P1-9: 书籍详情增强 - 评分、评论、笔记
  const [bookNotes, setBookNotes] = useState<string>('');
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [selectedLog, setSelectedLog] = useState<ReadingLog | null>(null);
  const [editingLog, setEditingLog] = useState<ReadingLog | null>(null);
  const [chapterInput, setChapterInput] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [readingDate, setReadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const chapterStorageKey = useMemo(() => `book_chapters_${id ?? 'book'}`, [id]);
  const [chapters, setChapters] = useState<string[]>([]);

  const { data: book, isLoading, error } = useQuery({
    queryKey: ['book', id, selectedChildId],
    queryFn: async () => {
      const bookId = Number(id);
      const data = await fetchBook(bookId, selectedChildId);
      // 验证返回的数据 ID 是否匹配
      if (data.id !== bookId) {
        throw new Error(`数据错误：请求的书籍ID(${bookId})与返回的ID(${data.id})不匹配`);
      }
      return data;
    },
    enabled: !!id,
  });

  const { data: childSemesterConfig } = useQuery({
    queryKey: ['child-semester-config', selectedChildId],
    queryFn: () => fetchChildSemesterConfig(selectedChildId!),
    enabled: !!selectedChildId,
  });

  const { data: bookMetadata } = useQuery({
    queryKey: ['book-metadata', id, selectedChildId],
    queryFn: () => fetchBookMetadata(Number(id), selectedChildId!),
    enabled: !!id && !!selectedChildId,
  });

  const metadataMutation = useMutation({
    mutationFn: (metadata: BookMetadata) => updateBookMetadata(Number(id), selectedChildId!, metadata),
    onSuccess: (metadata) => {
      queryClient.setQueryData(['book-metadata', id, selectedChildId], metadata);
    },
    onError: (error) => toast.error(`保存失败：${getErrorMessage(error)}`),
  });

  useEffect(() => {
    if (!bookMetadata) return;
    setBookNotes(bookMetadata.notes || '');
    setChapters(bookMetadata.chapters || []);
    setChapterInput((bookMetadata.chapters || []).join('\n'));
  }, [bookMetadata]);

  useEffect(() => {
    if (!selectedChildId || !bookMetadata) return;
    const hasRemoteMetadata = Boolean(bookMetadata.notes) || (bookMetadata.chapters || []).length > 0;
    if (hasRemoteMetadata) return;

    try {
      const legacyNotes = localStorage.getItem(`book_notes_${detailStoragePrefix}`) || '';
      const legacyChapters = JSON.parse(localStorage.getItem(chapterStorageKey) || '[]');
      const nextMetadata = {
        notes: legacyNotes,
        chapters: Array.isArray(legacyChapters) ? legacyChapters : [],
      };
      if (nextMetadata.notes || nextMetadata.chapters.length > 0) {
        setBookNotes(nextMetadata.notes);
        setChapters(nextMetadata.chapters);
        setChapterInput(nextMetadata.chapters.join('\n'));
        metadataMutation.mutate(nextMetadata);
        localStorage.removeItem(`book_notes_${detailStoragePrefix}`);
        localStorage.removeItem(chapterStorageKey);
      }
    } catch {
      localStorage.removeItem(chapterStorageKey);
    }
  }, [bookMetadata, chapterStorageKey, detailStoragePrefix, metadataMutation, selectedChildId]);

  const addMutation = useMutation({
    mutationFn: (log: Partial<ReadingLog>) => addReadingLog(Number(id), log),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['growth-dashboard-reading-stats'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-books'] });
      toast.success('阅读记录添加成功');
      setSelectedChapter('');
      setShowAddForm(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ logId, log }: { logId: number; log: Partial<ReadingLog> }) => updateReadingLog(logId, log),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['growth-dashboard-reading-stats'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-books'] });
      toast.success(shouldFocusReadingIssue ? '阅读页码已更新，可返回数据体检复查' : '阅读记录已更新');
      setSelectedChapter('');
      setEditingLog(null);
      setShowAddForm(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReadingLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['growth-dashboard-reading-stats'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-books'] });
      toast.success('阅读记录删除成功');
      setLogToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const finishMutation = useMutation({
    mutationFn: () => markBookFinished(Number(id), selectedChildId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', id] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['growth-dashboard-reading-stats'] });
      toast.success('已标记为读完');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteBookMutation = useMutation({
    mutationFn: () => deleteBook(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success('图书已删除');
      navigate('/parent/library');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // 计算阅读进度
  const calculateProgress = () => {
    if (!book || !book.totalPages) return 0;
    const currentPage = Math.max(...(book.readingLogs || []).map(log => log.endPage || 0), 0);
    return Math.min(100, Math.round((currentPage / book.totalPages) * 100));
  };

  // P1-9: 保存笔记
  const handleSaveNotes = () => {
    if (notesInput.trim()) {
      const nextNotes = notesInput.trim();
      setBookNotes(nextNotes);
      metadataMutation.mutate({ notes: nextNotes, chapters });
      toast.success('笔记已保存');
      setShowNotesForm(false);
    }
  };

  const handleSaveChapters = () => {
    const nextChapters = parseChapterCatalog(chapterInput);
    setChapters(nextChapters);
    metadataMutation.mutate({ notes: bookNotes, chapters: nextChapters });
    setShowChapterManager(false);
    toast.success(`章节目录已保存，共识别 ${nextChapters.length} 个章节`);
  };

  const openAddReadingLog = () => {
    setEditingLog(null);
    setSelectedChapter('');
    setReadingDate(new Date().toISOString().split('T')[0]);
    setShowAddForm(true);
  };

  const openEditReadingLog = (log: ReadingLog) => {
    const parsedNote = parseReadingNote(log.note, chapters);
    setEditingLog(log);
    setSelectedLog(null);
    setSelectedChapter(parsedNote.chapter);
    setReadingDate(new Date(log.readDate).toISOString().split('T')[0]);
    setShowAddForm(true);
  };

  const handleMarkFinished = () => {
    if (!selectedChildId) {
      toast.error('请选择一个孩子');
      return;
    }
    finishMutation.mutate();
  };

  const hasReadingPageIssues = Boolean(book?.readingLogs?.some((log) => Boolean(getReadingLogPageIssue(log))));

  useEffect(() => {
    if (!shouldFocusReadingIssue || !hasReadingPageIssues || isLoading || error || !book) return;
    window.setTimeout(() => {
      readingRecordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [book, error, hasReadingPageIssues, isLoading, shouldFocusReadingIssue]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1360px] space-y-5">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1360px]">
        <EmptyPanel
          icon={FileText}
          title="书籍加载失败"
          description={`${getErrorMessage(error)} · 书籍ID: ${id}`}
          action={<Button onClick={() => navigate('/parent/library')}>返回图书馆</Button>}
        />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="mx-auto max-w-[1360px]">
        <EmptyPanel
          icon={FileText}
          title="书籍不存在"
          description={`书籍ID: ${id}`}
          action={<Button onClick={() => navigate('/parent/library')}>返回图书馆</Button>}
        />
      </div>
    );
  }

  const progress = calculateProgress();
  const isFinished = book.readState?.status === 'finished';
  const readingStatus = isFinished ? '已读完' : '在读';
  const displayBookName = formatBookTitle(book.name);
  const openEditBook = () => {
    navigate('/parent/library', {
      state: {
        editBookId: book.id,
        returnTo: `/parent/library/${book.id}`,
      },
    });
  };
  const primaryTags = [
    typeLabels[book.type] || book.type || '儿童读物',
    book.totalPages ? `${book.totalPages}页` : null,
  ].filter(Boolean) as string[];
  const readingLogs = book.readingLogs || [];
  const totalReadPages = book.totalReadPages || readingLogs.reduce((sum, log) => sum + getLogPageCount(log), 0);
  const totalReadMinutes = book.totalReadMinutes || readingLogs.reduce((sum, log) => sum + (log.minutes || 0), 0);
  const sortedReadingLogs = sortReadingLogs(readingLogs);
  const chronologicalReadingLogs = [...sortedReadingLogs].reverse();
  const latestLog = sortedReadingLogs[0];
  const latestPage = Math.max(...sortedReadingLogs.map(log => log.endPage || 0), 0);
  const lastReadDate = latestLog?.readDate || book.lastReadDate || null;
  const defaultReadStage = editingLog?.readStage || latestLog?.readStage || childSemesterConfig?.readingStage || '';
  const readStageOptions = Array.from(new Set([
    defaultReadStage,
    latestLog?.readStage || '',
    childSemesterConfig?.readingStage || '',
    ...readStages.map(stage => stage.value),
  ].filter(Boolean)));
  const latestChapter = sortedReadingLogs
    .map(log => getReadingLogChapter(log, chapters))
    .find(Boolean) || '';
  const readingSummary = readingLogs.length > 0
    ? `已记录 ${readingLogs.length} 次阅读，累计 ${totalReadPages} 页、${totalReadMinutes} 分钟。`
    : '暂无阅读记录。开始阅读或添加记录后，这里会展示真实阅读摘要。';
  const description = book.description?.trim() || readingSummary;
  const reviewCount = readingLogs.filter(log => Boolean(log.performance || parseReadingNote(log.note, chapters).remark)).length;
  const stageTrail = getStageTrail(chronologicalReadingLogs);
  const firstReadDate = chronologicalReadingLogs[0]?.readDate || null;
  const readingSpanDays = getInclusiveDays(firstReadDate, lastReadDate);
  const readingDayCount = new Set(readingLogs.map(log => getDateKey(log.readDate)).filter(Boolean)).size;
  const averageMinutes = readingLogs.length ? Math.round(totalReadMinutes / readingLogs.length) : 0;
  const averagePages = readingLogs.length ? Math.round(totalReadPages / readingLogs.length) : 0;
  const readingCadence = readingDayCount > 0 && readingSpanDays > 0
    ? `覆盖 ${readingSpanDays} 天，实际阅读 ${readingDayCount} 天`
    : '暂无节奏数据';
  const growthArchiveStats = [
    { label: '阅读次数', value: `${readingLogs.length} 次`, helper: readingDayCount ? `${readingDayCount} 个阅读日` : '添加记录后生成', icon: CalendarDays, tone: 'text-indigo-600 bg-indigo-50' },
    { label: '累计投入', value: `${totalReadMinutes} 分钟`, helper: averageMinutes ? `平均 ${averageMinutes} 分钟/次` : '时长未记录', icon: Clock3, tone: 'text-emerald-600 bg-emerald-50' },
    { label: '累计页数', value: `${totalReadPages} 页`, helper: averagePages ? `平均 ${averagePages} 页/次` : '页数未记录', icon: TrendingUp, tone: 'text-amber-600 bg-amber-50' },
    { label: '阶段变化', value: stageTrail.currentStage || '未记录', helper: stageTrail.changedTimes ? `变化 ${stageTrail.changedTimes} 次` : '阶段保持稳定', icon: Layers3, tone: 'text-violet-600 bg-violet-50' },
  ];
  const bookInfoItems = [
    ['作者', book.author || '未知'],
    ['出版社', book.publisher || '待补充'],
    ['ISBN', book.isbn || '待补充'],
    ['页数', book.totalPages ? `${book.totalPages} 页` : '未知'],
  ];
  const readingPageIssueCount = readingLogs.filter((log) => Boolean(getReadingLogPageIssue(log))).length;
  const firstReadingPageIssueLog = sortedReadingLogs.find((log) => Boolean(getReadingLogPageIssue(log)));

  return (
    <div className="mx-auto max-w-[1360px] space-y-5 text-slate-900">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <Button variant="ghost" size="icon" onClick={() => navigate('/parent/library')} className="size-9 rounded-lg">
          <ArrowLeft className="size-5" />
        </Button>
        <button onClick={() => navigate('/parent/library')} className="hover:text-primary">返回图书馆</button>
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="grid gap-6 p-6 lg:grid-cols-[170px_minmax(0,1fr)_220px] md:p-8">
              <div className="h-[236px] w-[166px] overflow-hidden rounded-xl bg-slate-50 shadow-xl ring-1 ring-slate-200">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={displayBookName} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-5 text-center text-3xl font-bold leading-tight text-white">
                    {displayBookName.slice(0, 5)}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-md bg-indigo-50 px-2.5 py-1 text-indigo-700 hover:bg-indigo-50">{readingStatus}</Badge>
                  {primaryTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="rounded-md px-2.5 py-1">{tag}</Badge>
                  ))}
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-normal text-slate-950">{displayBookName}</h1>
                <p className="mt-3 text-base font-medium text-slate-600">{book.author || book.publisher || '未知作者'} 著</p>
                <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                  {bookInfoItems.map(([label, value]) => (
                    <InfoRow key={label} label={label} value={value} />
                  ))}
                </div>
                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">书籍简介</p>
                  <p className={`mt-2 text-sm font-medium leading-7 text-slate-700 ${isDescriptionExpanded ? '' : 'line-clamp-3'}`}>
                    {description}
                  </p>
                  {description.length > 90 && (
                    <button
                      type="button"
                      onClick={() => setIsDescriptionExpanded(value => !value)}
                      className="mt-2 text-xs font-semibold text-purple-600 hover:text-purple-700"
                    >
                      {isDescriptionExpanded ? '收起简介' : '展开简介'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <Button onClick={openAddReadingLog}>
                  <Plus className="mr-2 size-4" /> 阅读记录
                </Button>
                {!isFinished && (
                  <Button variant="outline" onClick={handleMarkFinished} disabled={finishMutation.isPending}>
                    <CheckCircle2 className="mr-2 size-4" /> 标记已读完
                  </Button>
                )}
                <Button variant="outline" onClick={openEditBook}>
                  <Edit3 className="mr-2 size-4" /> 编辑书籍
                </Button>
                <Button variant="outline" onClick={() => navigate(`/parent/library/${id}/insights`)}>
                  <Brain className="mr-2 size-4" /> 阅读洞察
                </Button>
                <Button variant="outline" onClick={() => setShowChapterManager(true)}>
                  <FileText className="mr-2 size-4" /> 章节目录
                </Button>
                <Button variant="outline" onClick={() => { setNotesInput(bookNotes); setShowNotesForm(true); }}>
                  <MessageSquare className="mr-2 size-4" /> 阅读笔记
                </Button>
                <Button variant="destructive" onClick={() => setShowDeleteBookConfirm(true)}>
                  <Trash2 className="mr-2 size-4" /> 删除图书
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-600">成长档案</p>
                <h2 className="mt-1 text-base font-bold text-slate-950">这本书里的阅读成长</h2>
              </div>
              <p className="text-sm font-medium text-slate-500">
                {readingLogs.length > 0 ? `${formatDate(firstReadDate)} 至 ${formatDate(lastReadDate)}` : '基于阅读记录自动生成'}
              </p>
            </div>

            {readingLogs.length > 0 ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  {growthArchiveStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                        <div className={`mb-3 flex size-9 items-center justify-center rounded-lg ${stat.tone}`}>
                          <Icon className="size-4" />
                        </div>
                        <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
                        <p className="mt-1 text-lg font-bold text-slate-950">{stat.value}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{stat.helper}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
                  <div className="rounded-lg border border-slate-100 bg-white p-4">
                    <h3 className="text-sm font-bold text-slate-900">档案摘要</h3>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                      <p>阅读节奏：{readingCadence}</p>
                      <p>阶段轨迹：{stageTrail.label}</p>
                      <p>主要效果：{getTopEffect(readingLogs)}</p>
                      <p>表现/备注：{reviewCount > 0 ? `${reviewCount} 条可复盘记录` : '暂无可复盘备注'}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-white p-4">
                    <h3 className="text-sm font-bold text-slate-900">阅读时间线</h3>
                    <div className="mt-4 space-y-4">
                      {chronologicalReadingLogs.map((log) => {
                        const parsedNote = parseReadingNote(log.note, chapters);
                        const pageIssue = getReadingLogPageIssue(log);
                        return (
                          <div key={log.id} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
                            <div className="text-xs font-semibold text-slate-500">{formatDate(log.readDate)}</div>
                            <div className="border-l border-slate-200 pl-4">
                              <p className="text-sm font-bold text-slate-900">
                                {formatPageRange(log)}
                                {parsedNote.chapter ? ` · ${parsedNote.chapter}` : ''}
                              </p>
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                {log.readStage || '阶段未记录'}
                                {log.minutes ? ` · ${log.minutes} 分钟` : ''}
                                {log.effect ? ` · ${log.effect}` : ''}
                                {pageIssue ? ` · ${pageIssue}` : ''}
                              </p>
                              {(log.performance || parsedNote.remark) && (
                                <p className="mt-2 text-sm leading-6 text-slate-600 line-clamp-2">
                                  {log.performance || parsedNote.remark}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                添加阅读记录后，会自动沉淀阅读次数、总时长、总页数、最近阅读、阶段变化和时间线。
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-base font-bold text-slate-950">阅读状态</h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <InfoStat label="当前状态" value={readingStatus} />
                <InfoStat label="阅读阶段" value={latestLog?.readStage || '未记录'} />
                <InfoStat label="读到页码" value={latestPage ? `第 ${latestPage} 页` : '未记录'} />
                <InfoStat label="当前章节" value={latestChapter || '未记录'} />
                <InfoStat label="阅读进度" value={book.totalPages ? `${progress}%` : (isFinished ? '已读完' : '页数未知')} />
                <InfoStat label="阅读时长" value={`${Math.floor(totalReadMinutes / 60)} 小时 ${totalReadMinutes % 60} 分钟`} />
                <InfoStat label="最近阅读" value={lastReadDate ? new Date(lastReadDate).toLocaleDateString('zh-CN') : '未记录'} />
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-primary" style={{ width: `${book.totalPages ? progress : isFinished ? 100 : 0}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card ref={readingRecordsRef} className="rounded-lg border-slate-200/80 bg-white shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-950">阅读记录明细</h2>
                <Button variant="outline" size="sm" onClick={openAddReadingLog} className="rounded-lg bg-slate-50">
                  <Plus className="mr-1.5 size-4" /> 添加记录
                </Button>
              </div>
              {shouldFocusReadingIssue && (
                <div className={cn(
                  'mb-4 flex flex-col gap-3 rounded-lg border px-3 py-2 text-sm font-medium sm:flex-row sm:items-center sm:justify-between',
                  hasReadingPageIssues
                    ? 'border-amber-100 bg-amber-50 text-amber-700'
                    : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                )}>
                  <span>
                    {hasReadingPageIssues
                      ? `已高亮 ${readingPageIssueCount} 条页码异常记录，可直接点击“修正”。`
                      : '本书暂无页码异常，可返回数据体检复查。'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {firstReadingPageIssueLog && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditReadingLog(firstReadingPageIssueLog)}
                        className="h-8 w-fit rounded-lg bg-white text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                      >
                        修正第一条
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/parent/data-quality')}
                      className="h-8 w-fit rounded-lg bg-white"
                    >
                      返回数据体检
                    </Button>
                  </div>
                </div>
              )}
              {readingLogs.length > 0 ? (
                <div className="space-y-3">
                  {sortedReadingLogs.map((log) => {
                    const parsedNote = parseReadingNote(log.note, chapters);
                    const pageIssue = getReadingLogPageIssue(log);
                    return (
                      <div
                        key={log.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedLog(log)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedLog(log);
                          }
                        }}
                        className={cn(
                          'cursor-pointer rounded-lg border bg-slate-50/70 p-4 transition hover:border-purple-200 hover:bg-purple-50/60',
                          pageIssue && shouldFocusReadingIssue
                            ? 'border-amber-300 bg-amber-50/70 ring-2 ring-amber-100'
                            : 'border-slate-100'
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-sm font-bold text-slate-900">
                              {new Date(log.readDate).toLocaleDateString('zh-CN')}
                              {log.readStage ? ` · ${log.readStage}` : ''}
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              {formatPageRange(log)}
                              {log.minutes ? ` · ${log.minutes} 分钟` : ''}
                              {log.effect ? ` · ${log.effect}` : ''}
                              {parsedNote.chapter ? ` · ${parsedNote.chapter}` : ''}
                            </p>
                            {pageIssue && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge className="w-fit border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-50">
                                  {pageIssue}
                                </Badge>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openEditReadingLog(log);
                                  }}
                                  className="h-7 rounded-md bg-white px-2 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                >
                                  修正
                                </Button>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              setLogToDelete(log.id);
                            }}
                            className="size-8 rounded-lg text-slate-400 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        {(log.performance || parsedNote.remark) && (
                          <div className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                            {log.performance && <p>表现：{log.performance}</p>}
                            {parsedNote.remark && <p>备注：{parsedNote.remark}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  暂无阅读记录。导入记录或手动添加后，会在这里按时间展示。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add / Edit Reading Log Dialog */}
      {showAddForm && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => { setShowAddForm(false); setEditingLog(null); }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-x-4 bottom-8 top-8 z-50 overflow-auto rounded-2xl bg-white p-6 shadow-2xl lg:inset-auto lg:left-1/2 lg:top-1/2 lg:max-h-[84vh] lg:w-[560px] lg:-translate-x-1/2 lg:-translate-y-1/2"
          >
            <h3 className="text-lg font-semibold text-slate-950">{editingLog ? '编辑阅读记录' : '添加阅读记录'}</h3>
            <p className="mt-1 text-sm text-slate-500">{editingLog ? '调整这次阅读的时间、进度、效果和孩子表现。' : '记录这次阅读的时间、进度、效果和孩子表现。'}</p>
            <form
              key={editingLog?.id || 'new-reading-log'}
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedChildId) {
                  toast.error('请选择一个孩子');
                  return;
                }
                const formData = new FormData(e.currentTarget);
                const chapter = String(formData.get('chapter') || '').trim();
                const note = String(formData.get('note') || '').trim();
                const currentPage = parseInt(formData.get('currentPage') as string) || 0;
                const startPage = parseInt(formData.get('startPage') as string) || 0;
                if (startPage > 0 && currentPage > 0 && currentPage < startPage) {
                  toast.error('结束页不能小于起始页');
                  return;
                }
                const payload: Partial<ReadingLog> = {
                  childId: selectedChildId,
                  readDate: formData.get('readDate') as string || new Date().toISOString(),
                  effect: formData.get('effect') as string,
                  performance: formData.get('performance') as string,
                  note: buildReadingNote(chapter, note),
                  readStage: formData.get('readStage') as string,
                  startPage,
                  endPage: currentPage,
                  pages: currentPage > 0 && startPage > 0 ? currentPage - startPage + 1 : 0,
                  minutes: parseInt(formData.get('minutes') as string) || 0,
                };

                if (editingLog) {
                  updateMutation.mutate({ logId: editingLog.id, log: payload });
                } else {
                  addMutation.mutate(payload);
                }
              }}
              className="mt-5 space-y-5"
            >
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                <p className="mb-3 text-sm font-semibold text-purple-900">阅读时间</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="group relative block">
	                  <input type="hidden" name="readDate" value={readingDate} readOnly />
	                  <DatePicker
	                    value={readingDate}
	                    onChange={setReadingDate}
	                    className="h-14 w-full justify-start rounded-2xl border-purple-100 pb-2 pt-6"
	                    align="start"
	                  />
	                    <span className="pointer-events-none absolute left-4 top-2 text-xs font-medium text-slate-500 transition-all">阅读日期</span>
                  </label>
                  <label className="group relative block">
                  <input
                    type="number"
                    name="minutes"
                      placeholder=" "
                    min="0"
                    defaultValue={editingLog?.minutes || ''}
                      className="peer h-14 w-full rounded-2xl border border-purple-100 bg-white px-4 pb-2 pt-6 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-transparent focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                  />
                    <span className="pointer-events-none absolute left-4 top-2 text-xs font-medium text-slate-500 transition-all peer-focus:text-purple-600">阅读时长（分钟）</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="group relative block">
                  <input
                    type="number"
                    name="startPage"
                    placeholder=" "
                    min="0"
                    defaultValue={editingLog?.startPage || (latestPage ? latestPage + 1 : '')}
                    className="peer h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-transparent focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                  <span className="pointer-events-none absolute left-4 top-2 text-xs font-medium text-slate-500 transition-all peer-focus:text-purple-600">从第几页开始</span>
                  <span className="mt-1 block text-xs text-slate-500">用于修正历史页码异常。</span>
                </label>
                <label className="group relative block">
                  <input
                    type="number"
                    name="currentPage"
                    placeholder=" "
                    min="0"
                    defaultValue={editingLog?.endPage || latestPage || ''}
                    className="peer h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-transparent focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                  <span className="pointer-events-none absolute left-4 top-2 text-xs font-medium text-slate-500 transition-all peer-focus:text-purple-600">读到第几页</span>
                  <span className="mt-1 block text-xs text-slate-500">保存时自动计算本次页数。</span>
                </label>
                <label className="group relative block">
                  <select
                    name="readStage"
                    defaultValue={editingLog?.readStage || defaultReadStage}
                    className="peer h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-semibold text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                  >
                    <option value="">请选择阅读阶段</option>
                    {readStageOptions.map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute left-4 top-2 text-xs font-medium text-slate-500 transition-all peer-focus:text-purple-600">阅读阶段</span>
                </label>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">阅读效果</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {effectOptions.map((option, index) => (
                    <label key={option.value} className="cursor-pointer">
                      <input type="radio" name="effect" value={option.value} defaultChecked={editingLog ? editingLog.effect === option.value : index === 1} className="peer sr-only" />
                      <span className="flex h-20 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-center transition peer-checked:border-purple-500 peer-checked:bg-purple-600 peer-checked:text-white">
                        <span className="text-sm font-semibold">{option.label}</span>
                        <span className="mt-1 text-[11px] tracking-tight opacity-80">{option.stars}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="group relative block">
                <input
                  type="text"
                  name="performance"
                  placeholder=" "
                  defaultValue={editingLog?.performance || ''}
                  className="peer h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-transparent focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                />
                <span className="pointer-events-none absolute left-4 top-2 text-xs font-medium text-slate-500 transition-all peer-focus:text-purple-600">孩子表现</span>
              </label>

              <label className="group relative block">
                <input
                  list="book-chapter-options"
                  name="chapter"
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  placeholder=" "
                  className="peer h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-transparent focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                />
                <datalist id="book-chapter-options">
                  {chapters.map((chapter) => (
                    <option key={chapter} value={chapter}>{chapter}</option>
                  ))}
                </datalist>
                <span className="pointer-events-none absolute left-4 top-2 text-xs font-medium text-slate-500 transition-all peer-focus:text-purple-600">当前章节</span>
                <span className="mt-1 block text-xs text-slate-500">可从章节目录选择，也可以直接输入章节名。</span>
              </label>

              <label className="group relative block">
                <textarea
                  name="note"
                  rows={3}
                  placeholder=" "
                  defaultValue={editingLog ? parseReadingNote(editingLog.note, chapters).remark : ''}
                  className="peer w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pb-3 pt-7 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-transparent focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                />
                <span className="pointer-events-none absolute left-4 top-2 text-xs font-medium text-slate-500 transition-all peer-focus:text-purple-600">备注</span>
              </label>

              <div className="sticky bottom-0 -mx-1 flex gap-3 bg-white/95 px-1 pt-2 backdrop-blur">
                <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setEditingLog(null); }} className="flex-1">取消</Button>
                <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending} className="flex-1">
                  {editingLog ? '保存修改' : '保存记录'}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}

      {/* Delete Confirmation */}
      {showDeleteBookConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteBookConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-950 mb-2">删除图书</h3>
            <p className="text-sm text-slate-600 mb-5">确定要删除「{displayBookName}」吗？此操作不可恢复。</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDeleteBookConfirm(false)} className="flex-1 rounded-lg">取消</Button>
              <Button
                onClick={() => deleteBookMutation.mutate()}
                disabled={deleteBookMutation.isPending}
                className="flex-1 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Reading Log Confirmation */}
      {logToDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setLogToDelete(null)}>
          <Card className="w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

      {selectedLog && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <Card className="w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-950">阅读记录详情</h3>
              <div className="mt-4 grid gap-3 text-sm text-slate-700">
                <InfoRow label="日期" value={new Date(selectedLog.readDate).toLocaleDateString('zh-CN')} />
                <InfoRow label="阶段" value={selectedLog.readStage || '未记录'} />
                <InfoRow label="页码" value={formatPageRange(selectedLog, '未记录')} />
                {getReadingLogPageIssue(selectedLog) && <InfoRow label="页码提示" value={getReadingLogPageIssue(selectedLog)} />}
                <InfoRow label="时长" value={selectedLog.minutes ? `${selectedLog.minutes} 分钟` : '未记录'} />
                <InfoRow label="效果" value={selectedLog.effect || '未记录'} />
                <InfoRow label="表现" value={selectedLog.performance || '未记录'} />
              </div>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">章节</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{parseReadingNote(selectedLog.note, chapters).chapter || '未记录'}</p>
                <p className="mt-4 text-xs font-semibold text-slate-500">备注</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{parseReadingNote(selectedLog.note, chapters).remark || '未记录'}</p>
              </div>
              <div className="mt-5 flex gap-3">
                <Button variant="outline" onClick={() => setSelectedLog(null)} className="flex-1">关闭</Button>
                <Button onClick={() => openEditReadingLog(selectedLog)} className="flex-1">
                  <Edit3 className="mr-2 size-4" /> 编辑记录
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showChapterManager && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowChapterManager(false)}>
          <Card className="w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-950">章节目录</h3>
              <p className="mt-1 text-sm text-slate-500">每行一个章节，只作用于《{displayBookName}》。添加阅读记录时可直接选择。</p>
              <textarea
                value={chapterInput}
                onChange={(e) => setChapterInput(e.target.value)}
                rows={10}
                placeholder={'可以直接粘贴完整目录，例如：第一章 认识自己第二章 学会表达第三章 解决问题'}
                className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
              />
              <p className="mt-2 text-xs text-slate-500">保存时会按“第一章 / 第1章 / 1.”等格式自动拆分。</p>
              <div className="mt-5 flex gap-3">
                <Button variant="outline" onClick={() => setShowChapterManager(false)} className="flex-1">取消</Button>
                <Button
                  variant="outline"
                  onClick={() => setChapterInput(parseChapterCatalog(chapterInput).join('\n'))}
                  className="flex-1"
                >
                  整理章节
                </Button>
                <Button onClick={handleSaveChapters} className="flex-1">保存目录</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* P1-9: 笔记编辑对话框 */}
      {showNotesForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNotesForm(false)}>
          <Card className="w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
                <Button variant="outline" onClick={() => setShowNotesForm(false)} className="flex-1">
                  取消
                </Button>
                <Button onClick={handleSaveNotes} className="flex-1">
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
