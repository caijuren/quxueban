import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
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
  { key: 'execution', label: '执行诊断', icon: BarChart3 },
  { key: 'subject', label: '能力证据', icon: TrendingUp },
  { key: 'mood', label: '稳定性与兴趣', icon: HeartPulse },
  { key: 'reading', label: '阅读成长', icon: BookOpen },
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

function PageQuestion({ title, desc, sampleCount, threshold = 8 }: { title: string; desc: string; sampleCount?: number; threshold?: number }) {
  const isLowSample = typeof sampleCount === 'number' && sampleCount < threshold;

  return (
    <DashboardCard className={cn('p-4', isLowSample ? 'border-amber-200 bg-amber-50/70' : 'bg-slate-50/80')}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p>
        </div>
        {typeof sampleCount === 'number' ? (
          <span className={cn(
            'shrink-0 rounded-lg px-3 py-1 text-xs font-medium',
            isLowSample ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-600'
          )}>
            样本 {sampleCount} 条
          </span>
        ) : null}
      </div>
      {isLowSample ? (
        <p className="mt-3 text-xs leading-5 text-amber-700">
          当前样本不足，只展示记录结构和待补证据，不生成强结论。
        </p>
      ) : null}
    </DashboardCard>
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
  tone?: string;
};

function MetricCard({ metric }: { metric: MetricCardItem }) {
  const Icon = metric.icon;

  return (
    <DashboardCard className={cn('min-h-24 p-4', metric.tone)}>
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', metric.bg, metric.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

type ReadingDailyTrendPoint = {
  date: string;
  records: number;
  minutes: number;
  pages: number;
  completionRate: number;
};

function ReadingTrendChart({ data }: { data: ReadingDailyTrendPoint[] }) {
  const chartData = data.length > 0 ? data : [{ date: '--', records: 0, minutes: 0, pages: 0, completionRate: 0 }];
  const width = 360;
  const points = chartData.map((item, index) => {
    const x = chartData.length === 1 ? width - 24 : 24 + (index * (width - 48)) / (chartData.length - 1);
    const y = 144 - (Math.min(item.completionRate, 100) / 100) * 112;
    return { ...item, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x} 156 L${points[0].x} 156 Z`;
  const latest = points[points.length - 1];
  const labelStep = Math.max(1, Math.ceil(points.length / 7));

  return (
    <svg viewBox="0 0 360 180" className="h-44 w-full overflow-visible">
      <defs>
        <linearGradient id="readingTrendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="18" x2="342" y1={34 + i * 34} y2={34 + i * 34} stroke="#edf0f6" strokeWidth="1" />
      ))}
      <path d={areaPath} fill="url(#readingTrendFill)" />
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point) => (
        <circle key={point.date} cx={point.x} cy={point.y} r="4" fill={point.records > 0 ? '#6366f1' : '#cbd5e1'} />
      ))}
      {points.map((point, index) => (
        <text key={point.date} x={point.x} y="178" textAnchor="middle" className="fill-slate-400 text-[10px]">
          {index % labelStep === 0 ? point.date.slice(5) : ''}
        </text>
      ))}
      <rect x={Math.max(0, latest.x - 28)} y={Math.max(10, latest.y - 26)} width="56" height="20" rx="10" fill="#eef2ff" />
      <text x={Math.max(28, latest.x)} y={Math.max(24, latest.y - 12)} textAnchor="middle" className="fill-indigo-600 text-[10px] font-semibold">
        {latest.records}次
      </text>
    </svg>
  );
}

function ReadingMinutesBars({ data }: { data: ReadingDailyTrendPoint[] }) {
  const chartData = data.length > 0 ? data : [{ date: '--', records: 0, minutes: 0, pages: 0, completionRate: 0 }];
  const maxMinutes = Math.max(...chartData.map(item => item.minutes), 1);
  const labelStep = Math.max(1, Math.ceil(chartData.length / 7));

  return (
    <div className="mt-5 flex h-44 items-end justify-between gap-2">
      {chartData.map((item, index) => (
        <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-indigo-300"
            style={{ height: `${Math.max(4, (item.minutes / maxMinutes) * 100)}%`, opacity: item.minutes > 0 ? 1 : 0.25 }}
            title={`${item.date} · ${item.minutes}分钟`}
          />
          <span className="text-[10px] text-muted-foreground">{index % labelStep === 0 ? item.date.slice(5) : ''}</span>
        </div>
      ))}
    </div>
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

function TimeDistribution({ items = fallbackTimeItems, total = '125', label = '分钟' }: { items?: Array<[string, string, string, string]>; total?: string; label?: string }) {
  return (
    <div className="flex items-center gap-5">
      <DonutChart value={total} label={label} colors={['#6366f1', '#22c55e', '#f59e0b', '#a855f7']} />
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

function ReadingRadarChart({ items }: { items: ReadingRadarItem[] }) {
  const chartItems = items.length > 0 ? items : [
    { label: '持续度', value: 0, note: '' },
    { label: '阅读投入', value: 0, note: '' },
    { label: '类型广度', value: 0, note: '' },
    { label: '进度记录', value: 0, note: '' },
    { label: '复盘质量', value: 0, note: '' },
  ];
  const center = { x: 120, y: 110 };
  const maxRadius = 86;
  const axisPoints = chartItems.map((_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / chartItems.length;
    return {
      x: center.x + Math.cos(angle) * maxRadius,
      y: center.y + Math.sin(angle) * maxRadius,
      angle,
    };
  });
  const valuePoints = chartItems.map((item, index) => {
    const radius = (Math.min(item.value, 100) / 100) * maxRadius;
    return {
      x: center.x + Math.cos(axisPoints[index].angle) * radius,
      y: center.y + Math.sin(axisPoints[index].angle) * radius,
    };
  });

  return (
    <div>
      <svg viewBox="0 0 240 220" className="mx-auto h-56 w-full max-w-xs">
        <defs>
          <linearGradient id="readingRadarFill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        {[0.35, 0.65, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={axisPoints.map(point => `${center.x + Math.cos(point.angle) * maxRadius * ratio},${center.y + Math.sin(point.angle) * maxRadius * ratio}`).join(' ')}
            fill="none"
            stroke="#e5e7eb"
          />
        ))}
        {axisPoints.map((point) => (
          <line key={`${point.x}-${point.y}`} x1={center.x} y1={center.y} x2={point.x} y2={point.y} stroke="#e5e7eb" />
        ))}
        <polygon points={valuePoints.map(point => `${point.x},${point.y}`).join(' ')} fill="url(#readingRadarFill)" stroke="#6366f1" strokeWidth="3" />
        {chartItems.map((item, index) => {
          const point = axisPoints[index];
          const labelX = center.x + Math.cos(point.angle) * (maxRadius + 20);
          const labelY = center.y + Math.sin(point.angle) * (maxRadius + 20);
          return <text key={item.label} x={labelX} y={labelY} textAnchor="middle" className="fill-slate-500 text-[10px]">{item.label}</text>;
        })}
      </svg>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        {chartItems.map(item => (
          <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-900">{item.label} {item.value}</span>
          </div>
        ))}
      </div>
    </div>
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

function MiniBarRows({ rows }: { rows: Array<[string, number, string]> }) {
  return (
    <div className="space-y-3">
      {rows.map(([label, value, color]) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-600">{label}</span>
            <span className="font-medium text-slate-950">{value}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100">
            <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
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
  libraryBookCount?: number;
  totalMinutes?: number;
  totalPages?: number;
  finishedInRange?: number;
  dailyTrend?: ReadingDailyTrendPoint[];
  categoryDistribution?: ReadingCategoryItem[];
  topBooks?: ReadingTopBook[];
  radar?: ReadingRadarItem[];
  rules?: {
    dailyTrend: string;
    dailyMinutes: string;
    categoryDistribution: string;
    topBooks: string;
    radar: string;
  };
};

type ReadingCategoryItem = {
  label: string;
  records: number;
  minutes: number;
  pages: number;
  percentage: number;
};

type ReadingTopBook = {
  id: number;
  name: string;
  records: number;
  minutes: number;
  pages: number;
  coverUrl: string;
  scoreLabel: string;
};

type ReadingRadarItem = {
  label: string;
  value: number;
  note: string;
};

type DateRange = { startDate: string; endDate: string };
type DashboardTask = {
  id: number;
  name: string;
  category?: string;
  tags?: Record<string, unknown> | string | null;
};
type DashboardCheckin = {
  id: number;
  taskId: number;
  status?: string;
  focusMinutes?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  date: string;
};
type ReadinessDiagnosticSummary = {
  readinessRisk: 'stable' | 'watch' | 'risk';
  readinessLabel: string;
  readinessDescription: string;
  completionRate: number;
  velocity4w: number;
  stabilityVolatility: number;
  capacityIndex: number;
  sampleCount: number;
  topRisk: string;
  nextAction: string;
  evidence: string[];
};
type SubjectSummary = {
  key: string;
  label: string;
  score: number;
  samples: number;
  completionRate: number;
  negativeRate: number;
  cognitiveRate: number;
  qualityRate: number;
};
type MoodSummary = {
  interestScore: number;
  initiativeScore: number;
  focusScore: number;
  motivationScore: number;
  moodLabel: string;
  preferenceRows: Array<[string, number, string]>;
  topTags: string[];
  focusRows: Array<[string, number, string]>;
  mindsetNotes: string[];
  suggestions: Array<{ title: string; desc: string; icon: React.ElementType; bg: string; color: string }>;
};
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

function getDateWindow(endDate: string, days: number) {
  const [year, month, day] = endDate.split('-').map(Number);
  const end = new Date(year, month - 1, day);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (days - 1 - index));
    return formatLocalDate(date);
  });
}

function hasDashboardValue(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 && value.trim() !== '__none__' : value !== null && value !== undefined;
}

function normalizeDashboardTags(tags: DashboardTask['tags']): Record<string, unknown> {
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

function getDashboardText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getTaskSubjectKey(task: DashboardTask): string {
  const tags = normalizeDashboardTags(task.tags);
  const text = [
    task.name,
    task.category,
    getDashboardText(tags.subject),
    getDashboardText(tags.abilityPoint),
    getDashboardText(tags.abilityCategory),
  ].join(' ');
  if (/english|英语|英文|RAZ|自然拼读/i.test(text)) return 'english';
  if (/math|数学|数理|口算|计算|逻辑|几何/i.test(text)) return 'math';
  if (/science|科学|物理|化学|生物|实验/i.test(text)) return 'science';
  if (/chinese|语文|中文|大语文|阅读理解|古文|写作|表达/i.test(text)) return 'chinese';
  return 'general';
}

function buildSubjectSummaries(tasks: DashboardTask[] = [], checkins: DashboardCheckin[] = []): SubjectSummary[] {
  const completedStatuses = new Set(['completed', 'partial']);
  const negativeStatuses = new Set(['not_completed', 'postponed']);
  const subjectConfig = [
    { key: 'chinese', label: '语文', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'math', label: '数学', icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'english', label: '英语', icon: ListChecks, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'science', label: '科学', icon: BarChart3, color: 'text-orange-500', bg: 'bg-orange-50' },
    { key: 'general', label: '综合素养', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];
  const subjectByTask = new Map<number, string>();
  tasks.forEach((task) => subjectByTask.set(task.id, getTaskSubjectKey(task)));
  const actionableRows = checkins.filter((checkin) => checkin.status !== 'pending' && checkin.status !== 'not_involved');

  return subjectConfig.map((subject) => {
    const rows = actionableRows.filter((checkin) => subjectByTask.get(Number(checkin.taskId)) === subject.key);
    const completedRows = rows.filter((checkin) => completedStatuses.has(checkin.status || ''));
    const negativeRows = rows.filter((checkin) => negativeStatuses.has(checkin.status || ''));
    const cognitiveRows = rows.filter((checkin) => {
      const metadata = checkin.metadata || {};
      return hasDashboardValue(metadata.attemptCount) || hasDashboardValue(metadata.cognitiveError) || hasDashboardValue(metadata.reviewQuality);
    });
    const qualityRows = rows.filter((checkin) => hasDashboardValue(checkin.metadata?.quality) || hasDashboardValue(checkin.notes));
    const completionRate = rows.length ? Math.round((completedRows.length / rows.length) * 100) : 0;
    const negativeRate = rows.length ? Math.round((negativeRows.length / rows.length) * 100) : 0;
    const cognitiveRate = rows.length ? Math.round((cognitiveRows.length / rows.length) * 100) : 0;
    const qualityRate = rows.length ? Math.round((qualityRows.length / rows.length) * 100) : 0;
    const score = rows.length
      ? Math.max(0, Math.min(100, Math.round(completionRate * 0.65 + qualityRate * 0.2 + cognitiveRate * 0.15 - negativeRate * 0.25)))
      : 0;
    return {
      key: subject.key,
      label: subject.label,
      score,
      samples: rows.length,
      completionRate,
      negativeRate,
      cognitiveRate,
      qualityRate,
    };
  });
}

function buildMoodSummary(tasks: DashboardTask[] = [], checkins: DashboardCheckin[] = [], diagnosticSummary?: ReadinessDiagnosticSummary): MoodSummary {
  const completedStatuses = new Set(['completed', 'partial']);
  const actionableRows = checkins.filter((checkin) => checkin.status !== 'pending' && checkin.status !== 'not_involved');
  const completedRows = actionableRows.filter((checkin) => completedStatuses.has(checkin.status || ''));
  const completionRate = actionableRows.length ? Math.round((completedRows.length / actionableRows.length) * 100) : 0;
  const metadataRows = actionableRows.map((checkin) => checkin.metadata || {});
  const moodRows = metadataRows.filter((metadata) => hasDashboardValue(metadata.mood));
  const stableMoodRows = moodRows.filter((metadata) => ['stable', 'happy', 'good', 'calm'].includes(String(metadata.mood)));
  const lowMoodRows = moodRows.filter((metadata) => ['tired', 'anxious', 'frustrated', 'low'].includes(String(metadata.mood)));
  const sleepValues = metadataRows.map((metadata) => Number(metadata.sleepHours)).filter((value) => Number.isFinite(value) && value > 0);
  const averageSleep = sleepValues.length ? sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length : 0;
  const loadRows = metadataRows.filter((metadata) => hasDashboardValue(metadata.externalLoad) && metadata.externalLoad !== 'none');
  const focusValues = actionableRows.map((checkin) => Number(checkin.focusMinutes)).filter((value) => Number.isFinite(value) && value > 0);
  const averageFocus = focusValues.length ? focusValues.reduce((sum, value) => sum + value, 0) / focusValues.length : 0;
  const taskCategoryCounts = tasks.reduce<Record<string, number>>((acc, task) => {
    const label = task.category || '未分类';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const taskTotal = Object.values(taskCategoryCounts).reduce((sum, value) => sum + value, 0);
  const palette = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-400', 'bg-rose-500', 'bg-purple-500'];
  const preferenceRows = Object.entries(taskCategoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count], index) => [label, taskTotal ? Math.round((count / taskTotal) * 100) : 0, palette[index % palette.length]] as [string, number, string]);
  const topTags = preferenceRows.map(([label]) => label);
  const moodStability = moodRows.length ? Math.round((stableMoodRows.length / moodRows.length) * 100) : 0;
  const sleepScore = sleepValues.length ? Math.max(0, Math.min(100, Math.round((averageSleep / 8) * 100))) : 0;
  const loadScore = actionableRows.length ? Math.max(0, 100 - Math.round((loadRows.length / actionableRows.length) * 100)) : 0;
  const focusScore = averageFocus > 0 ? Math.max(0, Math.min(100, Math.round((averageFocus / 35) * 100))) : Math.round((completionRate + loadScore) / 2);
  const interestScore = Math.round(completionRate * 0.45 + moodStability * 0.25 + Math.min(topTags.length * 12, 30));
  const initiativeScore = Math.round(completionRate * 0.65 + (diagnosticSummary?.capacityIndex || 0) * 0.35);
  const motivationScore = Math.round(moodStability * 0.35 + sleepScore * 0.25 + loadScore * 0.2 + (diagnosticSummary?.capacityIndex || 0) * 0.2);
  const moodLabel = moodRows.length === 0
    ? '未记录'
    : lowMoodRows.length > stableMoodRows.length
      ? '需关注'
      : '平稳';
  const focusRows = [
    ['情绪稳定', moodStability, 'bg-indigo-500'],
    ['睡眠恢复', sleepScore, 'bg-blue-500'],
    ['负载控制', loadScore, 'bg-emerald-500'],
    ['专注表现', focusScore, 'bg-amber-400'],
  ] as Array<[string, number, string]>;
  const mindsetNotes = [
    moodRows.length > 0 ? `情绪记录 ${moodRows.length} 条，稳定占比 ${moodStability}%。` : '情绪记录不足，建议在打卡时补充。',
    sleepValues.length > 0 ? `平均睡眠 ${averageSleep.toFixed(1)} 小时。` : '睡眠记录不足，稳定性判断置信度有限。',
    loadRows.length > 0 ? `外部负载 ${loadRows.length} 条，需要观察是否影响完成节奏。` : '外部负载记录较少，当前未形成明显压力信号。',
    topTags.length > 0 ? `任务偏好集中在 ${topTags.slice(0, 2).join('、')}。` : '任务分类样本不足，暂不判断兴趣偏好。',
  ];
  const suggestions = [
    {
      title: loadRows.length >= 3 ? '先降负载' : '保持兴趣入口',
      desc: loadRows.length >= 3
        ? '近期外部负载偏多，建议减少非关键任务，保留一个孩子更愿意开始的任务。'
        : topTags.length > 0 ? `可以用 ${topTags[0]} 作为启动任务，再进入短板任务。` : '先补充任务分类和打卡观察，再判断兴趣入口。',
      icon: Lightbulb,
      bg: 'bg-amber-50',
      color: 'text-amber-500',
    },
    {
      title: moodRows.length === 0 ? '补情绪记录' : '补稳定性证据',
      desc: moodRows.length === 0
        ? '完成任务时顺手记录情绪，后续才能区分不会做和不想做。'
        : '继续记录睡眠、外部负载和专注分钟，提升心态判断可靠性。',
      icon: HeartPulse,
      bg: 'bg-blue-50',
      color: 'text-blue-500',
    },
  ];

  return {
    interestScore: Math.max(0, Math.min(100, interestScore)),
    initiativeScore: Math.max(0, Math.min(100, initiativeScore)),
    focusScore: Math.max(0, Math.min(100, focusScore)),
    motivationScore: Math.max(0, Math.min(100, motivationScore)),
    moodLabel,
    preferenceRows,
    topTags,
    focusRows,
    mindsetNotes,
    suggestions,
  };
}

async function fetchDashboardTasks(childId?: number): Promise<DashboardTask[]> {
  if (!childId) return [];
  const response = await apiClient.get('/tasks', { params: { childId } });
  return response.data.data || [];
}

async function fetchDashboardRecentCheckins(childId?: number, endDate?: string): Promise<DashboardCheckin[]> {
  if (!childId || !endDate) return [];
  const dates = getDateWindow(endDate, 56);
  const batches = await Promise.all(
    dates.map(async (date) => {
      const response = await apiClient.get('/dashboard/today-checkins', { params: { childId, date } });
      return (response.data.data || []).map((checkin: Omit<DashboardCheckin, 'date'>) => ({ ...checkin, date }));
    })
  );
  return batches.flat();
}

function buildReadinessDiagnosticSummary(tasks: DashboardTask[] = [], checkins: DashboardCheckin[] = [], endDate: string): ReadinessDiagnosticSummary {
  const completedStatuses = new Set(['completed', 'partial']);
  const negativeStatuses = new Set(['not_completed', 'postponed']);
  const recent28Start = getDateWindow(endDate, 28)[0];
  const weekStarts = getDateWindow(endDate, 56).filter((_, index) => index % 7 === 0);
  const actionableAll = checkins.filter((checkin) => checkin.status !== 'pending' && checkin.status !== 'not_involved');
  const recentRows = actionableAll.filter((checkin) => checkin.date >= recent28Start);
  const previousRows = actionableAll.filter((checkin) => checkin.date < recent28Start);
  const completedRecent = recentRows.filter((checkin) => completedStatuses.has(checkin.status || ''));
  const completedPrevious = previousRows.filter((checkin) => completedStatuses.has(checkin.status || ''));
  const negativeRecent = recentRows.filter((checkin) => negativeStatuses.has(checkin.status || ''));
  const completionRate = recentRows.length ? Math.round((completedRecent.length / recentRows.length) * 100) : 0;
  const previousCompletionRate = previousRows.length ? Math.round((completedPrevious.length / previousRows.length) * 100) : 0;
  const velocity4w = completionRate - previousCompletionRate;
  const negativeRate = recentRows.length ? Math.round((negativeRecent.length / recentRows.length) * 100) : 0;
  const metadataRows = recentRows.map((checkin) => checkin.metadata || {});
  const lowSleepRows = metadataRows.filter((metadata) => Number(metadata.sleepHours) > 0 && Number(metadata.sleepHours) < 7);
  const externalLoadRows = metadataRows.filter((metadata) => hasDashboardValue(metadata.externalLoad) && metadata.externalLoad !== 'none');
  const qualityRows = recentRows.filter((checkin) => hasDashboardValue(checkin.metadata?.quality) || hasDashboardValue(checkin.notes));
  const weeklyNegativeRates = weekStarts.map((start, index) => {
    const end = weekStarts[index + 1] || '9999-12-31';
    const rows = actionableAll.filter((checkin) => checkin.date >= start && checkin.date < end);
    return rows.length ? rows.filter((checkin) => negativeStatuses.has(checkin.status || '')).length / rows.length : 0;
  });
  const weeklyAverage = weeklyNegativeRates.length ? weeklyNegativeRates.reduce((sum, value) => sum + value, 0) / weeklyNegativeRates.length : 0;
  const stabilityVolatility = weeklyNegativeRates.length
    ? Math.round(Math.sqrt(weeklyNegativeRates.reduce((sum, value) => sum + Math.pow(value - weeklyAverage, 2), 0) / weeklyNegativeRates.length) * 100)
    : 0;
  const overloadSignals = lowSleepRows.length + externalLoadRows.length;
  const evidenceCoverage = completedRecent.length ? Math.round((qualityRows.length / completedRecent.length) * 100) : 0;
  const capacityIndex = Math.max(0, Math.min(100, Math.round(
    70 + velocity4w * 0.35 - negativeRate * 0.35 - stabilityVolatility * 0.25 - overloadSignals * 2 + Math.min(evidenceCoverage, 60) * 0.15
  )));
  const readinessRisk = capacityIndex < 45 || negativeRate >= 35 || velocity4w <= -25
    ? 'risk'
    : capacityIndex < 70 || negativeRate >= 20 || velocity4w <= -10
      ? 'watch'
      : 'stable';
  const topRisk = readinessRisk === 'risk'
    ? '先减压并修复执行节奏'
    : readinessRisk === 'watch'
      ? '维持核心任务，补齐质量证据'
      : '保持节奏，小幅补短板';

  return {
    readinessRisk,
    readinessLabel: readinessRisk === 'risk' ? '风险' : readinessRisk === 'watch' ? '关注' : '稳定',
    readinessDescription: readinessRisk === 'risk'
      ? '三层准备度出现明显压力信号，建议先恢复完成节奏和稳定性。'
      : readinessRisk === 'watch'
        ? '准备度整体可用，但仍有执行、证据或稳定性缺口。'
        : '近期完成趋势和余力指数较稳，可以维持当前节奏。',
    completionRate,
    velocity4w,
    stabilityVolatility,
    capacityIndex,
    sampleCount: actionableAll.length,
    topRisk,
    nextAction: tasks.length === 0
      ? '先补任务配置'
      : readinessRisk === 'risk'
        ? '减少非关键任务'
        : readinessRisk === 'watch'
          ? '补质量评价和观察'
          : '安排一个短板任务',
    evidence: [
      `近 8 周有效打卡 ${actionableAll.length} 条。`,
      `最近 4 周完成率 ${completionRate}%，4 周 Velocity ${velocity4w >= 0 ? '+' : ''}${velocity4w}%。`,
      `负向状态 ${negativeRate}%，稳定性波动 ${stabilityVolatility}%，余力指数 ${capacityIndex}/100。`,
    ],
  };
}

function ReadinessSummaryPanel({ summary }: { summary?: ReadinessDiagnosticSummary }) {
  const navigate = useNavigate();
  const riskTone = summary?.readinessRisk === 'risk'
    ? 'border-red-100 bg-red-50 text-red-700'
    : summary?.readinessRisk === 'watch'
      ? 'border-amber-100 bg-amber-50 text-amber-700'
      : 'border-emerald-100 bg-emerald-50 text-emerald-700';

  return (
    <DashboardCard>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', riskTone)}>
              {summary?.readinessRisk === 'risk' ? <AlertTriangle className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">三层准备度诊断</h2>
              <p className="mt-1 text-xs text-muted-foreground">{summary?.readinessDescription || '正在汇总近 8 周数据。'}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {(summary?.evidence || ['等待数据加载', '暂无诊断证据', '请稍后刷新']).map((item) => (
              <div key={item} className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-w-[280px] gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <div className={cn('rounded-lg border px-3 py-2', riskTone)}>
            <p className="text-xs opacity-80">状态</p>
            <p className="mt-1 text-lg font-semibold">{summary?.readinessLabel || '--'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">余力指数</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{summary?.capacityIndex ?? '--'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">下一步</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">{summary?.nextAction || '--'}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">{summary?.topRisk || '诊断会随任务、打卡和稳定性记录自动更新。'}</p>
        <Button variant="outline" className="h-9 rounded-lg bg-white" onClick={() => navigate('/parent/data-quality')}>
          查看完整诊断
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </DashboardCard>
  );
}

function GoalReadinessSignalPanel({
  tasks,
  checkins,
  readingStats,
  diagnosticSummary,
  compact = false,
}: {
  tasks: DashboardTask[];
  checkins: DashboardCheckin[];
  readingStats?: ReadingStats;
  diagnosticSummary?: ReadinessDiagnosticSummary;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const subjectSummaries = buildSubjectSummaries(tasks, checkins);
  const coveredSubjects = subjectSummaries.filter((item) => item.samples > 0);
  const cognitiveRecords = checkins.filter((checkin) => {
    const metadata = checkin.metadata || {};
    return hasDashboardValue(metadata.attemptCount) || hasDashboardValue(metadata.cognitiveError) || hasDashboardValue(metadata.reviewQuality);
  });
  const stabilityRecords = checkins.filter((checkin) => {
    const metadata = checkin.metadata || {};
    return hasDashboardValue(metadata.sleepHours) || hasDashboardValue(metadata.mood) || hasDashboardValue(metadata.externalLoad);
  });
  const readingCount = readingStats?.rangeReadCount || 0;
  const evidenceRows: Array<[string, number, string]> = [
    ['任务样本', Math.min(100, Math.round((checkins.length / 40) * 100)), 'bg-indigo-500'],
    ['学科覆盖', Math.min(100, Math.round((coveredSubjects.length / 5) * 100)), 'bg-emerald-500'],
    ['认知证据', Math.min(100, Math.round((cognitiveRecords.length / 12) * 100)), 'bg-blue-500'],
    ['稳定性证据', Math.min(100, Math.round((stabilityRecords.length / 12) * 100)), 'bg-amber-400'],
    ['阅读证据', Math.min(100, Math.round((readingCount / 10) * 100)), 'bg-rose-500'],
  ];
  const weakestSignals = evidenceRows
    .filter(([, value]) => value < 60)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([label]) => label);

  return (
    <DashboardCard className={compact ? 'p-4' : undefined}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">目标准备信号</h2>
          <p className="mt-1 text-xs text-muted-foreground">只看准备证据是否够，不在这里给学校适配分。</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/parent/goals')} className="h-9 rounded-lg bg-white">
          去目标管理
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-4">
        {compact ? <MiniBarRows rows={evidenceRows} /> : <BarRows rows={evidenceRows} />}
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        {weakestSignals.length > 0
          ? `当前主要缺口：${weakestSignals.join('、')}。目标管理里需要先配置目标方向，再把这些证据补齐。`
          : `准备证据覆盖较完整。${diagnosticSummary?.nextAction || '下一步可在目标管理里配置具体目标方向。'}`}
      </div>
    </DashboardCard>
  );
}

function TodayView({
  stats,
  readingStats,
  range,
  diagnosticSummary,
  tasks,
  checkins,
}: {
  stats?: DashboardStats;
  readingStats?: ReadingStats;
  range: DateRange;
  diagnosticSummary?: ReadinessDiagnosticSummary;
  tasks: DashboardTask[];
  checkins: DashboardCheckin[];
}) {
  const navigate = useNavigate();
  const rangePlannedTasks = stats?.plannedTasks ?? 0;
  const rangeCompletedTasks = stats?.completedTasks ?? 0;
  const rangeCompletionRate = rangePlannedTasks > 0
    ? Math.round((rangeCompletedTasks / rangePlannedTasks) * 100)
    : 0;
  const actionableCheckins = checkins.filter((checkin) => checkin.status !== 'pending' && checkin.status !== 'not_involved');
  const qualityEvidenceCount = actionableCheckins.filter((checkin) => hasDashboardValue(checkin.metadata?.quality) || hasDashboardValue(checkin.notes)).length;
  const cognitiveEvidenceCount = actionableCheckins.filter((checkin) => {
    const metadata = checkin.metadata || {};
    return hasDashboardValue(metadata.attemptCount) || hasDashboardValue(metadata.cognitiveError) || hasDashboardValue(metadata.reviewQuality);
  }).length;
  const stabilityEvidenceCount = actionableCheckins.filter((checkin) => {
    const metadata = checkin.metadata || {};
    return hasDashboardValue(metadata.sleepHours) || hasDashboardValue(metadata.mood) || hasDashboardValue(metadata.externalLoad);
  }).length;
  const evidenceCoverage = actionableCheckins.length > 0
    ? Math.round(((qualityEvidenceCount + cognitiveEvidenceCount + stabilityEvidenceCount) / (actionableCheckins.length * 3)) * 100)
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
    { label: '准备度余力', value: String(diagnosticSummary?.capacityIndex ?? '--'), suffix: diagnosticSummary ? '分' : '', note: diagnosticSummary?.readinessLabel || '近 8 周诊断', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '任务完成率', value: String(rangeCompletionRate), suffix: '%', note: `${rangeCompletedTasks}/${rangePlannedTasks} 个任务`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '证据完整度', value: String(evidenceCoverage), suffix: '%', note: `${actionableCheckins.length} 条有效记录`, icon: Brain, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '阅读投入', value: String(readingStats?.rangeReadCount ?? stats?.todayReadingCount ?? 0), suffix: '次', note: `${readingPerformance?.minutes || 0} 分钟 · ${readingPerformance?.pages || 0} 页`, icon: BookOpen, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];
  const readinessRows: Array<[string, number, string]> = [
    ['任务交付', rangeCompletionRate, 'bg-emerald-500'],
    ['准备余力', diagnosticSummary?.capacityIndex ?? 0, 'bg-indigo-500'],
    ['稳定控制', Math.max(0, 100 - (diagnosticSummary?.stabilityVolatility || 0)), 'bg-blue-500'],
    ['记录完整', evidenceCoverage, 'bg-amber-400'],
  ];
  const evidenceRows: Array<[string, number, string]> = [
    ['质量/观察', actionableCheckins.length ? Math.round((qualityEvidenceCount / actionableCheckins.length) * 100) : 0, 'bg-emerald-500'],
    ['认知记录', actionableCheckins.length ? Math.round((cognitiveEvidenceCount / actionableCheckins.length) * 100) : 0, 'bg-blue-500'],
    ['稳定性记录', actionableCheckins.length ? Math.round((stabilityEvidenceCount / actionableCheckins.length) * 100) : 0, 'bg-amber-400'],
  ];
  const riskTone = diagnosticSummary?.readinessRisk === 'risk'
    ? 'bg-rose-50 text-rose-700'
    : diagnosticSummary?.readinessRisk === 'watch'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-emerald-50 text-emerald-700';
  const primaryConclusion = diagnosticSummary?.readinessRisk === 'risk'
    ? '近期成长状态有明显压力信号，先恢复稳定完成节奏。'
    : diagnosticSummary?.readinessRisk === 'watch'
      ? '整体可继续推进，但需要补齐质量、认知或稳定性证据。'
      : '近期节奏稳定，可以维持当前计划并小幅补短板。';
  const longTermSignals = [
    {
      title: '任务节奏',
      desc: rangePlannedTasks > 0
        ? `当前范围完成 ${rangeCompletedTasks}/${rangePlannedTasks} 个任务，完成率 ${rangeCompletionRate}%。`
        : '当前范围暂无计划任务样本。',
      tone: rangeCompletionRate >= 80 ? 'text-emerald-700 bg-emerald-50' : rangeCompletionRate >= 50 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50',
    },
    {
      title: '稳定性',
      desc: diagnosticSummary
        ? `波动 ${diagnosticSummary.stabilityVolatility}%，余力指数 ${diagnosticSummary.capacityIndex}/100。`
        : '稳定性诊断正在等待样本。',
      tone: (diagnosticSummary?.readinessRisk === 'stable') ? 'text-emerald-700 bg-emerald-50' : (diagnosticSummary?.readinessRisk === 'watch') ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50',
    },
    {
      title: '阅读投入',
      desc: `阅读 ${readingStats?.rangeReadCount ?? stats?.todayReadingCount ?? 0} 次，${readingPerformance?.minutes || 0} 分钟，${readingPerformance?.pages || 0} 页。`,
      tone: (readingStats?.rangeReadCount || 0) > 0 ? 'text-blue-700 bg-blue-50' : 'text-slate-600 bg-slate-50',
    },
    {
      title: '证据质量',
      desc: `完整度 ${evidenceCoverage}%，质量/认知/稳定性记录决定后续判断可信度。`,
      tone: evidenceCoverage >= 60 ? 'text-emerald-700 bg-emerald-50' : evidenceCoverage >= 30 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50',
    },
  ];

  return (
    <>
      <DashboardCard className="p-0">
        <div className="grid overflow-hidden rounded-lg lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">成长状态总览</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {range.startDate} 至 {range.endDate} · 只看长期状态、趋势和证据质量。
                </p>
              </div>
              <span className={cn('rounded-lg px-3 py-1 text-sm font-semibold', riskTone)}>
                {diagnosticSummary?.readinessLabel || '诊断中'}
              </span>
            </div>
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-800">
              {primaryConclusion}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {longTermSignals.map((item) => (
                <div key={item.title} className={cn('min-h-24 rounded-lg p-3', item.tone)}>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 opacity-90">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-slate-950">家长下一步</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {diagnosticSummary?.topRisk || '等待足够样本后会形成长期关注建议。'}
            </p>
            <div className={cn('mt-4 rounded-lg p-3 text-sm font-medium', riskTone)}>
              {diagnosticSummary?.nextAction || '先补任务和打卡记录'}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => navigate('/parent/reports')} className="h-9 rounded-lg bg-white">
                学习报告
              </Button>
              <Button variant="outline" onClick={() => navigate('/parent/goals')} className="h-9 rounded-lg bg-white">
                目标管理
              </Button>
            </div>
          </div>
        </div>
      </DashboardCard>

      <MetricGrid metrics={metricCards} />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_0.95fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">三层准备度结构</h2>
          <p className="mt-1 text-xs text-muted-foreground">用于判断能不能继续加量，不解释完整能力模型。</p>
          <div className="mt-5">
            <BarRows rows={readinessRows} />
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-950">完成率趋势</h2>
            <span className="rounded-lg bg-slate-50 px-3 py-1 text-xs text-slate-600">当前范围</span>
          </div>
          <CompletionTrendChart data={stats?.completionTrend || []} />
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">任务状态结构</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[132px_1fr] md:items-center xl:block">
            <div className="scale-90">
              <DonutChart value={`${rangeCompletionRate}%`} label="完成率" colors={['#22c55e', '#f59e0b', '#ef4444', '#f97316']} />
            </div>
            <div className="space-y-3 text-sm xl:mt-3">
              {statusRows.map(([label, count, rate, dot]) => (
                <div key={String(label)} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600"><i className={cn('h-2.5 w-2.5 rounded-full', dot)} />{label}</span>
                  <span className="text-xs text-muted-foreground">{count}个 ({rate}%)</span>
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">阅读趋势</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <ReadingTrendChart data={readingStats?.dailyTrend || []} />
              <p className="mt-2 text-xs text-muted-foreground">阅读记录趋势</p>
            </div>
            <div>
              <ReadingMinutesBars data={readingStats?.dailyTrend || []} />
              <p className="mt-2 text-xs text-muted-foreground">阅读时长趋势</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">任务时长分布</h2>
          <p className="mt-1 text-xs text-muted-foreground">按任务分类估算，仅用于观察时间投入结构。</p>
          <div className="mt-4">
            <TimeDistribution items={timeDistribution} total={String(stats?.todayStudyMinutes || 0)} />
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DashboardCard className="p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">需要长期关注的问题</h2>
              <p className="mt-1 text-xs text-muted-foreground">只列风险最高的任务，避免把今日待办搬过来。</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              {focusTasks.length} 项
            </span>
          </div>
          <div className="space-y-2">
            {focusTasks.length > 0 ? focusTasks.slice(0, 3).map((task) => {
              const riskLabel = task.riskScore >= 5 ? '高风险' : task.riskScore >= 3 ? '中风险' : '需观察';
              const riskClassName = task.riskScore >= 5
                ? 'bg-rose-50 text-rose-600'
                : task.riskScore >= 3
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600';
              return (
                <div key={`${task.planId}-${task.taskId}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-white px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-950">{task.name}</p>
                      <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">{task.category}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      计划 {task.planned} · 完成 {task.completed} · 未完成 {task.notCompleted} · 延期 {task.postponed}
                    </p>
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-xs font-medium', riskClassName)}>
                    {riskLabel}
                  </span>
                </div>
              );
            }) : (
              <div className="rounded-lg border border-dashed border-border bg-slate-50 p-5 text-center text-sm text-muted-foreground">
                {range.startDate} 至 {range.endDate} 暂无需要重点关注的任务
              </div>
            )}
          </div>
        </DashboardCard>

        <GoalReadinessSignalPanel
          tasks={tasks}
          checkins={checkins}
          readingStats={readingStats}
          diagnosticSummary={diagnosticSummary}
          compact
        />
      </div>

    </>
  );
}

