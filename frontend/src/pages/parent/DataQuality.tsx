import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Library,
  ListTodo,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyPanel, PageToolbar, PageToolbarTitle } from '@/components/parent/PageToolbar';
import { apiClient } from '@/lib/api-client';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { cn } from '@/lib/utils';

type TaskItem = {
  id: number;
  name: string;
  category?: string;
  tags?: Record<string, unknown> | string | null;
};

type GoalItem = {
  id?: string;
  title: string;
  abilityCategory?: string;
  abilityPoint?: string;
  linkedTaskIds?: number[];
  linkedTasks?: string[];
};

type BookItem = {
  id: number;
  name: string;
  isbn?: string | null;
  type?: string | null;
  totalPages?: number | null;
};

type ActiveReading = {
  id: number;
  readPages?: number | null;
  startedAt?: string | null;
  book?: {
    id: number;
    name: string;
    totalPages?: number | null;
  };
};

type CheckinItem = {
  id: number;
  taskId: number;
  status?: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

type QualityIssue = {
  id: string;
  title: string;
  description: string;
  count: number;
  total: number;
  tone: 'red' | 'amber' | 'blue' | 'emerald';
  path: string;
  action: string;
  examples: string[];
};

type DiagnosticCard = {
  id: string;
  title: string;
  verdict: string;
  description: string;
  severity: 'info' | 'warning' | 'risk' | 'stable';
  confidence: number;
  sampleCount: number;
  sources: string[];
  updatedAt: string;
  evidence: string[];
  rule: string;
};

type DomainKey = 'english' | 'math' | 'chinese';

type DomainSummary = {
  key: DomainKey;
  label: string;
  taskIds: Set<number>;
  samples: number;
  completionRate: number;
  negativeRate: number;
  cognitiveSamples: number;
  qualitySamples: number;
};

const todayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateWindow(endDate: string, days: number) {
  const [year, month, day] = endDate.split('-').map(Number);
  const end = new Date(year, month - 1, day);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (days - 1 - index));
    return formatDate(date);
  });
}

function normalizeTags(tags: TaskItem['tags']): Record<string, unknown> {
  let normalized: Record<string, unknown> = {};
  if (!tags) return {};
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      normalized = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  } else {
    normalized = tags;
  }

  const metadata = normalized.metadata && typeof normalized.metadata === 'object' && !Array.isArray(normalized.metadata)
    ? normalized.metadata as Record<string, unknown>
    : {};
  return { ...metadata, ...normalized };
}

function hasValue(value: unknown) {
  return typeof value === 'string'
    ? value.trim().length > 0 && value.trim() !== '不关联能力点' && value.trim() !== '__none__'
    : value !== null && value !== undefined;
}

function getText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getTaskDomain(task: TaskItem): DomainKey | null {
  const tags = normalizeTags(task.tags);
  const text = [
    task.name,
    task.category,
    getText(tags.subject),
    getText(tags.abilityPoint),
    getText(tags.abilityCategory),
  ].join(' ');

  if (/english|英语|英文|RAZ|自然拼读/i.test(text)) return 'english';
  if (/math|数学|数理|口算|计算|逻辑|几何/i.test(text)) return 'math';
  if (/chinese|语文|中文|大语文|阅读理解|古文|写作|表达/i.test(text)) return 'chinese';
  return null;
}

async function fetchTasks(childId?: number): Promise<TaskItem[]> {
  if (!childId) return [];
  const { data } = await apiClient.get('/tasks', { params: { childId } });
  return data.data || [];
}

async function fetchGoals(childId?: number): Promise<GoalItem[]> {
  if (!childId) return [];
  const { data } = await apiClient.get('/settings/goals', { params: { childId } });
  return data.data || [];
}

async function fetchBooks(childId?: number): Promise<BookItem[]> {
  const params = new URLSearchParams();
  if (childId) params.append('childId', String(childId));
  const { data } = await apiClient.get(`/library?${params}`);
  return data.data || [];
}

async function fetchActiveReadings(childId?: number): Promise<ActiveReading[]> {
  if (!childId) return [];
  const { data } = await apiClient.get('/reading', { params: { childId } });
  return data.data || [];
}

async function fetchCheckins(childId?: number, date?: string): Promise<CheckinItem[]> {
  if (!childId || !date) return [];
  const { data } = await apiClient.get('/dashboard/today-checkins', { params: { childId, date } });
  return data.data || [];
}

