import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageToolbar } from '@/components/parent/PageToolbar';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const periods = ['本周', '本月', '本学期'] as const;
type Period = typeof periods[number] | '自定义';
const dashboardTabs = [
  { key: 'today', label: '成长总览', icon: ListChecks },
  { key: 'execution', label: '执行力分析', icon: BarChart3 },
  { key: 'subject', label: '学科能力', icon: TrendingUp },
  { key: 'mood', label: '心态兴趣', icon: HeartPulse },
  { key: 'reading', label: '阅读能力', icon: BookOpen },
] as const;

type DashboardTab = typeof dashboardTabs[number]['key'];
const dashboardTabKeys = dashboardTabs.map((tab) => tab.key);

function isDashboardTab(value: string | null): value is DashboardTab {
  return !!value && dashboardTabKeys.includes(value as DashboardTab);
}

const suggestions = [
  { title: '继续保持', desc: '今日完成率表现稳定，建议延续当前学习节奏。', icon: Lightbulb, bg: 'bg-amber-50', color: 'text-amber-500' },
  { title: '注意节奏', desc: '剩余任务可先处理预计时间较短的项目。', icon: Clock3, bg: 'bg-blue-50', color: 'text-blue-500' },
];

function DashboardCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-border bg-white p-5 shadow-sm', className)}>
      {children}
    </section>
  );
}

type MetricCardItem = {
  label: string;
  value: string;
  suffix?: string;
  note: string;
  icon: React.ElementType;
  color: string;
  bg: string;
};

function MetricCard({ metric }: { metric: MetricCardItem }) {
  const Icon = metric.icon;

  return (
    <DashboardCard className="min-h-28">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', metric.bg, metric.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {metric.value}
            {metric.suffix ? <span className="ml-1 text-xs font-medium text-muted-foreground">{metric.suffix}</span> : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
        </div>
      </div>
    </DashboardCard>
  );
}

function MetricGrid({ metrics }: { metrics: MetricCardItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

function DonutChart({ value, label, colors = ['#6366f1', '#22c55e', '#f59e0b', '#e5e7eb'] }: { value: string; label: string; colors?: string[] }) {
  return (
    <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${colors[0]} 0 42%, ${colors[1]} 42% 68%, ${colors[2]} 68% 84%, ${colors[3]} 84% 100%)` }}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-2xl font-semibold text-slate-950">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function LineChartMock() {
  return (
    <svg viewBox="0 0 360 180" className="h-44 w-full overflow-visible">
      <defs>
        <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="18" x2="342" y1={34 + i * 34} y2={34 + i * 34} stroke="#edf0f6" strokeWidth="1" />
      ))}
      <path d="M24 140 C64 126 82 100 122 92 C158 84 172 62 210 68 C250 76 260 52 300 48 C318 46 332 42 342 38" fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
      <path d="M24 140 C64 126 82 100 122 92 C158 84 172 62 210 68 C250 76 260 52 300 48 C318 46 332 42 342 38 L342 164 L24 164 Z" fill="url(#lineFill)" />
      {['06.21', '06.22', '06.23', '06.24', '06.25', '06.26', '06.27'].map((d, i) => (
        <text key={d} x={24 + i * 53} y="178" textAnchor="middle" className="fill-slate-400 text-[10px]">{d}</text>
      ))}
      <g>
        <circle cx="342" cy="38" r="5" fill="#6366f1" />
        <rect x="318" y="16" width="42" height="20" rx="10" fill="#eef2ff" />
        <text x="339" y="30" textAnchor="middle" className="fill-indigo-600 text-[10px] font-semibold">85%</text>
      </g>
    </svg>
  );
}

function CompletionTrendChart({ data }: { data: CompletionTrendPoint[] }) {
  const chartData = data.length > 0 ? data : [{ date: '--', rate: 0, planned: 0, completed: 0 }];
  const width = 360;
  const height = 180;
  const points = chartData.map((item, index) => {
    const x = chartData.length === 1 ? width - 24 : 24 + (index * (width - 48)) / (chartData.length - 1);
    const y = 144 - (Math.min(item.rate, 100) / 100) * 112;
    return { ...item, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x} 156 L${points[0].x} 156 Z`;
  const latest = points[points.length - 1];

  return (
    <svg viewBox="0 0 360 180" className="h-44 w-full overflow-visible">
      <defs>
        <linearGradient id="completionTrendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="18" x2="342" y1={34 + i * 34} y2={34 + i * 34} stroke="#edf0f6" strokeWidth="1" />
      ))}
      <path d={areaPath} fill="url(#completionTrendFill)" />
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point) => (
        <circle key={point.date} cx={point.x} cy={point.y} r="4" fill="#6366f1" />
      ))}
      {points.map((point, index) => (
        <text key={point.date} x={point.x} y="178" textAnchor="middle" className="fill-slate-400 text-[10px]">
          {index % Math.ceil(points.length / 7) === 0 ? point.date : ''}
        </text>
      ))}
      <rect x={Math.max(0, latest.x - 24)} y={Math.max(10, latest.y - 26)} width="48" height="20" rx="10" fill="#eef2ff" />
      <text x={Math.max(24, latest.x)} y={Math.max(24, latest.y - 12)} textAnchor="middle" className="fill-indigo-600 text-[10px] font-semibold">
        {latest.rate}%
      </text>
    </svg>
  );
}