function ExecutionView({
  stats,
  range,
  diagnosticSummary,
}: {
  stats?: DashboardStats;
  range: DateRange;
  diagnosticSummary?: ReadinessDiagnosticSummary;
}) {
  const statusCounts = stats?.taskStatusCounts || {
    completed: 0,
    partial: 0,
    notCompleted: 0,
    postponed: 0,
    notInvolved: 0,
  };
  const statusTotal = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
  const completedTotal = statusCounts.completed + statusCounts.partial;
  const completionRate = statusTotal ? Math.round((completedTotal / statusTotal) * 100) : 0;
  const negativeTotal = statusCounts.notCompleted + statusCounts.postponed;
  const negativeControl = statusTotal ? Math.max(0, 100 - Math.round((negativeTotal / statusTotal) * 100)) : 0;
  const postponementControl = statusTotal ? Math.max(0, 100 - Math.round((statusCounts.postponed / statusTotal) * 100)) : 0;
  const stabilityScore = Math.max(0, 100 - (diagnosticSummary?.stabilityVolatility || 0));
  const taskLoad = stats?.plannedTasks ?? statusTotal;
  const completedLoad = stats?.completedTasks ?? completedTotal;
  const loadPressure = taskLoad >= 18 ? '偏高' : taskLoad >= 10 ? '适中' : '偏低';
  const loadRows: Array<[string, number, string]> = [
    ['计划任务', Math.min(100, taskLoad * 5), 'bg-indigo-500'],
    ['完成任务', taskLoad ? Math.round((completedLoad / taskLoad) * 100) : 0, 'bg-emerald-500'],
    ['负向状态', statusTotal ? Math.round((negativeTotal / statusTotal) * 100) : 0, 'bg-rose-500'],
    ['延期占比', statusTotal ? Math.round((statusCounts.postponed / statusTotal) * 100) : 0, 'bg-amber-400'],
  ];
  const executionScore = Math.round((
    completionRate * 0.35 +
    negativeControl * 0.25 +
    postponementControl * 0.15 +
    stabilityScore * 0.15 +
    (diagnosticSummary?.capacityIndex || 0) * 0.10
  ));
  const scoreLabel = executionScore >= 80 ? '稳定' : executionScore >= 60 ? '关注' : '修复';
  const focusTasks = stats?.focusTasks || [];
  const executionSuggestions = [
    {
      title: diagnosticSummary?.readinessRisk === 'risk' ? '先减压' : '保持核心节奏',
      desc: diagnosticSummary?.topRisk || '优先保障核心任务完成，再安排额外加码。',
      icon: Lightbulb,
      bg: 'bg-amber-50',
      color: 'text-amber-500',
    },
    {
      title: negativeTotal > 0 ? '修复负向状态' : '补齐证据',
      desc: negativeTotal > 0
        ? `当前范围有 ${negativeTotal} 次未完成或延期，建议拆小任务颗粒度。`
        : '完成状态较稳，继续补质量评价和家长观察。',
      icon: Clock3,
      bg: 'bg-blue-50',
      color: 'text-blue-500',
    },
  ];
  const metrics: MetricCardItem[] = [
    { label: '执行断点', value: String(executionScore), suffix: '分', note: scoreLabel, icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '完成率', value: String(completionRate), suffix: '%', note: '完成与部分完成', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '负向次数', value: String(negativeTotal), suffix: '次', note: '未完成 + 延期', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50' },
    { label: '任务负荷', value: String(taskLoad), suffix: '项', note: loadPressure, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '稳定性', value: String(stabilityScore), suffix: '%', note: '近 8 周波动', icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50' },
  ];

  return (
    <>
      <PageQuestion
        title="本页回答什么问题"
        desc="孩子最近的执行断点在哪里：是未完成、延期、负载波动，还是需要先降低任务颗粒度。"
        sampleCount={diagnosticSummary?.sampleCount || 0}
      />
      <MetricGrid metrics={metrics} />

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1fr_1.2fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">执行断点评分</h2>
          <div className="mt-5"><ScoreGauge score={String(executionScore)} label={scoreLabel} /></div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {range.startDate} 至 {range.endDate} 的规则评分
          </p>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">任务负荷</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            观察当前范围任务数量、完成承载和负向状态占比。
          </p>
          <div className="mt-5">
            <BarRows rows={loadRows} />
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">断点结构</h2>
          <div className="mt-5">
            <BarRows rows={[
              ['完成率', completionRate, 'bg-indigo-500'],
              ['负向控制', negativeControl, 'bg-emerald-500'],
              ['延期控制', postponementControl, 'bg-blue-500'],
              ['稳定性', stabilityScore, 'bg-amber-400'],
            ]} />
          </div>
        </DashboardCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">延期/未完成集中的任务</h2>
          <p className="mt-1 text-xs text-muted-foreground">只列执行风险最高的任务，用于定位修复入口。</p>
          <div className="mt-4 space-y-3">
            {focusTasks.length > 0 ? focusTasks.map((task) => (
              <div key={`${task.planId}-${task.taskId}`} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{task.name}</p>
                  <p className="text-xs text-muted-foreground">
                    已完成 {task.completed}/{task.planned} · 未完成 {task.notCompleted} · 延期 {task.postponed}
                  </p>
                </div>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                  关注度 {task.riskScore}
                </span>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-border bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                当前范围暂无未完成或延期集中的任务
              </div>
            )}
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">修复建议</h2>
          <div className="mt-4 space-y-4">
            {executionSuggestions.map((item) => {
              const Icon = item.icon;
              return <div key={item.title} className="flex gap-3"><div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', item.bg, item.color)}><Icon className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="text-sm text-muted-foreground">{item.desc}</p></div></div>;
            })}
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

function SubjectView({
  tasks,
  checkins,
  stats,
}: {
  tasks: DashboardTask[];
  checkins: DashboardCheckin[];
  stats?: DashboardStats;
}) {
  const subjectSummaries = buildSubjectSummaries(tasks, checkins);
  const strongestSubject = subjectSummaries.reduce<SubjectSummary | null>((best, item) => {
    if (item.samples === 0) return best;
    if (!best) return item;
    return item.score > best.score ? item : best;
  }, null);
  const weakestSubject = subjectSummaries.reduce<SubjectSummary | null>((worst, item) => {
    if (item.samples === 0) return worst;
    if (!worst) return item;
    return item.score < worst.score ? item : worst;
  }, null);
  const totalSubjectSamples = subjectSummaries.reduce((sum, item) => sum + item.samples, 0);
  const totalQualitySamples = subjectSummaries.reduce((sum, item) => sum + Math.round((item.samples * item.qualityRate) / 100), 0);
  const totalCognitiveSamples = subjectSummaries.reduce((sum, item) => sum + Math.round((item.samples * item.cognitiveRate) / 100), 0);
  const evidenceCoverageRows: Array<[string, number, string]> = [
    ['学科样本', Math.min(100, totalSubjectSamples * 5), 'bg-indigo-500'],
    ['质量记录', totalSubjectSamples ? Math.round((totalQualitySamples / totalSubjectSamples) * 100) : 0, 'bg-emerald-500'],
    ['认知记录', totalSubjectSamples ? Math.round((totalCognitiveSamples / totalSubjectSamples) * 100) : 0, 'bg-blue-500'],
    ['薄弱方向', weakestSubject?.samples ? Math.max(0, 100 - weakestSubject.score) : 0, 'bg-amber-400'],
  ];
  const metricTone: Record<string, Pick<MetricCardItem, 'icon' | 'color' | 'bg'>> = {
    chinese: { icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    math: { icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    english: { icon: ListChecks, color: 'text-blue-600', bg: 'bg-blue-50' },
    science: { icon: BarChart3, color: 'text-orange-500', bg: 'bg-orange-50' },
    general: { icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-50' },
  };
  const metrics: MetricCardItem[] = subjectSummaries.map((subject) => ({
    label: subject.label,
    value: subject.samples > 0 ? String(subject.score) : '--',
    suffix: subject.samples > 0 ? '分' : '',
    note: subject.samples > 0 ? `${subject.samples} 条样本` : '暂无样本',
    ...metricTone[subject.key],
  }));
  const barRows: Array<[string, number, string]> = subjectSummaries.map((subject, index) => [
    subject.label,
    subject.score,
    ['bg-indigo-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-400', 'bg-rose-500'][index],
  ]);
  const evidenceRows = [
    ['完成率', weakestSubject?.completionRate || 0, 'bg-indigo-500'],
    ['质量证据', weakestSubject?.qualityRate || 0, 'bg-emerald-500'],
    ['认知记录', weakestSubject?.cognitiveRate || 0, 'bg-blue-500'],
    ['负向控制', weakestSubject ? Math.max(0, 100 - weakestSubject.negativeRate) : 0, 'bg-amber-400'],
  ] as Array<[string, number, string]>;

  return (
    <>
      <PageQuestion
        title="本页回答什么问题"
        desc="不同学科和能力点有没有足够证据，当前薄弱方向来自完成结果、质量记录还是认知记录。"
        sampleCount={totalSubjectSamples}
      />
      <MetricGrid metrics={metrics} />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr_1.2fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">薄弱方向</h2>
          <div className="mt-5"><ScoreGauge score={String(strongestSubject?.score || 0)} label={strongestSubject?.label || '暂无'} /></div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {weakestSubject ? `优先补 ${weakestSubject.label} 的证据。` : '当前样本最多支持轻量横向比较。'}
          </p>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">学科样本覆盖</h2>
          <div className="mt-5">
            <BarRows rows={barRows} />
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">证据覆盖结构</h2>
          <p className="mt-1 text-xs text-muted-foreground">质量记录和认知记录决定能力判断可信度。</p>
          <div className="mt-5">
            <BarRows rows={evidenceCoverageRows} />
          </div>
        </DashboardCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">薄弱方向证据拆解</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {weakestSubject ? `${weakestSubject.label} 当前分数最低，优先看证据覆盖和负向状态。` : '暂无可用于学科比较的样本。'}
          </p>
          <div className="mt-4">
            <BarRows rows={evidenceRows} />
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">证据结论</h2>
          <div className="mt-5"><DonutChart value={`${strongestSubject?.score || 0}`} label="最高分" /></div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            {totalSubjectSamples === 0
              ? '近 8 周暂无可归类到学科的任务打卡。'
              : weakestSubject && strongestSubject && strongestSubject.score - weakestSubject.score >= 25
                ? `${weakestSubject.label} 明显低于 ${strongestSubject.label}，更像专项问题，先补 ${weakestSubject.label} 的任务质量证据。`
                : '各学科差异不大，若整体分不高，更可能是通用执行或认知方法问题。'}
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

function MoodView({
  tasks,
  checkins,
  diagnosticSummary,
}: {
  tasks: DashboardTask[];
  checkins: DashboardCheckin[];
  diagnosticSummary?: ReadinessDiagnosticSummary;
}) {
  const moodSummary = buildMoodSummary(tasks, checkins, diagnosticSummary);
  const stabilitySampleCount = checkins.filter((checkin) => checkin.status !== 'pending' && checkin.status !== 'not_involved').length;
  const metrics: MetricCardItem[] = [
    { label: '睡眠/情绪', value: moodSummary.moodLabel, note: '来自打卡记录', icon: HeartPulse, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '外部负载', value: String(moodSummary.motivationScore), suffix: '分', note: '负载越低越稳定', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '专注时长', value: String(Math.round(moodSummary.focusScore / 10)), suffix: '/10', note: '专注分钟与完成状态', icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '启动偏好', value: String(moodSummary.interestScore), suffix: '分', note: '任务偏好 + 完成意愿', icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '稳定样本', value: String(stabilitySampleCount), suffix: '条', note: '有效打卡记录', icon: CheckCircle2, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  return (
    <>
      <PageQuestion
        title="本页回答什么问题"
        desc="孩子近期稳定性和兴趣入口是否清楚：睡眠情绪、外部负载、专注时长、启动偏好分别在哪里。"
        sampleCount={stabilitySampleCount}
      />
      <MetricGrid metrics={metrics} />

      <div className="grid gap-5 xl:grid-cols-3">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">启动偏好分布</h2>
          <p className="mt-1 text-xs text-muted-foreground">用于判断先从哪类任务进入，不替代能力判断。</p>
          <div className="mt-4">
            <BarRows rows={moodSummary.preferenceRows.length > 0 ? moodSummary.preferenceRows : [['暂无样本', 0, 'bg-slate-300']]} />
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">启动任务 TOP6</h2>
          <div className="mt-5 flex min-h-40 flex-wrap items-center justify-center gap-3">
            {(moodSummary.topTags.length > 0 ? moodSummary.topTags : ['暂无偏好样本']).map((tag, index) => (
              <span key={tag} className={cn('rounded-full px-4 py-2 text-sm font-medium', ['bg-rose-50 text-rose-600', 'bg-indigo-50 text-indigo-600', 'bg-emerald-50 text-emerald-600', 'bg-amber-50 text-amber-600'][index % 4])}>{tag}</span>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">稳定性拆解</h2>
          <p className="mt-1 text-xs text-muted-foreground">睡眠、情绪、外部负载和专注时长四类证据。</p>
          <div className="mt-4">
            <BarRows rows={moodSummary.focusRows} />
          </div>
        </DashboardCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">稳定性证据</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {moodSummary.mindsetNotes.map((text) => <div key={text} className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-700">{text}</div>)}
          </div>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">减压和启动建议</h2>
          <div className="mt-4 space-y-4">
            {moodSummary.suggestions.map((item) => {
              const Icon = item.icon;
              return <div key={item.title} className="flex gap-3"><div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', item.bg, item.color)}><Icon className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="text-sm text-muted-foreground">{item.desc}</p></div></div>;
            })}
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

const categoryColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-400', 'bg-purple-500', 'bg-rose-500'];

function ReadingView({ stats, readingStats }: { stats?: DashboardStats; readingStats?: ReadingStats }) {
  const dailyTrend = readingStats?.dailyTrend || [];
  const activeReadingDays = dailyTrend.filter((item) => item.records > 0).length;
  const readingContinuity = dailyTrend.length ? Math.round((activeReadingDays / dailyTrend.length) * 100) : 0;
  const recordQualityRows: Array<[string, number, string]> = [
    ['连续性', readingContinuity, 'bg-indigo-500'],
    ['时长记录', readingStats?.totalMinutes ? Math.min(100, Math.round((readingStats.totalMinutes / Math.max(1, activeReadingDays * 20)) * 100)) : 0, 'bg-emerald-500'],
    ['页码记录', readingStats?.totalPages ? Math.min(100, Math.round((readingStats.totalPages / Math.max(1, activeReadingDays * 10)) * 100)) : 0, 'bg-blue-500'],
    ['结构覆盖', Math.min(100, (readingStats?.categoryDistribution || []).length * 20), 'bg-amber-400'],
  ];
  const categoryItems: Array<[string, string, string, string]> = (readingStats?.categoryDistribution || []).map((item, index) => [
    item.label,
    item.minutes > 0 ? `${item.minutes}分钟` : `${item.records}次`,
    `${item.percentage}%`,
    categoryColors[index % categoryColors.length],
  ]);
  const categoryTotal = String(readingStats?.totalMinutes && readingStats.totalMinutes > 0 ? readingStats.totalMinutes : readingStats?.rangeReadCount || 0);
  const categoryLabel = readingStats?.totalMinutes && readingStats.totalMinutes > 0 ? '分钟' : '次';
  const readingMetrics: MetricCardItem[] = [
    { label: '阅读投入', value: String(readingStats?.rangeReadCount ?? stats?.todayReadingCount ?? 0), suffix: '次', note: `${readingStats?.totalMinutes || 0} 分钟`, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '阅读结构', value: String((readingStats?.categoryDistribution || []).length), suffix: '类', note: '按类型分布', icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '连续性', value: String(readingContinuity), suffix: '%', note: `${activeReadingDays}/${dailyTrend.length || 0} 天有记录`, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '记录页数', value: String(readingStats?.totalPages || 0), suffix: '页', note: '所选范围累计', icon: Clock3, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '在读图书', value: String(readingStats?.readingCount || 0), suffix: '本', note: `书库 ${readingStats?.libraryBookCount ?? stats?.booksRead ?? 0} 本`, icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  return (
    <>
      <PageQuestion
        title="本页回答什么问题"
        desc="阅读投入、结构、连续性和记录质量是否稳定；这里不评价完整语文能力。"
        sampleCount={readingStats?.rangeReadCount ?? stats?.todayReadingCount ?? 0}
      />
      <MetricGrid metrics={readingMetrics} />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_0.9fr]">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">阅读连续性</h2>
          <ReadingTrendChart data={dailyTrend} />
          <p className="mt-2 text-xs text-muted-foreground">{readingStats?.rules?.dailyTrend || '每天有阅读记录记为完成。'}</p>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">阅读投入时长</h2>
          <ReadingMinutesBars data={dailyTrend} />
          <p className="mt-2 text-xs text-muted-foreground">{readingStats?.rules?.dailyMinutes || '按阅读记录时长汇总。'}</p>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">记录质量</h2>
          <p className="mt-1 text-xs text-muted-foreground">只看时长、页码、类型和连续记录是否完整。</p>
          <div className="mt-5">
            <BarRows rows={recordQualityRows} />
          </div>
        </DashboardCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">阅读结构</h2>
          <div className="mt-4">
            {categoryItems.length > 0 ? (
              <TimeDistribution items={categoryItems} total={categoryTotal} label={categoryLabel} />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">所选范围暂无阅读记录。</div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">总量单位：{categoryLabel}。{readingStats?.rules?.categoryDistribution}</p>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">投入最高的书</h2>
          <div className="mt-4 space-y-3">
            {(readingStats?.topBooks || []).length > 0 ? (
              readingStats!.topBooks!.map((book, index) => (
                <div key={book.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate"><b className="mr-2 text-primary">{index + 1}</b>{book.name}</span>
                  <span className="shrink-0 text-muted-foreground">{book.scoreLabel}</span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">所选范围暂无阅读记录。</div>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{readingStats?.rules?.topBooks || '优先按阅读时长排序。'}</p>
        </DashboardCard>
        <DashboardCard>
          <h2 className="text-sm font-semibold text-slate-950">阅读成长记录质量</h2>
          <ReadingRadarChart items={readingStats?.radar || []} />
          <p className="mt-2 text-xs text-muted-foreground">{readingStats?.rules?.radar || '由阅读记录实时计算，只表示记录完整度和结构，不输出语文能力结论。'}</p>
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

  const diagnosticEndDate = useMemo(() => formatLocalDate(today), [today]);
  const { data: diagnosticTasks = [] } = useQuery({
    queryKey: ['growth-dashboard-diagnostic-tasks', selectedChildId],
    queryFn: () => fetchDashboardTasks(selectedChildId || undefined),
    enabled: !!selectedChildId,
    staleTime: 2 * 60 * 1000,
  });
  const { data: diagnosticCheckins = [] } = useQuery({
    queryKey: ['growth-dashboard-diagnostic-checkins', selectedChildId, diagnosticEndDate],
    queryFn: () => fetchDashboardRecentCheckins(selectedChildId || undefined, diagnosticEndDate),
    enabled: !!selectedChildId,
    staleTime: 2 * 60 * 1000,
  });
  const diagnosticSummary = useMemo(
    () => buildReadinessDiagnosticSummary(diagnosticTasks, diagnosticCheckins, diagnosticEndDate),
    [diagnosticCheckins, diagnosticEndDate, diagnosticTasks]
  );
  return (
    <div className="mx-auto max-w-[1360px] space-y-5">
      <PageToolbar
        left={
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
        }
        right={
          <div className="flex flex-wrap justify-end gap-2">
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
          </div>
        }
      />

      {activeTab === 'today' && <TodayView stats={stats} readingStats={readingStats} range={activeRange} diagnosticSummary={diagnosticSummary} tasks={diagnosticTasks} checkins={diagnosticCheckins} />}
      {activeTab === 'execution' && <ExecutionView stats={stats} range={activeRange} diagnosticSummary={diagnosticSummary} />}
      {activeTab === 'subject' && <SubjectView tasks={diagnosticTasks} checkins={diagnosticCheckins} stats={stats} />}
      {activeTab === 'mood' && <MoodView tasks={diagnosticTasks} checkins={diagnosticCheckins} diagnosticSummary={diagnosticSummary} />}
      {activeTab === 'reading' && <ReadingView stats={stats} readingStats={readingStats} />}

    </div>
  );
}