async function fetchRecentCheckins(childId?: number, endDate?: string): Promise<Array<CheckinItem & { date: string }>> {
  if (!childId || !endDate) return [];
  const dates = getDateWindow(endDate, 56);
  const batches = await Promise.all(
    dates.map(async (itemDate) => {
      const { data } = await apiClient.get('/dashboard/today-checkins', { params: { childId, date: itemDate } });
      return (data.data || []).map((checkin: CheckinItem) => ({ ...checkin, date: itemDate }));
    })
  );
  return batches.flat();
}

function issueRatio(issue: QualityIssue) {
  if (issue.total === 0) return 0;
  return Math.round((issue.count / issue.total) * 100);
}

function StatusBadge({ issue }: { issue: QualityIssue }) {
  if (issue.count === 0) {
    return <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">已完整</Badge>;
  }
  const label = issueRatio(issue) >= 50 ? '优先修' : '待补齐';
  return <Badge className="border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-50">{label}</Badge>;
}

function DiagnosticCardView({ diagnostic }: { diagnostic: DiagnosticCard }) {
  const severityMap = {
    info: {
      className: 'border-blue-100 bg-blue-50 text-blue-700',
      icon: Brain,
      label: '观察',
    },
    warning: {
      className: 'border-amber-100 bg-amber-50 text-amber-700',
      icon: AlertTriangle,
      label: '关注',
    },
    risk: {
      className: 'border-red-100 bg-red-50 text-red-700',
      icon: ShieldCheck,
      label: '风险',
    },
    stable: {
      className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
      icon: CheckCircle2,
      label: '稳定',
    },
  };
  const severity = severityMap[diagnostic.severity];
  const Icon = severity.icon;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', severity.className)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-950">{diagnostic.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{diagnostic.verdict}</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">{diagnostic.description}</p>
        </div>
        <Badge className={cn('border hover:bg-transparent', severity.className)}>{severity.label}</Badge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">置信度</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{diagnostic.confidence}%</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">样本数</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{diagnostic.sampleCount}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">数据源</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-950">{diagnostic.sources.join(' / ') || '无'}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">证据</p>
        <div className="mt-2 grid gap-1.5">
          {diagnostic.evidence.map((item) => (
            <p key={item} className="text-xs leading-5 text-slate-600">{item}</p>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>{diagnostic.rule}</span>
        <span>更新：{diagnostic.updatedAt}</span>
      </div>
    </article>
  );
}

function IssueCard({ issue }: { issue: QualityIssue }) {
  const navigate = useNavigate();
  const toneMap = {
    red: 'border-red-100 bg-red-50 text-red-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', toneMap[issue.tone])}>
              {issue.count > 0 ? <FileWarning className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </span>
            <h2 className="truncate text-sm font-semibold text-slate-950">{issue.title}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{issue.description}</p>
        </div>
        <StatusBadge issue={issue} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-slate-950">{issue.count}</p>
          <p className="text-xs text-slate-500">共 {issue.total} 条，缺口 {issueRatio(issue)}%</p>
        </div>
        <Button variant="outline" className="h-9 rounded-lg bg-white" onClick={() => navigate(issue.path)}>
          {issue.action}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {issue.examples.length > 0 ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">示例</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {issue.examples.slice(0, 3).map((example) => (
              <span key={example} className="rounded-md bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                {example}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function DataQualityPage() {
  const [date, setDate] = useState(todayString());
  const { selectedChildId, selectedChild } = useSelectedChild();
  const navigate = useNavigate();

  const tasksQuery = useQuery({
    queryKey: ['data-quality-tasks', selectedChildId],
    queryFn: () => fetchTasks(selectedChildId || undefined),
    enabled: !!selectedChildId,
  });
  const goalsQuery = useQuery({
    queryKey: ['data-quality-goals', selectedChildId],
    queryFn: () => fetchGoals(selectedChildId || undefined),
    enabled: !!selectedChildId,
  });
  const booksQuery = useQuery({
    queryKey: ['data-quality-books', selectedChildId],
    queryFn: () => fetchBooks(selectedChildId || undefined),
    enabled: !!selectedChildId,
  });
  const readingsQuery = useQuery({
    queryKey: ['data-quality-readings', selectedChildId],
    queryFn: () => fetchActiveReadings(selectedChildId || undefined),
    enabled: !!selectedChildId,
  });
  const checkinsQuery = useQuery({
    queryKey: ['data-quality-checkins', selectedChildId, date],
    queryFn: () => fetchCheckins(selectedChildId || undefined, date),
    enabled: !!selectedChildId,
  });
  const recentCheckinsQuery = useQuery({
    queryKey: ['data-quality-recent-checkins', selectedChildId, date],
    queryFn: () => fetchRecentCheckins(selectedChildId || undefined, date),
    enabled: !!selectedChildId,
  });

  const isLoading = tasksQuery.isLoading || goalsQuery.isLoading || booksQuery.isLoading || readingsQuery.isLoading || checkinsQuery.isLoading || recentCheckinsQuery.isLoading;
  const isFetching = tasksQuery.isFetching || goalsQuery.isFetching || booksQuery.isFetching || readingsQuery.isFetching || checkinsQuery.isFetching || recentCheckinsQuery.isFetching;

  const issues = useMemo<QualityIssue[]>(() => {
    const tasks = tasksQuery.data || [];
    const goals = goalsQuery.data || [];
    const books = booksQuery.data || [];
    const readings = readingsQuery.data || [];
    const checkins = checkinsQuery.data || [];

    const tasksMissingAbility = tasks.filter((task) => !hasValue(normalizeTags(task.tags).abilityPoint));
    const tasksMissingTargetType = tasks.filter((task) => !hasValue(normalizeTags(task.tags).targetType));
    const goalsMissingAbility = goals.filter((goal) => !hasValue(goal.abilityPoint) || !hasValue(goal.abilityCategory));
    const booksMissingCore = books.filter((book) => !hasValue(book.isbn) || !book.totalPages || book.totalPages <= 0 || !hasValue(book.type));
    const readingsMissingCore = readings.filter((reading) => !reading.startedAt || !reading.book?.totalPages || reading.book.totalPages <= 0 || !reading.readPages || reading.readPages <= 0);
    const checkinsMissingQuality = checkins.filter((checkin) => {
      if (checkin.status === 'pending' || checkin.status === 'not_involved') return false;
      const metadata = checkin.metadata || {};
      return !hasValue(metadata.quality) || !hasValue(checkin.notes || metadata.childFeedback || metadata.blocker);
    });

    return [
      {
        id: 'task-ability',
        title: '任务缺能力点',
        description: '任务需要落到三层模型的具体能力点，后续诊断才能解释它服务什么目标。',
        count: tasksMissingAbility.length,
        total: tasks.length,
        tone: 'amber',
        path: '/parent/tasks',
        action: '去任务补齐',
        examples: tasksMissingAbility.map((task) => task.name),
      },
      {
        id: 'task-target-type',
        title: '任务缺目标类型',
        description: '目标类型用于区分习惯过程、能力成长、知识掌握和考试结果。',
        count: tasksMissingTargetType.length,
        total: tasks.length,
        tone: 'blue',
        path: '/parent/tasks',
        action: '去任务补齐',
        examples: tasksMissingTargetType.map((task) => task.name),
      },
      {
        id: 'goal-ability',
        title: '目标缺能力点',
        description: '目标如果没有绑定能力点，报告和建议只能停留在目标名称层面。',
        count: goalsMissingAbility.length,
        total: goals.length,
        tone: 'amber',
        path: '/parent/goals',
        action: '去目标补齐',
        examples: goalsMissingAbility.map((goal) => goal.title),
      },
      {
        id: 'book-core',
        title: '图书缺 ISBN、页数或类型',
        description: '图书基础字段会影响阅读档案、导入去重和后续阅读建议。',
        count: booksMissingCore.length,
        total: books.length,
        tone: 'emerald',
        path: '/parent/library',
        action: '去图书馆',
        examples: booksMissingCore.map((book) => book.name),
      },
      {
        id: 'reading-core',
        title: '在读记录缺日期或页数',
        description: '阅读记录需要起始时间、当前页数和图书总页数，才能判断阅读推进速度。',
        count: readingsMissingCore.length,
        total: readings.length,
        tone: 'blue',
        path: '/parent/library',
        action: '去阅读记录',
        examples: readingsMissingCore.map((reading) => reading.book?.name || `记录 ${reading.id}`),
      },
      {
        id: 'checkin-quality',
        title: '打卡缺质量评价或家长观察',
        description: '完成状态之外，需要质量评价和观察备注，后续诊断才有证据可用。',
        count: checkinsMissingQuality.length,
        total: checkins.filter((checkin) => checkin.status !== 'pending' && checkin.status !== 'not_involved').length,
        tone: 'red',
        path: '/parent',
        action: '去今日概览',
        examples: checkinsMissingQuality.map((checkin) => `任务 ${checkin.taskId}`),
      },
    ];
  }, [booksQuery.data, checkinsQuery.data, goalsQuery.data, readingsQuery.data, tasksQuery.data]);

  const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);
  const totalChecked = issues.reduce((sum, issue) => sum + issue.total, 0);
  const completeGroups = issues.filter((issue) => issue.count === 0).length;
  const priorityIssues = issues.filter((issue) => issue.count > 0).slice(0, 3);
  const diagnostics = useMemo<DiagnosticCard[]>(() => {
    const tasks = tasksQuery.data || [];
    const books = booksQuery.data || [];
    const readings = readingsQuery.data || [];
    const todayCheckins = checkinsQuery.data || [];
    const recentCheckins = recentCheckinsQuery.data || [];
    const completedStatuses = new Set(['completed', 'partial']);
    const negativeStatuses = new Set(['not_completed', 'postponed']);
    const recent28Start = getDateWindow(date, 28)[0];
    const weekStarts = getDateWindow(date, 56).filter((_, index) => index % 7 === 0);
    const actionableAll = recentCheckins.filter((checkin) => checkin.status !== 'pending' && checkin.status !== 'not_involved');
    const actionableRecent = actionableAll.filter((checkin) => checkin.date >= recent28Start);
    const actionablePrevious = actionableAll.filter((checkin) => checkin.date < recent28Start);
    const completedRecent = actionableRecent.filter((checkin) => completedStatuses.has(checkin.status || ''));
    const negativeRecent = actionableRecent.filter((checkin) => negativeStatuses.has(checkin.status || ''));
    const completedPrevious = actionablePrevious.filter((checkin) => completedStatuses.has(checkin.status || ''));
    const firstHalf = actionableRecent.filter((checkin) => checkin.date < getDateWindow(date, 14)[0]);
    const secondHalf = actionableRecent.filter((checkin) => checkin.date >= getDateWindow(date, 14)[0]);
    const firstRate = firstHalf.length ? firstHalf.filter((checkin) => completedStatuses.has(checkin.status || '')).length / firstHalf.length : 0;
    const secondRate = secondHalf.length ? secondHalf.filter((checkin) => completedStatuses.has(checkin.status || '')).length / secondHalf.length : 0;
    const twoWeekVelocity = Math.round((secondRate - firstRate) * 100);
    const completionRate = actionableRecent.length ? Math.round((completedRecent.length / actionableRecent.length) * 100) : 0;
    const previousCompletionRate = actionablePrevious.length ? Math.round((completedPrevious.length / actionablePrevious.length) * 100) : 0;
    const fourWeekVelocity = completionRate - previousCompletionRate;
    const negativeRate = actionableRecent.length ? Math.round((negativeRecent.length / actionableRecent.length) * 100) : 0;
    const weeklyNegativeRates = weekStarts.map((start, index) => {
      const end = weekStarts[index + 1] || '9999-12-31';
      const rows = actionableAll.filter((checkin) => checkin.date >= start && checkin.date < end);
      return rows.length ? rows.filter((checkin) => negativeStatuses.has(checkin.status || '')).length / rows.length : 0;
    });
    const weeklyAverage = weeklyNegativeRates.length
      ? weeklyNegativeRates.reduce((sum, value) => sum + value, 0) / weeklyNegativeRates.length
      : 0;
    const stabilityVolatility = weeklyNegativeRates.length
      ? Math.round(Math.sqrt(weeklyNegativeRates.reduce((sum, value) => sum + Math.pow(value - weeklyAverage, 2), 0) / weeklyNegativeRates.length) * 100)
      : 0;
    const metadataRows = actionableRecent.map((checkin) => checkin.metadata || {});
    const stabilityRows = metadataRows.filter((metadata) => hasValue(metadata.sleepHours) || hasValue(metadata.mood) || hasValue(metadata.externalLoad));
    const cognitiveRows = metadataRows.filter((metadata) => hasValue(metadata.attemptCount) || hasValue(metadata.cognitiveError) || hasValue(metadata.reviewQuality));
    const lowSleepRows = metadataRows.filter((metadata) => Number(metadata.sleepHours) > 0 && Number(metadata.sleepHours) < 7);
    const externalLoadRows = metadataRows.filter((metadata) => hasValue(metadata.externalLoad) && metadata.externalLoad !== 'none');
    const qualityRows = actionableRecent.filter((checkin) => hasValue(checkin.metadata?.quality) || hasValue(checkin.notes));
    const completedToday = todayCheckins.filter((checkin) => completedStatuses.has(checkin.status || '')).length;
    const sources = [
      tasks.length > 0 ? '任务' : '',
      actionableRecent.length > 0 ? '打卡' : '',
      readings.length > 0 ? '阅读' : '',
      books.length > 0 ? '图书' : '',
    ].filter(Boolean);
    const confidence = Math.min(95, Math.max(20, Math.round(actionableAll.length * 2 + sources.length * 12)));
    const overloadSignalCount = lowSleepRows.length + externalLoadRows.length;
    const evidenceCoverage = completedRecent.length ? Math.round((qualityRows.length / completedRecent.length) * 100) : 0;
    const capacityIndex = Math.max(
      0,
      Math.min(
        100,
        Math.round(70 + fourWeekVelocity * 0.35 - negativeRate * 0.35 - stabilityVolatility * 0.25 - overloadSignalCount * 2 + Math.min(evidenceCoverage, 60) * 0.15)
      )
    );
    const taskDomainMap = new Map<number, DomainKey>();
    tasks.forEach((task) => {
      const domain = getTaskDomain(task);
      if (domain) taskDomainMap.set(task.id, domain);
    });
    const domainLabels: Record<DomainKey, string> = {
      english: '英语',
      math: '数理',
      chinese: '大语文',
    };
    const domainSummaries = (Object.keys(domainLabels) as DomainKey[]).map((domainKey): DomainSummary => {
      const taskIds = new Set(tasks.filter((task) => taskDomainMap.get(task.id) === domainKey).map((task) => task.id));
      const rows = actionableRecent.filter((checkin) => taskDomainMap.get(Number(checkin.taskId)) === domainKey);
      const completedRows = rows.filter((checkin) => completedStatuses.has(checkin.status || ''));
      const negativeRows = rows.filter((checkin) => negativeStatuses.has(checkin.status || ''));
      const cognitiveSamples = rows.filter((checkin) => {
        const metadata = checkin.metadata || {};
        return hasValue(metadata.attemptCount) || hasValue(metadata.cognitiveError) || hasValue(metadata.reviewQuality);
      }).length;
      const qualitySamples = rows.filter((checkin) => hasValue(checkin.metadata?.quality) || hasValue(checkin.notes)).length;
      return {
        key: domainKey,
        label: domainLabels[domainKey],
        taskIds,
        samples: rows.length,
        completionRate: rows.length ? Math.round((completedRows.length / rows.length) * 100) : 0,
        negativeRate: rows.length ? Math.round((negativeRows.length / rows.length) * 100) : 0,
        cognitiveSamples,
        qualitySamples,
      };
    });
    const domainsWithSamples = domainSummaries.filter((domain) => domain.samples > 0);
    const weakDomains = domainsWithSamples.filter((domain) => domain.samples >= 3 && (domain.completionRate < 60 || domain.negativeRate >= 30));
    const strongestDomain = domainsWithSamples.reduce<DomainSummary | null>((best, domain) => {
      if (!best) return domain;
      return domain.completionRate > best.completionRate ? domain : best;
    }, null);
    const weakestDomain = domainsWithSamples.reduce<DomainSummary | null>((worst, domain) => {
      if (!worst) return domain;
      return domain.completionRate < worst.completionRate ? domain : worst;
    }, null);
    const crossDomainSpread = strongestDomain && weakestDomain ? strongestDomain.completionRate - weakestDomain.completionRate : 0;
    const crossDomainSamples = domainsWithSamples.reduce((sum, domain) => sum + domain.samples, 0);
    const updatedAt = `${date} / 近 8 周`;

    const cards: DiagnosticCard[] = [];
    cards.push({
      id: 'data-sufficiency',
      title: '数据充足度',
      verdict: actionableAll.length >= 20 && sources.length >= 3 ? '可以支撑轻量规则判断' : '样本偏少，先补记录',
      description: actionableAll.length >= 20
        ? '当前已有一定数量的打卡样本，可以做初步规则判断，但仍不替代长期趋势分析。'
        : '近 8 周有效打卡样本不足，诊断只能作为提醒，不能作为强结论。',
      severity: actionableAll.length >= 20 && sources.length >= 3 ? 'stable' : 'warning',
      confidence,
      sampleCount: actionableAll.length,
      sources,
      updatedAt,
      evidence: [
        `近 8 周有效打卡 ${actionableAll.length} 条，最近 4 周 ${actionableRecent.length} 条。`,
        `当前接入 ${sources.length} 类数据源。`,
        `数据质量缺口 ${totalIssues} 条。`,
      ],
      rule: '规则：近 8 周有效打卡 >= 20 且数据源 >= 3 时，允许轻量诊断。',
    });

    cards.push({
      id: 'execution-break',
      title: '执行断裂',
      verdict: negativeRate >= 25 || fourWeekVelocity <= -20 || twoWeekVelocity <= -20 ? '存在执行断裂风险' : '执行节奏基本可用',
      description: negativeRate >= 25 || fourWeekVelocity <= -20 || twoWeekVelocity <= -20
        ? '未完成、推迟或部分完成占比偏高，优先缩小任务颗粒度并减少当天任务数。'
        : '近 8 周完成节奏没有明显断裂，可以继续观察任务颗粒度和复盘质量。',
      severity: negativeRate >= 35 || fourWeekVelocity <= -30 || twoWeekVelocity <= -30 ? 'risk' : negativeRate >= 25 || fourWeekVelocity <= -20 || twoWeekVelocity <= -20 ? 'warning' : 'stable',
      confidence,
      sampleCount: actionableRecent.length,
      sources: ['任务', '打卡'],
      updatedAt,
      evidence: [
        `最近 4 周完成率 ${completionRate}%，前 4 周完成率 ${previousCompletionRate}%。`,
        `未完成或推迟占比 ${negativeRate}%。`,
        `4 周 Velocity ${fourWeekVelocity >= 0 ? '+' : ''}${fourWeekVelocity}%，近 14 天变化 ${twoWeekVelocity >= 0 ? '+' : ''}${twoWeekVelocity}%。`,
      ],
      rule: '规则：负向状态占比 >= 25%、4 周 Velocity <= -20% 或近 14 天下降 >= 20%，提示执行断裂。',
    });

    cards.push({
      id: 'overload',
      title: '高压透支',
      verdict: lowSleepRows.length + externalLoadRows.length >= 3 && completedToday >= 3 ? '存在高压透支信号' : '暂无明显透支信号',
      description: lowSleepRows.length + externalLoadRows.length >= 3 && completedToday >= 3
        ? '状态负载记录和任务交付同时偏高，需要降低非关键任务密度，避免用完成率掩盖疲劳。'
        : '当前睡眠、情绪和外部负载记录没有形成连续风险，但稳定性数据仍应继续补齐。',
      severity: lowSleepRows.length + externalLoadRows.length >= 5 ? 'risk' : lowSleepRows.length + externalLoadRows.length >= 3 ? 'warning' : 'info',
      confidence: Math.min(confidence, Math.max(25, stabilityRows.length * 12)),
      sampleCount: stabilityRows.length,
      sources: ['稳定性记录', '打卡'],
      updatedAt,
      evidence: [
        `最近 4 周稳定性记录 ${stabilityRows.length} 条。`,
        `睡眠低于 7 小时 ${lowSleepRows.length} 条。`,
        `外部负载记录 ${externalLoadRows.length} 条，稳定性波动率 ${stabilityVolatility}%。`,
      ],
      rule: '规则：低睡眠或外部负载 >= 3 且当天仍高交付，提示高压透支。',
    });

    cards.push({
      id: 'capacity-index',
      title: '余力指数',
      verdict: capacityIndex >= 70 ? '可以维持或小幅加码' : capacityIndex >= 45 ? '建议维持并修复短板' : '建议减压优先',
      description: capacityIndex >= 70
        ? '完成趋势、负向状态和稳定性波动仍在可控范围内，可以维持强项并小幅补短板。'
        : capacityIndex >= 45
          ? '当前余力一般，适合维持核心任务，同时集中修复一到两个关键缺口。'
          : '当前余力偏低，不建议继续加任务，先降低负载、恢复睡眠和完成节奏。',
      severity: capacityIndex >= 70 ? 'stable' : capacityIndex >= 45 ? 'warning' : 'risk',
      confidence,
      sampleCount: actionableAll.length,
      sources: ['打卡', '稳定性记录', '质量评价'],
      updatedAt,
      evidence: [
        `余力指数 ${capacityIndex}/100。`,
        `4 周 Velocity ${fourWeekVelocity >= 0 ? '+' : ''}${fourWeekVelocity}%。`,
        `负向状态占比 ${negativeRate}%，稳定性波动率 ${stabilityVolatility}%。`,
      ],
      rule: '规则：以 4 周 Velocity、负向状态、稳定性波动、负载信号和证据覆盖率合成余力指数。',
    });

    cards.push({
      id: 'cross-domain',
      title: '跨学科交叉验证',
      verdict: domainsWithSamples.length < 2
        ? '学科样本不足'
        : weakDomains.length >= 2
          ? '更像通用执行或认知问题'
          : crossDomainSpread >= 30
            ? `${weakestDomain?.label || '单科'}更需要单独修复`
            : '学科间表现差异不大',
      description: domainsWithSamples.length < 2
        ? '英语、数理和大语文中至少需要两个方向有打卡样本，才能判断是单科问题还是通用问题。'
        : weakDomains.length >= 2
          ? '多个学科同时出现低完成率或高负向状态，优先排查通用执行、睡眠负载和认知方法。'
          : crossDomainSpread >= 30
            ? '不同学科之间表现差异明显，优先把问题定位到较弱方向，而不是直接增加所有任务。'
            : '当前学科间差异不大，可继续按目标优先级微调任务密度。',
      severity: domainsWithSamples.length < 2 ? 'info' : weakDomains.length >= 2 || crossDomainSpread >= 30 ? 'warning' : 'stable',
      confidence: Math.min(confidence, Math.max(25, crossDomainSamples * 8)),
      sampleCount: crossDomainSamples,
      sources: ['任务标签', '打卡', '认知记录'],
      updatedAt,
      evidence: [
        `英语 ${domainSummaries.find((domain) => domain.key === 'english')?.samples || 0} 条，完成率 ${domainSummaries.find((domain) => domain.key === 'english')?.completionRate || 0}%。`,
        `数理 ${domainSummaries.find((domain) => domain.key === 'math')?.samples || 0} 条，完成率 ${domainSummaries.find((domain) => domain.key === 'math')?.completionRate || 0}%。`,
        `大语文 ${domainSummaries.find((domain) => domain.key === 'chinese')?.samples || 0} 条，完成率 ${domainSummaries.find((domain) => domain.key === 'chinese')?.completionRate || 0}%。`,
      ],
      rule: '规则：两个以上学科有样本时，比较完成率和负向状态；多学科同时弱偏通用问题，单科明显落后偏专项问题。',
    });

    cards.push({
      id: 'input-shortage',
      title: '输入不足',
      verdict: readings.length === 0 && completedRecent.length < 8 ? '输入样本不足' : '输入记录可继续累积',
      description: readings.length === 0 && completedRecent.length < 8
        ? '阅读或有效完成记录偏少，后续报告容易只看到任务状态，看不到能力输入。'
        : '阅读和任务输入已有基础，下一步重点是补齐阅读页数、日期和任务能力点。',
      severity: readings.length === 0 && completedRecent.length < 8 ? 'warning' : 'info',
      confidence,
      sampleCount: readings.length + completedRecent.length,
      sources: ['阅读', '任务', '打卡'],
      updatedAt,
      evidence: [
        `在读记录 ${readings.length} 条。`,
        `最近 4 周完成或部分完成 ${completedRecent.length} 条。`,
        `图书基础数据 ${books.length} 本。`,
      ],
      rule: '规则：无在读记录且最近 4 周完成样本 < 8，提示输入不足。',
    });

    cards.push({
      id: 'output-inflation',
      title: '输出虚高',
      verdict: completionRate >= 80 && (qualityRows.length < completedRecent.length * 0.4 || cognitiveRows.length < 3) ? '可能存在输出虚高' : '输出证据相对匹配',
      description: completionRate >= 80 && (qualityRows.length < completedRecent.length * 0.4 || cognitiveRows.length < 3)
        ? '完成率较高，但质量评价、认知证据或家长观察不足，报告容易高估真实掌握度。'
        : '完成状态和质量证据没有明显脱节，可以继续补认知记录提升诊断可靠性。',
      severity: completionRate >= 80 && (qualityRows.length < completedRecent.length * 0.4 || cognitiveRows.length < 3) ? 'warning' : 'stable',
      confidence,
      sampleCount: completedRecent.length,
      sources: ['打卡', '认知记录', '质量评价'],
      updatedAt,
      evidence: [
        `最近 4 周完成率 ${completionRate}%。`,
        `质量评价或备注 ${qualityRows.length} 条。`,
        `认知记录 ${cognitiveRows.length} 条。`,
      ],
      rule: '规则：完成率 >= 80%，但质量证据 < 完成样本 40% 或认知记录 < 3，提示输出虚高。',
    });

    return cards;
  }, [booksQuery.data, checkinsQuery.data, date, readingsQuery.data, recentCheckinsQuery.data, tasksQuery.data, totalIssues]);

  const refreshAll = () => {
    tasksQuery.refetch();
    goalsQuery.refetch();
    booksQuery.refetch();
    readingsQuery.refetch();
    checkinsQuery.refetch();
    recentCheckinsQuery.refetch();
  };

  if (!selectedChildId) {
    return (
      <div className="space-y-5">
        <PageToolbar
          left={<PageToolbarTitle icon={ClipboardCheck} title="数据体检" description="先选择孩子，再检查任务、目标、阅读和打卡数据缺口" />}
        />
        <EmptyPanel icon={ClipboardCheck} title="请选择孩子" description="数据体检按孩子维度检查，避免不同孩子的数据混在一起。" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageToolbar
        left={
          <PageToolbarTitle
            icon={ClipboardCheck}
            title="数据体检"
            description={`${selectedChild?.name || '当前孩子'}的数据缺口预检，用于 AI、报告和诊断之前的修复入口`}
          />
        }
        right={
          <>
            <DatePicker value={date} onChange={setDate} />
            <Button variant="outline" className="h-10 rounded-lg bg-white" onClick={refreshAll} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              刷新
            </Button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: '检查分组', value: issues.length, icon: ClipboardCheck, tone: 'bg-indigo-50 text-indigo-700' },
          { label: '已完整分组', value: completeGroups, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
          { label: '待补缺口', value: totalIssues, icon: AlertTriangle, tone: 'bg-amber-50 text-amber-700' },
          { label: '检查样本', value: totalChecked, icon: FileWarning, tone: 'bg-slate-100 text-slate-700' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', metric.tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                {isLoading ? <Skeleton className="h-6 w-10" /> : <span className="text-2xl font-semibold text-slate-950">{metric.value}</span>}
              </div>
              <p className="mt-3 text-xs font-medium text-slate-500">{metric.label}</p>
            </div>
          );
        })}
      </section>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">规则诊断 V0.1</h2>
              <p className="mt-1 text-xs text-slate-500">基于近 8 周记录生成轻量判断，只展示规则和证据，不替代人工复盘。</p>
            </div>
          </div>
          <Badge className="w-fit border-violet-100 bg-violet-50 text-violet-700 hover:bg-violet-50">规则版</Badge>
        </div>
        {isLoading ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {diagnostics.map((diagnostic) => (
              <DiagnosticCardView key={diagnostic.id} diagnostic={diagnostic} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-slate-950">下一步修复顺序</h2>
        </div>
        {priorityIssues.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {priorityIssues.map((issue, index) => (
              <div key={issue.id} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">0{index + 1}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{issue.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{issue.count} 条需要补齐</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">当前检查项没有发现缺口，可以进入规则诊断引擎准备。</p>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Button variant="outline" className="h-12 justify-start rounded-lg bg-white" onClick={() => navigate('/parent/tasks')}>
          <Target className="h-4 w-4 text-indigo-600" />
          任务字段
        </Button>
        <Button variant="outline" className="h-12 justify-start rounded-lg bg-white" onClick={() => navigate('/parent/library')}>
          <Library className="h-4 w-4 text-emerald-600" />
          图书与阅读
        </Button>
        <Button variant="outline" className="h-12 justify-start rounded-lg bg-white" onClick={() => navigate('/parent')}>
          <BookOpen className="h-4 w-4 text-amber-600" />
          今日打卡
        </Button>
      </section>
    </div>
  );
}