const fallbackTimeItems: Array<[string, string, string, string]> = [
    ['语文', '45分钟', '36%', 'bg-indigo-500'],
    ['数学', '35分钟', '28%', 'bg-emerald-500'],
    ['英语', '25分钟', '20%', 'bg-amber-400'],
    ['其他', '20分钟', '16%', 'bg-purple-500'],
];

function TimeDistribution({ items = fallbackTimeItems, total = '125' }: { items?: Array<[string, string, string, string]>; total?: string }) {
  return (
    <div className="flex items-center gap-5">
      <DonutChart value={total} label="分钟" colors={['#6366f1', '#22c55e', '#f59e0b', '#a855f7']} />
      <div className="flex-1 space-y-3">
        {items.map(([name, time, pct, color]) => (
          <div key={name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600"><i className={cn('h-2.5 w-2.5 rounded-full', color)} />{name}</span>
            <span className="font-medium text-slate-900">{time} <span className="text-xs text-muted-foreground">({pct})</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreGauge({ score, label }: { score: string; label: string }) {
  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[conic-gradient(#6366f1_0_76%,#eef2ff_76%_100%)]">
      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-3xl font-semibold text-slate-950">{score}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function RadarChartMock() {
  return (
    <svg viewBox="0 0 240 220" className="mx-auto h-56 w-full max-w-xs">
      <defs>
        <linearGradient id="radarFill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      {[42, 68, 94].map((r) => (
        <polygon key={r} points={`120,${110 - r} ${120 + r * 0.95},${110 - r * 0.31} ${120 + r * 0.59},${110 + r * 0.81} ${120 - r * 0.59},${110 + r * 0.81} ${120 - r * 0.95},${110 - r * 0.31}`} fill="none" stroke="#e5e7eb" />
      ))}
      {[
        [120, 16],
        [209, 81],
        [175, 186],
        [65, 186],
        [31, 81],
      ].map(([x, y]) => (
        <line key={`${x}-${y}`} x1="120" y1="110" x2={x} y2={y} stroke="#e5e7eb" />
      ))}
      <polygon points="120,34 190,88 166,164 76,160 50,88" fill="url(#radarFill)" stroke="#6366f1" strokeWidth="3" />
      {['基础知识', '阅读理解', '表达输出', '专注稳定', '综合应用'].map((label, i) => {
        const coords = [[120, 10], [216, 76], [184, 208], [56, 208], [24, 76]][i];
        return <text key={label} x={coords[0]} y={coords[1]} textAnchor="middle" className="fill-slate-500 text-[10px]">{label}</text>;
      })}
    </svg>
  );
}

function BarRows({ rows }: { rows: Array<[string, number, string]> }) {
  return (
    <div className="space-y-4">
      {rows.map(([label, value, color]) => (
        <div key={label}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-slate-600">{label}</span>
            <span className="font-medium text-slate-950">{value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

type DashboardStats = {
  totalTasks: number;
  plannedTasks?: number;
  completedTasks?: number;
  weeklyCompletionRate: number;
  todayStudyMinutes: number;
  booksRead: number;
  todayReadingCount: number;
  taskStatusCounts?: TaskStatusCounts;
  completionTrend?: CompletionTrendPoint[];
  taskTypeDistribution?: TaskTypeDistributionItem[];
  focusTasks?: FocusTask[];
  readingPerformance?: ReadingPerformance;
};

type TaskStatusCounts = {
  completed: number;
  partial: number;
  notCompleted: number;
  postponed: number;
  notInvolved: number;
};

type CompletionTrendPoint = {
  date: string;
  planned: number;
  completed: number;
  rate: number;
};

type TaskTypeDistributionItem = {
  key: string;
  label: string;
  minutes: number;
};

type FocusTask = {
  planId: number;
  taskId: number;
  name: string;
  category: string;
  planned: number;
  completed: number;
  postponed: number;
  notCompleted: number;
  riskScore: number;
};

type ReadingPerformance = {
  records: number;
  minutes: number;
  pages: number;
  recentBooks: Array<{
    id: number;
    name: string;
    pages: number;
    minutes: number;
    readDate: string;
  }>;
};

type ReadingStats = {
  readingCount: number;
  weekReadCount: number;
  monthReadCount: number;
  rangeReadCount?: number;
};

type DateRange = { startDate: string; endDate: string };
type SemesterConfig = {
  schoolYear: string;
  term: 'first' | 'second';
  grade: string;
  startDate: string;
  endDate: string;
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentWeekRange(date: Date): DateRange {
  const start = getMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
}

function getCurrentMonthRange(date: Date): DateRange {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
}

function getMonday(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function TodayView({
  stats,
  readingStats,
  range,
}: {
  stats?: DashboardStats;
  readingStats?: ReadingStats;
  range: DateRange;
}) {
  const rangePlannedTasks = stats?.plannedTasks ?? 0;
  const rangeCompletedTasks = stats?.completedTasks ?? 0;
  const rangeCompletionRate = rangePlannedTasks > 0
    ? Math.round((rangeCompletedTasks / rangePlannedTasks) * 100)
    : 0;
  const focusTasks = stats?.focusTasks || [];
  const readingPerformance = stats?.readingPerformance;
  const statusCounts = stats?.taskStatusCounts || {
    completed: 0,
    partial: 0,
    notCompleted: 0,
    postponed: 0,
    notInvolved: 0,
  };
  const statusTotal = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
  const statusRows: Array<[string, number, number, string]> = [
    ['已完成', statusCounts.completed, statusTotal ? Math.round((statusCounts.completed / statusTotal) * 100) : 0, 'bg-emerald-500'],
    ['部分完成', statusCounts.partial, statusTotal ? Math.round((statusCounts.partial / statusTotal) * 100) : 0, 'bg-amber-400'],
    ['未完成', statusCounts.notCompleted, statusTotal ? Math.round((statusCounts.notCompleted / statusTotal) * 100) : 0, 'bg-rose-500'],
    ['已延期', statusCounts.postponed, statusTotal ? Math.round((statusCounts.postponed / statusTotal) * 100) : 0, 'bg-orange-500'],
    ['不涉及', statusCounts.notInvolved, statusTotal ? Math.round((statusCounts.notInvolved / statusTotal) * 100) : 0, 'bg-slate-300'],
  ];
  const typeColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-400', 'bg-sky-500', 'bg-slate-400'];
  const typeTotalMinutes = stats?.taskTypeDistribution?.reduce((sum, item) => sum + item.minutes, 0) || 0;
  const timeDistribution = typeTotalMinutes > 0
    ? (stats?.taskTypeDistribution || []).map((item, index) => [
      item.label,
      `${item.minutes}分钟`,
      `${Math.round((item.minutes / typeTotalMinutes) * 100)}%`,
      typeColors[index % typeColors.length],
    ] as [string, string, string, string])
    : fallbackTimeItems;
  const metricCards: MetricCardItem[] = [
    { label: '计划任务', value: String(rangePlannedTasks), suffix: '个', note: '当前范围应完成', icon: ListChecks, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '已完成', value: String(rangeCompletedTasks), suffix: '个', note: '完成与部分完成', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '完成率', value: String(rangeCompletionRate), suffix: '%', note: '范围完成情况', icon: Target, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '学习时长', value: String(stats?.todayStudyMinutes || 0), suffix: '分钟', note: '范围累计', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '阅读记录', value: String(readingStats?.rangeReadCount ?? stats?.todayReadingCount ?? 0), suffix: '次', note: '范围阅读记录', icon: BookOpen, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  return (
    <>
      <MetricGrid metrics={metricCards} />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_0.9fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">任务完成概况</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr] md:items-center">
            <DonutChart value={`${rangeCompletionRate}%`} label="完成率" colors={['#22c55e', '#f59e0b', '#ef4444', '#f97316']} />
            <div className="space-y-3 text-sm">
              {statusRows.map(([label, count, rate, dot]) => (
                <div key={String(label)} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600"><i className={cn('h-2.5 w-2.5 rounded-full', dot)} />{label}</span>
                  <span className="text-xs text-muted-foreground">{count}个 ({rate}%)</span>
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-950">完成率趋势</h2>
            <Button variant="outline" size="sm" className="h-8 rounded-lg">当前范围</Button>
          </div>
          <CompletionTrendChart data={stats?.completionTrend || []} />
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">任务类型分布</h2>
          <div className="mt-4">
            <TimeDistribution items={timeDistribution} total={String(stats?.todayStudyMinutes || 0)} />
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">需要关注的任务</h2>
              <p className="mt-1 text-xs text-muted-foreground">当前范围内未完成和延期较多的任务</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              {focusTasks.length} 项
            </span>
          </div>
          <div className="space-y-3">
            {focusTasks.length > 0 ? focusTasks.map((task) => (
              <div key={`${task.planId}-${task.taskId}`} className="flex items-center justify-between rounded-lg border border-border bg-white p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {task.name}
                      <span className="ml-2 rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">{task.category}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      计划 {task.planned} 次 · 已完成 {task.completed} 次 · 未完成 {task.notCompleted} 次 · 延期 {task.postponed} 次
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                  关注度 {task.riskScore}
                </span>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-border bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                {range.startDate} 至 {range.endDate} 暂无需要重点关注的任务
              </div>
            )}
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">阅读表现</h2>
          <p className="mt-1 text-xs text-muted-foreground">当前范围内的阅读记录、时长和页数</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: '阅读记录', value: readingPerformance?.records || 0, suffix: '次' },
              { label: '阅读时长', value: readingPerformance?.minutes || 0, suffix: '分钟' },
              { label: '阅读页数', value: readingPerformance?.pages || 0, suffix: '页' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {item.value}
                  <span className="ml-1 text-xs font-medium text-muted-foreground">{item.suffix}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {(readingPerformance?.recentBooks || []).length > 0 ? readingPerformance!.recentBooks.map((book) => (
              <div key={`${book.id}-${book.readDate}`} className="flex items-center justify-between rounded-lg border border-border bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{book.name}</p>
                  <p className="text-xs text-muted-foreground">{book.readDate}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                  {book.pages}页 · {book.minutes}分钟
                </span>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-border bg-slate-50 p-6 text-center text-sm text-muted-foreground">
                当前范围暂无阅读记录
              </div>
            )}
          </div>
        </DashboardCard>
      </div>

    </>
  );
}

function ExecutionView() {
  const metrics: MetricCardItem[] = [
    { label: '综合评分', value: '85', suffix: '分', note: '执行力优秀', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '准时开始', value: '82', suffix: '%', note: '按计划启动', icon: Clock3, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '独立完成', value: '76', suffix: '%', note: '少量陪伴', icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '连续坚持', value: '88', suffix: '%', note: '稳定性较好', icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '延期控制', value: '64', suffix: '%', note: '仍需关注', icon: CheckCircle2, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  return (
    <>
      <MetricGrid metrics={metrics} />

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1fr_1.2fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">综合执行评分</h2>
          <div className="mt-5"><ScoreGauge score="85" label="优秀" /></div>
          <p className="mt-4 text-center text-sm text-muted-foreground">超过了 85% 的同龄孩子</p>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">任务完成趋势</h2>
          <LineChartMock />
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">执行力细分</h2>
          <div className="mt-5">
            <BarRows rows={[['准时开始', 82, 'bg-indigo-500'], ['独立完成', 76, 'bg-emerald-500'], ['连续坚持', 88, 'bg-blue-500'], ['延期控制', 64, 'bg-amber-400']]} />
          </div>
        </DashboardCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">推迟任务列表</h2>
          <div className="mt-4 space-y-3">
            {['英语阅读复盘', '数学错题整理', '古文背诵'].map((name, index) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{name}</p>
                  <p className="text-xs text-muted-foreground">截止时间 20:{index + 1}0</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-lg">查看详情</Button>
              </div>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">改进建议</h2>
          <div className="mt-4 space-y-4">
            {suggestions.map((item) => {
              const Icon = item.icon;
              return <div key={item.title} className="flex gap-3"><div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', item.bg, item.color)}><Icon className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="text-sm text-muted-foreground">{item.desc}</p></div></div>;
            })}
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

function SubjectView() {
  const metrics: MetricCardItem[] = [
    { label: '语文', value: '85', suffix: '分', note: '能力分', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '数学', value: '82', suffix: '分', note: '能力分', icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '英语', value: '78', suffix: '分', note: '能力分', icon: ListChecks, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '科学', value: '76', suffix: '分', note: '能力分', icon: BarChart3, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '综合素养', value: '80', suffix: '分', note: '能力分', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  return (
    <>
      <MetricGrid metrics={metrics} />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr_1.2fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">综合能力评分</h2>
          <div className="mt-5"><ScoreGauge score="85" label="语文" /></div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">能力维度分布</h2>
          <RadarChartMock />
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">任务表现趋势</h2>
          <LineChartMock />
        </DashboardCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">能力维度详情</h2>
          <div className="mt-4">
            <BarRows rows={[['基础知识', 82, 'bg-indigo-500'], ['阅读理解', 86, 'bg-blue-500'], ['写作表达', 78, 'bg-emerald-500'], ['文字积累', 80, 'bg-amber-400'], ['古诗文', 88, 'bg-purple-500']]} />
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">知识点掌握情况</h2>
          <div className="mt-5"><DonutChart value="78%" label="掌握率" /></div>
        </DashboardCard>
      </div>
    </>
  );
}

function MoodView() {
  const metrics: MetricCardItem[] = [
    { label: '学习兴趣', value: '87', suffix: '分', note: '兴趣指数', icon: HeartPulse, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '主动性', value: '8.2', suffix: '/10', note: '学习主动', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '专注度', value: '8.5', suffix: '/10', note: '状态稳定', icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '学习动力', value: '8.0', suffix: '/10', note: '动力良好', icon: ShieldCheck, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '情绪状态', value: '良好', note: '整体平稳', icon: CheckCircle2, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  return (
    <>
      <MetricGrid metrics={metrics} />

      <div className="grid gap-5 xl:grid-cols-3">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">兴趣偏好分布</h2>
          <div className="mt-4">
            <BarRows rows={[['阅读', 90, 'bg-indigo-500'], ['数学思维', 78, 'bg-blue-500'], ['科学探索', 85, 'bg-emerald-500'], ['英语表达', 70, 'bg-amber-400']]} />
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">任务偏好 TOP6</h2>
          <div className="mt-5 flex min-h-40 flex-wrap items-center justify-center gap-3">
            {['课外阅读', '思维训练', '英语听说', '古诗文', '科学实验', '错题复盘'].map((tag, index) => (
              <span key={tag} className={cn('rounded-full px-4 py-2 text-sm font-medium', ['bg-rose-50 text-rose-600', 'bg-indigo-50 text-indigo-600', 'bg-emerald-50 text-emerald-600', 'bg-amber-50 text-amber-600'][index % 4])}>{tag}</span>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">专注度趋势</h2>
          <LineChartMock />
        </DashboardCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">学习心态分析</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {['成就感强', '抗挫能力稳定', '自信心良好', '学习期待积极'].map((text) => <div key={text} className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-700">{text}</div>)}
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">兴趣发展建议</h2>
          <div className="mt-4 space-y-4">
            {suggestions.map((item) => {
              const Icon = item.icon;
              return <div key={item.title} className="flex gap-3"><div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', item.bg, item.color)}><Icon className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="text-sm text-muted-foreground">{item.desc}</p></div></div>;
            })}
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

function ReadingView({ stats, readingStats }: { stats?: DashboardStats; readingStats?: ReadingStats }) {
  const readingMetrics: MetricCardItem[] = [
    { label: '正在阅读', value: String(readingStats?.readingCount || 0), suffix: '本', note: '当前在读', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '本周记录', value: String(readingStats?.weekReadCount || 0), suffix: '次', note: '阅读打卡', icon: Clock3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '本月记录', value: String(readingStats?.monthReadCount || 0), suffix: '次', note: '阅读打卡', icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '当前范围', value: String(readingStats?.rangeReadCount ?? stats?.todayReadingCount ?? 0), suffix: '次', note: '范围记录', icon: BarChart3, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '在库书籍', value: String(stats?.booksRead || 0), suffix: '本', note: '累计书籍', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  return (
    <>
      <MetricGrid metrics={readingMetrics} />

      <div className="grid gap-5 xl:grid-cols-2">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">每日阅读完成趋势</h2>
          <LineChartMock />
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">每日阅读时长（分钟）</h2>
          <div className="mt-5 flex h-44 items-end justify-between gap-3">
            {[40, 68, 56, 44, 78, 50].map((h, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-indigo-300" style={{ height: `${h}%` }} />
                <span className="text-[10px] text-muted-foreground">06.{21 + index}</span>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">阅读类型分布</h2>
          <div className="mt-4"><TimeDistribution /></div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">阅读书籍 TOP5</h2>
          <div className="mt-4 space-y-3">
            {['昆虫记', '中国历史故事', '十万个为什么', '小王子', '窗边的小豆豆'].map((book, index) => (
              <div key={book} className="flex items-center justify-between text-sm"><span><b className="mr-2 text-primary">{index + 1}</b>{book}</span><span className="text-muted-foreground">{56 - index * 6}页</span></div>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">阅读能力雷达</h2>
          <RadarChartMock />
        </DashboardCard>
      </div>
    </>
  );
}

export default function GrowthDashboard() {
  const today = useMemo(() => new Date(), []);
  const defaultRange = useMemo(() => getCurrentMonthRange(today), [today]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>('本月');
  const requestedTab = searchParams.get('tab');
  const activeTab: DashboardTab = isDashboardTab(requestedTab) ? requestedTab : 'today';
  const [customRange, setCustomRange] = useState<DateRange>(defaultRange);
  const { selectedChildId } = useSelectedChild();

  const { data: semesterConfig } = useQuery({
    queryKey: ['growth-dashboard-semester-config', selectedChildId],
    queryFn: async () => {
      const response = await apiClient.get(`/children/${selectedChildId}/semester`);
      return response.data.data as SemesterConfig | null;
    },
    enabled: !!selectedChildId,
    staleTime: 5 * 60 * 1000,
  });

  const activeRange = useMemo<DateRange>(() => {
    if (period === '本周') return getCurrentWeekRange(today);
    if (period === '本月') return getCurrentMonthRange(today);
    if (period === '本学期' && semesterConfig) {
      return {
        startDate: semesterConfig.startDate,
        endDate: semesterConfig.endDate,
      };
    }
    if (period === '自定义') return customRange;
    return defaultRange;
  }, [customRange, defaultRange, period, semesterConfig, today]);

  const handlePeriodClick = (item: Period) => {
    if (item === '本学期' && !semesterConfig) {
      toast.info('请先在孩子管理里配置当前学期时间');
      return;
    }
    setPeriod(item);
  };

  const handleTabClick = (tab: DashboardTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (tab === 'today') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  };

  const { data: stats } = useQuery({
    queryKey: ['growth-dashboard-stats', selectedChildId, activeRange.startDate, activeRange.endDate],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/stats', {
        params: {
          childId: selectedChildId,
          startDate: activeRange.startDate,
          endDate: activeRange.endDate,
        },
      });
      return response.data.data as DashboardStats;
    },
    enabled: !!selectedChildId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: readingStats } = useQuery({
    queryKey: ['growth-dashboard-reading-stats', selectedChildId, activeRange.startDate, activeRange.endDate],
    queryFn: async () => {
      const response = await apiClient.get('/reading/stats', {
        params: {
          childId: selectedChildId,
          startDate: activeRange.startDate,
          endDate: activeRange.endDate,
        },
      });
      return response.data.data as ReadingStats;
    },
    enabled: !!selectedChildId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="mx-auto max-w-[1360px] space-y-5">
      <PageToolbar
        left={
          <>
            <div className="flex gap-2">
              {dashboardTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabClick(tab.key)}
                    className={cn(
	                      'flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold transition-all duration-200',
	                      activeTab === tab.key
	                        ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-200'
	                        : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="hidden h-10 w-px shrink-0 bg-border lg:block" />

            <div className="flex gap-2">
              {periods.map((item) => (
                <button
                  key={item}
                  onClick={() => handlePeriodClick(item)}
                  className={cn(
	                    'h-11 shrink-0 rounded-xl px-5 text-sm font-semibold transition-all duration-200',
	                    period === item
	                      ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-200'
	                      : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                  )}
                >
                  {item}
                </button>
              ))}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'h-11 shrink-0 rounded-xl px-5 text-sm font-semibold transition-all duration-200',
                    period === '自定义'
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-200'
                      : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                  )}
                >
                  自定义
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] rounded-xl border border-border p-4 shadow-md" align="start">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">自定义统计范围</p>
                  <DatePicker
                    value={customRange.startDate}
                    onChange={(startDate) => {
                      if (new Date(startDate) > new Date(customRange.endDate)) {
                        toast.error('开始日期不能晚于结束日期');
                        return;
                      }
                      setCustomRange({ ...customRange, startDate });
                      setPeriod('自定义');
                    }}
                    className="w-full justify-start"
                    align="start"
                  />
                  <DatePicker
                    value={customRange.endDate}
                    onChange={(endDate) => {
                      if (new Date(customRange.startDate) > new Date(endDate)) {
                        toast.error('结束日期不能早于开始日期');
                        return;
                      }
                      setCustomRange({ ...customRange, endDate });
                      setPeriod('自定义');
                    }}
                    className="w-full justify-start"
                    align="start"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </>
        }
      />

      {activeTab === 'today' && <TodayView stats={stats} readingStats={readingStats} range={activeRange} />}
      {activeTab === 'execution' && <ExecutionView />}
      {activeTab === 'subject' && <SubjectView />}
      {activeTab === 'mood' && <MoodView />}
      {activeTab === 'reading' && <ReadingView stats={stats} readingStats={readingStats} />}

    </div>
  );
}
