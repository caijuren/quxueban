import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { Clock, CheckCircle2, ClipboardList, BookOpen, Plus, X, Calendar, Send, Brain, Download, Loader2, Camera, Image, Mic, FileText, XCircle, AlertCircle, ArrowRight, LayoutDashboard, HeartPulse, Lightbulb, Play, Square, Pause, RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageToolbar } from '@/components/parent/PageToolbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { DatePicker } from '@/components/ui/date-picker';
import { ExportDialog } from '@/components/ExportDialog';
import { getEducationStageLabel } from '@/lib/education-stage';
import { toast } from 'sonner';
import { startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';

function ProgressRing({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#8b5cf6 ${safeValue * 3.6}deg, #ede9fe 0deg)` }}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-3xl font-semibold text-slate-950">{safeValue}%</span>
        <span className="text-xs text-slate-500">已完成</span>
      </div>
    </div>
  );
}

function StudyIllustration() {
  return (
    <div className="pointer-events-none absolute bottom-4 right-5 hidden h-[120px] w-36 md:block xl:right-6">
      <div className="absolute bottom-4 right-10 h-[72px] w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-400 shadow-xl shadow-violet-200" />
      <div className="absolute bottom-7 right-[52px] h-14 w-[72px] rounded-xl border-4 border-violet-300 bg-white/90 shadow-lg">
        <div className="mx-auto mt-3 h-2 w-12 rounded-full bg-violet-200" />
        <div className="mx-auto mt-2.5 h-2 w-9 rounded-full bg-violet-100" />
        <div className="mx-auto mt-2.5 h-2 w-10 rounded-full bg-violet-100" />
      </div>
      <div className="absolute bottom-4 right-2 h-24 w-4 rotate-12 rounded-full bg-gradient-to-b from-amber-300 to-orange-400 shadow-lg" />
      <div className="absolute bottom-5 right-28 h-12 w-7 rounded-t-full bg-emerald-400" />
      <div className="absolute bottom-2 right-24 h-8 w-12 rounded-xl bg-orange-100 shadow" />
      <div className="absolute right-1 top-7 h-4 w-4 rotate-45 rounded-md bg-amber-300" />
      <div className="absolute right-[136px] top-11 h-3 w-3 rounded-full bg-violet-200" />
    </div>
  );
}

type TrendPoint = {
  date: string;
  label: string;
  minutes: number;
};

function TrendChart({ data }: { data: TrendPoint[] }) {
  const points = data.length > 0 ? data.map((point) => Math.max(0, point.minutes)) : [0, 0, 0, 0, 0, 0, 0];
  const maxValue = Math.max(60, Math.ceil(Math.max(...points) / 30) * 30);
  const chartTop = 28;
  const chartBottom = 156;
  const chartHeight = chartBottom - chartTop;
  const xStart = 48;
  const xGap = 50;
  const path = points
    .map((value, index) => {
      const x = xStart + index * xGap;
      const y = chartBottom - (value / maxValue) * chartHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  const areaEndX = xStart + (points.length - 1) * xGap;
  const ticks = [maxValue, Math.round(maxValue * 0.75), Math.round(maxValue * 0.5), Math.round(maxValue * 0.25), 0];

  return (
    <svg viewBox="0 0 390 190" className="h-56 w-full">
      {ticks.map((tick, index) => {
        const y = chartTop + index * (chartHeight / (ticks.length - 1));
        return (
          <g key={tick}>
            <text x="38" y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{tick}</text>
            <line x1="46" x2="370" y1={y} y2={y} stroke="#e8eaf1" strokeWidth="1" />
          </g>
        );
      })}
      {[0, 30, 60, 90, 120].filter((tick) => tick < maxValue && !ticks.includes(tick)).map((tick) => {
        const y = chartBottom - (tick / maxValue) * chartHeight;
        return <text key={tick} x="38" y={y + 4} textAnchor="end" className="fill-slate-300 text-[10px]">{tick}</text>;
      })}
      <path d={`${path} L ${areaEndX} ${chartBottom} L ${xStart} ${chartBottom} Z`} fill="#8b5cf6" opacity="0.12" />
      <path d={path} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((value, index) => (
        <circle key={index} cx={xStart + index * xGap} cy={chartBottom - (value / maxValue) * chartHeight} r="4" fill="#8b5cf6" />
      ))}
      {data.map((point, index) => (
        <text key={point.date} x={xStart + index * xGap} y="184" textAnchor="middle" className="fill-slate-400 text-[11px]">{point.label}</text>
      ))}
    </svg>
  );
}

const dailyQuotes = [
  { text: '千里之行，始于足下。', author: '老子' },
  { text: '不积跬步，无以至千里。', author: '荀子' },
  { text: '知不足而奋进，望远山而前行。', author: '佚名' },
  { text: '日日行，不怕千万里。', author: '佚名' },
  { text: '学而不思则罔，思而不学则殆。', author: '孔子' },
  { text: '纸上得来终觉浅，绝知此事要躬行。', author: '陆游' },
  { text: '博观而约取，厚积而薄发。', author: '苏轼' },
  { text: '今日事，今日毕。', author: '佚名' },
  { text: '温故而知新，可以为师矣。', author: '孔子' },
  { text: '欲穷千里目，更上一层楼。', author: '王之涣' },
];

function getDailyQuote(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  const index = Math.abs(year * 372 + month * 31 + day) % dailyQuotes.length;
  return dailyQuotes[index];
}

function DailyQuoteCard({ date }: { date: string }) {
  const quote = getDailyQuote(date);
  return (
    <section className="relative min-h-[210px] overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-950 via-indigo-700 to-sky-500 p-5 text-white shadow-sm">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-indigo-950 to-transparent" />
        <div className="absolute bottom-0 left-8 h-24 w-48 skew-x-[-25deg] bg-indigo-800/70" />
        <div className="absolute bottom-0 right-16 h-32 w-56 skew-x-[25deg] bg-violet-700/70" />
        <div className="absolute right-10 top-12 h-10 w-10 rounded-full bg-yellow-200 shadow-[0_0_40px_rgba(254,240,138,0.7)]" />
      </div>
      <div className="relative flex h-full flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold text-indigo-100">每日一句</p>
        <p className="mt-8 text-lg font-semibold tracking-wide">“{quote.text}”</p>
        <p className="mt-4 text-sm text-indigo-100">—— {quote.author}</p>
      </div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  unit,
  icon,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-5 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
          {icon}
        </div>
        <p className="text-3xl font-semibold text-slate-950">
          {value}
          <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>
        </p>
      </div>
    </section>
  );
}

// Task Card Component
function TaskCard({ 
  task, 
  onClick, 
  onStartFocus,
  actualTime, 
  status = 'pending' 
}: { 
  task: Task; 
  onClick: () => void; 
  onStartFocus?: () => void;
  actualTime?: number;
  status?: 'pending' | 'completed' | 'partial' | 'postponed' | 'not_completed' | 'not_involved';
}) {
  const getStatusMeta = () => {
    switch (status) {
      case 'completed':
        return { label: '已完成', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
      case 'partial':
        return { label: '部分完成', className: 'bg-amber-50 text-amber-700 border-amber-100' };
      case 'postponed':
        return { label: '推迟', className: 'bg-orange-50 text-orange-700 border-orange-100' };
      case 'not_completed':
        return { label: '未完成', className: 'bg-rose-50 text-rose-700 border-rose-100' };
      case 'not_involved':
        return { label: '今日不涉及', className: 'bg-slate-50 text-slate-600 border-slate-100' };
      default:
        return { label: '待处理', className: 'bg-blue-50 text-blue-700 border-blue-100' };
    }
  };

  const isCompleted = status === 'completed' || status === 'partial';
  const statusMeta = getStatusMeta();

  return (
    <div className="flex min-h-20 w-full items-center rounded-lg border border-blue-100 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40">
      <div className="flex w-full items-center justify-between gap-3">
        <button onClick={onClick} className="min-w-0 flex-1 text-left">
          <p className={`truncate text-base font-semibold ${isCompleted ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-950'}`}>
            {task.name}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {typeof actualTime === 'number' && Number.isFinite(actualTime) ? `实际 ${actualTime} 分钟` : `预计 ${task.timePerUnit} 分钟`}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {status === 'pending' && onStartFocus && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStartFocus}
              className="h-8 rounded-lg border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100"
            >
              <Play className="mr-1 size-3.5" />
              开始
            </Button>
          )}
          <span className={`rounded-full border px-3 py-1 text-sm font-medium ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// Types
interface DashboardStats {
  totalTasks: number;
  weeklyCompletionRate: number;
  todayStudyMinutes: number;
  booksRead: number;
  todayReadingCount: number;
  readingPerformance?: {
    records: number;
    minutes: number;
    pages: number;
  };
}

interface Task {
  id: number;
  name: string;
  category: string;
  subject?: string;
  taskKind?: string;
  abilityCategory?: string;
  abilityPoint?: string;
  scheduleRule: string;
  timePerUnit: number;
  appliesTo: number[];
}

interface Checkin {
  id: number;
  taskId: number;
  status: 'completed' | 'partial' | 'postponed' | 'not_completed' | 'not_involved' | 'pending';
  completedValue?: number;
  focusMinutes?: number;
  notes?: string;
  metadata?: Record<string, any>;
  evidenceUrl?: string;
}

interface CheckinPayload {
  taskId: number;
  childId: number | undefined | null;
  status: string;
  value: number;
  completedValue: number | undefined | null;
  focusMinutes?: number | undefined | null;
  notes: string;
  metadata?: Record<string, any>;
  evidenceUrl?: string;
  date: string;
}

function getStagePrimaryAdvice(remainingTasks: number, needsAttentionCount: number) {
  if (needsAttentionCount > 0) {
    return `有 ${needsAttentionCount} 项任务需要复盘，先看孩子卡在哪里，再补家长观察。`;
  }
  if (remainingTasks > 0) {
    return `今天还有 ${remainingTasks} 项待处理，建议放进固定时间块，先完成阅读或短任务。`;
  }
  return '今天任务推进稳定，可以做 5 分钟亲子复盘，并记录阅读或专注表现。';
}

function getStageMiddleAdvice(remainingTasks: number, needsAttentionCount: number) {
  if (needsAttentionCount > 0) {
    return `有 ${needsAttentionCount} 项任务需要复盘，优先确认薄弱学科、错因和明天补救安排。`;
  }
  if (remainingTasks > 0) {
    return `今天还有 ${remainingTasks} 项待处理，建议按学科优先级处理，并保留错题复盘时间。`;
  }
  return '今天任务推进稳定，可以整理错题、薄弱点和明日复习优先级。';
}

interface AIAnalysisResult {
  overallEvaluation: string;
  taskCompletionAnalysis: string;
  learningEfficiencyAnalysis: string;
  strengths: string[];
  improvementSuggestions: string[];
  tomorrowPlan: string;
}

// 格式化学习时长
function formatStudyTime(minutes: number): string {
  return `${minutes}分钟`;
}

function formatFocusTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatPomodoroTime(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

// 获取本地日期格式（YYYY-MM-DD）
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getShiftedLocalDateString(dateString: string, days: number): string {
  const date = parseLocalDateString(dateString);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function getWeekDatesFromMonday(dateString: string): string[] {
  const date = parseLocalDateString(dateString);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    return getLocalDateString(current);
  });
}

const weekDayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

type CompletionStatus = 'completed' | 'partial' | 'postponed' | 'not_completed' | 'not_involved';

const categoryLabelMap: Record<string, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  reading: '阅读',
  exercise: '运动',
  sport: '运动',
  habit: '习惯',
  life: '生活',
  emotion: '情绪',
  social: '社交',
  school: '校内',
  advanced: '培优',
  other: '其他',
};

const qualityOptions = [
  { value: '', label: '未记录' },
  { value: 'good', label: '很好' },
  { value: 'normal', label: '正常' },
  { value: 'struggled', label: '吃力' },
];

const difficultyOptions = [
  { value: '', label: '未记录' },
  { value: 'easy', label: '偏简单' },
  { value: 'fit', label: '合适' },
  { value: 'hard', label: '偏难' },
];

const blockerOptions = [
  { value: '', label: '请选择原因' },
  { value: 'time', label: '时间不够' },
  { value: 'hard', label: '太难' },
  { value: 'interest', label: '兴趣不足' },
  { value: 'energy', label: '状态不好' },
  { value: 'external', label: '外部原因' },
];

function getCategoryLabel(category: string, subject?: string) {
  return categoryLabelMap[subject || ''] || categoryLabelMap[category] || category || '未分类';
}

function formatMinuteDelta(current: number, previous?: number) {
  if (previous === undefined || previous === null) return '暂无对比';
  const delta = current - previous;
  if (delta === 0) return '持平';
  return `${delta > 0 ? '+' : ''}${delta} 分钟`;
}

function getStatusButtonClass(status: CompletionStatus, currentStatus: CompletionStatus): string {
  const isActive = status === currentStatus;
  if (isActive) {
    return 'rounded-lg bg-primary text-primary-foreground hover:bg-primary/90';
  }
  return 'rounded-lg border-slate-200 hover:bg-slate-50';
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const { children: _childrenList, selectedChild, selectedChildId } = useSelectedChild();
  const navigate = useNavigate();
  
  // 页面引用
  const pageRef = useRef<HTMLDivElement>(null);

  // 状态变量
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus>('completed');
  const [completionData, setCompletionData] = useState({
    actualTime: '',
    focusMinutes: '',
    quality: '',
    difficulty: '',
    blocker: '',
    childFeedback: '',
    notes: '',
    date: getLocalDateString(new Date()),
    evidence: null as File | null,
    evidenceUrl: '' as string
  });
  const [focusSession, setFocusSession] = useState<{
    task: Task;
    startedAt: number;
    elapsedSeconds: number;
    running: boolean;
  } | null>(null);
  const [focusPickerOpen, setFocusPickerOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [pomodoroDuration, setPomodoroDuration] = useState(25);
  const [pomodoroRemaining, setPomodoroRemaining] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  // 日期选择状态
  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()));
  // 导出对话框状态
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  // 当选择日期变化时，更新 completionData.date
  useEffect(() => {
    setCompletionData(prev => ({
      ...prev,
      date: selectedDate
    }));
  }, [selectedDate]);

  useEffect(() => {
    if (!focusSession?.running) return;
    const timer = window.setInterval(() => {
      setFocusSession((current) => {
        if (!current?.running) return current;
        return {
          ...current,
          elapsedSeconds: Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000)),
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [focusSession?.running]);

  useEffect(() => {
    if (!pomodoroRunning) return;
    const timer = window.setInterval(() => {
      setPomodoroRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setPomodoroRunning(false);
          toast.success('番茄闹钟结束，可以休息一下');
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pomodoroRunning]);

  // 概览统计数据
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats', selectedChildId, selectedDate],
    queryFn: async () => {
      const response = await apiClient.get(`/dashboard/stats?date=${selectedDate}&childId=${selectedChildId}`);
      return response.data.data as DashboardStats;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: yesterdayStats } = useQuery({
    queryKey: ['dashboard-stats-compare', selectedChildId, getShiftedLocalDateString(selectedDate, -1)],
    queryFn: async () => {
      const compareDate = getShiftedLocalDateString(selectedDate, -1);
      const response = await apiClient.get(`/dashboard/stats?date=${compareDate}&childId=${selectedChildId}`);
      return response.data.data as DashboardStats;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!selectedChildId,
  });

  const { data: lastWeekStats } = useQuery({
    queryKey: ['dashboard-stats-compare', selectedChildId, getShiftedLocalDateString(selectedDate, -7)],
    queryFn: async () => {
      const compareDate = getShiftedLocalDateString(selectedDate, -7);
      const response = await apiClient.get(`/dashboard/stats?date=${compareDate}&childId=${selectedChildId}`);
      return response.data.data as DashboardStats;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!selectedChildId,
  });

  const weekDates = getWeekDatesFromMonday(selectedDate);
  const { data: weekTrend = [] } = useQuery({
    queryKey: ['dashboard-week-trend', selectedChildId, weekDates[0]],
    queryFn: async () => {
      const results = await Promise.all(
        weekDates.map(async (date, index) => {
          const response = await apiClient.get(`/dashboard/stats?date=${date}&childId=${selectedChildId}`);
          const dayStats = response.data.data as DashboardStats;

          return {
            date,
            label: weekDayLabels[index],
            minutes: dayStats.todayStudyMinutes || 0,
          };
        })
      );

      return results;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!selectedChildId,
  });
  
  // 获取周计划任务，用于构建今日待办和孩子对比
  const { data: tasks = [], refetch: refetchTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['dashboard-tasks', selectedChildId, selectedDate],
    queryFn: async () => {
      const date = parseLocalDateString(selectedDate);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      
      const response = await apiClient.get(`/plans/week/${weekStartStr}?childId=${selectedChildId}`);
      const plansData = response.data.data || [];
      
      // 提取任务数据
      const extractedTasks: any[] = [];
      plansData.forEach((plan: any) => {
        plan.allocations.forEach((allocation: any) => {
          extractedTasks.push({
            id: allocation.taskId,
            name: allocation.taskName,
            category: allocation.category,
            subject: allocation.subject,
            taskKind: allocation.taskKind,
            abilityCategory: allocation.abilityCategory,
            abilityPoint: allocation.abilityPoint,
            scheduleRule: allocation.scheduleRule,
            timePerUnit: allocation.timePerUnit,
            appliesTo: [selectedChildId!],
            assignedDays: allocation.assignedDays
          });
        });
      });
      
      return extractedTasks;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!selectedChildId,
  });
  
  // 标记任务完成的mutation
  const markTaskCompleteMutation = useMutation({
    mutationFn: (data: CheckinPayload) => apiClient.post(`/plans/checkin`, data),
    onSuccess: () => {
      setOpen(false);
      refetchTasks();
      refetchStats();
      refetchTodayCheckins();
    },
    onError: (error: Error) => {
      console.error('任务完成失败:', error);
      toast.error('任务完成失败，请稍后重试');
    },
  });
  
  // 处理任务点击
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    
    // 查找该任务的签到记录
    const checkin = todayCheckins.find((c: Checkin) => Number(c.taskId) === Number(task.id));

    if (checkin) {
      const metadata = checkin.metadata || {};
      // 如果找到签到记录，填充上次的数据
      setCompletionStatus(checkin.status);
      setCompletionData({
        actualTime: checkin.completedValue ? checkin.completedValue.toString() : '',
        focusMinutes: checkin.focusMinutes ? checkin.focusMinutes.toString() : '',
        quality: metadata.quality || '',
        difficulty: metadata.difficulty || '',
        blocker: metadata.blocker || '',
        childFeedback: metadata.childFeedback || '',
        notes: checkin.notes || '',
        date: selectedDate,
        evidence: null,
        evidenceUrl: checkin.evidenceUrl || ''
      });
    } else {
      // 如果没有签到记录，使用默认值
      setCompletionStatus('completed');
      setCompletionData({
        actualTime: '',
        focusMinutes: '',
        quality: '',
        difficulty: '',
        blocker: '',
        childFeedback: '',
        notes: '',
        date: selectedDate,
        evidence: null,
        evidenceUrl: ''
      });
    }
    
    setOpen(true);
  };

  const handleStartFocus = (task: Task) => {
    setFocusPickerOpen(false);
    setFocusSession({
      task,
      startedAt: Date.now(),
      elapsedSeconds: 0,
      running: true,
    });
    toast.success(`已开始专注：${task.name}`);
  };

  const handleStopFocus = () => {
    if (!focusSession) return;
    const elapsedSeconds = focusSession.running
      ? Math.max(focusSession.elapsedSeconds, Math.floor((Date.now() - focusSession.startedAt) / 1000))
      : focusSession.elapsedSeconds;
    const focusMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setFocusSession(null);
    setSelectedTask(focusSession.task);
    setCompletionStatus('completed');
    setCompletionData({
      actualTime: String(focusMinutes),
      focusMinutes: String(focusMinutes),
      quality: '',
      difficulty: '',
      blocker: '',
      childFeedback: '',
      notes: '',
      date: selectedDate,
      evidence: null,
      evidenceUrl: '',
    });
    setOpen(true);
  };

  const handleCancelFocus = () => {
    setFocusSession(null);
    toast.info('已放弃本次专注计时');
  };

  const openPomodoro = () => {
    setPomodoroOpen(true);
    if (!pomodoroRunning && pomodoroRemaining === 0) {
      setPomodoroRemaining(pomodoroDuration * 60);
    }
  };

  const changePomodoroDuration = (minutes: number) => {
    setPomodoroDuration(minutes);
    setPomodoroRemaining(minutes * 60);
    setPomodoroRunning(false);
  };

  const resetPomodoro = () => {
    setPomodoroRemaining(pomodoroDuration * 60);
    setPomodoroRunning(false);
  };

  // 分享到钉钉
  const handleShareToDingTalk = async () => {
    if (!selectedChildId) {
      toast.error('请先选择一个孩子');
      return;
    }

    try {
      await apiClient.post(`/dingtalk/dashboard/share`, {
        childId: selectedChildId,
        date: selectedDate,
      });

      toast.success('已分享到钉钉');
    } catch (error) {
      console.error('分享到钉钉失败:', error);
      const message = getErrorMessage(error);
      if (message.includes('webhook') || message.includes('Webhook') || message.includes('钉钉')) {
        toast.error('请先在孩子管理中配置钉钉 Webhook');
        return;
      }
      toast.error(message || '分享失败，请稍后重试');
    }
  };

  // AI分析
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(false);
  const [aiAnalysisData, setAiAnalysisData] = useState<AIAnalysisResult | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);

  const handleAIAnalysis = async () => {
    if (!selectedChildId) {
      toast.error('请先选择一个孩子');
      return;
    }

    setAiAnalysisLoading(true);
    try {
      const response = await apiClient.post(`/ai/analyze-dashboard`, {
        childId: selectedChildId,
        date: selectedDate,
      });

      if (response.data.success) {
        setAiAnalysisData(response.data.data);
        setAiAnalysisOpen(true);
      } else {
        toast.error('AI分析失败，请稍后重试');
      }
    } catch (error) {
      console.error('AI分析失败:', error);
      toast.error('AI分析失败，请稍后重试');
    } finally {
      setAiAnalysisLoading(false);
    }
  };
  
  // 处理任务完成
  const handleCompleteTask = async () => {
    if (selectedTask) {
      try {
        // First submit the checkin
        const checkinResponse = await apiClient.post(`/plans/checkin`, {
          taskId: selectedTask.id,
          childId: selectedChildId ?? undefined,
          status: completionStatus,
          value: 1,
          completedValue: completionData.actualTime !== '' ? parseInt(completionData.actualTime) : undefined,
          focusMinutes: completionData.focusMinutes !== '' ? parseInt(completionData.focusMinutes) : undefined,
          notes: completionData.notes,
          metadata: {
            quality: completionData.quality,
            difficulty: completionData.difficulty,
            blocker: completionData.blocker,
            childFeedback: completionData.childFeedback,
            abilityCategory: selectedTask.abilityCategory || '',
            abilityPoint: selectedTask.abilityPoint || '',
          },
          evidenceUrl: completionData.evidenceUrl,
          date: completionData.date
        });

        const checkinId = checkinResponse.data.data?.id;

        // If there's evidence to upload, upload it
        if (completionData.evidence && checkinId) {
          const formData = new FormData();
          formData.append('evidence', completionData.evidence);
          formData.append('checkinId', checkinId.toString());

          await apiClient.post('/upload/evidence', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        }

        // Close dialog and refresh data
        setOpen(false);
        refetchTasks();
        refetchStats();
        refetchTodayCheckins();

        // Reset completion data
        setCompletionData({
          actualTime: '',
          focusMinutes: '',
          quality: '',
          difficulty: '',
          blocker: '',
          childFeedback: '',
          notes: '',
          date: selectedDate,
          evidence: null,
          evidenceUrl: ''
        });

        toast.success('任务完成');
      } catch (error) {
        console.error('任务完成失败:', error);
        toast.error('任务完成失败，请稍后重试');
      }
    }
  };

  // 获取今日任务完成情况
  const { data: todayCheckins = [], refetch: refetchTodayCheckins } = useQuery({
    queryKey: ['today-checkins', selectedChildId, selectedDate],
    queryFn: async () => {
      const response = await apiClient.get(`/dashboard/today-checkins?date=${selectedDate}&childId=${selectedChildId}`);
      return response.data.data || [];
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!selectedChildId,
  });

  // 构建选中日期的待办任务
  const selectedDateObj = parseLocalDateString(selectedDate);
  const selectedDayOfWeek = selectedDateObj.getDay(); // 0=周日 ... 6=周六
  const todayTasks = tasks
    .filter((t: any) => {
      if (!selectedChildId) return false;
      if (!t.appliesTo?.includes(selectedChildId)) return false;
      // 检查任务是否分配到今天
      if (t.assignedDays && Array.isArray(t.assignedDays) && !t.assignedDays.includes(selectedDayOfWeek)) {
        return false;
      }
      // 按 scheduleRule 过滤，基于选中的日期
      if (t.scheduleRule === 'school' && (selectedDayOfWeek === 0 || selectedDayOfWeek === 6)) return false;
      if (t.scheduleRule === 'weekend' && selectedDayOfWeek >= 1 && selectedDayOfWeek <= 5) return false;
      // 对于 advanced 分类的任务，只在周末显示
      if (t.category === 'advanced' && (selectedDayOfWeek >= 1 && selectedDayOfWeek <= 5)) {
        return false;
      }
      return true;
    })
    .map((t: any) => {
      const checkin = todayCheckins.find((c: Checkin) => Number(c.taskId) === Number(t.id));
      return {
        id: String(t.id),
        title: t.name,
        childName: selectedChild?.name || '',
        category: t.category,
        duration: `${t.timePerUnit}分钟`,
        completed: checkin?.status === 'completed',
        status: checkin?.status || 'pending',
        actualTime: checkin?.completedValue,
        task: t
      };
    });

  // 按状态分类任务
  const completedTasks = todayTasks.filter(t => t.status === 'completed');
  const partialTasks = todayTasks.filter(t => t.status === 'partial');
  const notCompletedTasks = todayTasks.filter(t => t.status === 'not_completed');
  const postponedTasks = todayTasks.filter(t => t.status === 'postponed');
  const notInvolvedTasks = todayTasks.filter(t => t.status === 'not_involved');
  const pendingTasks = todayTasks.filter(t => t.status === 'pending');

  // 已完成数 = 已完成 + 部分完成
  const completedCount = completedTasks.length + partialTasks.length;
  // 总任务数（用于计算完成率）= 已完成 + 部分完成 + 未完成 + 推迟 + 待处理（不包括今日不涉及）
  const totalTasksForRate = completedTasks.length + partialTasks.length + notCompletedTasks.length + postponedTasks.length + pendingTasks.length;
  const completionRate = totalTasksForRate > 0 ? Math.round((completedCount / totalTasksForRate) * 100) : 0;
  const remainingTasks = pendingTasks.length + partialTasks.length;
  const remainingMinutes = pendingTasks.reduce((sum, task) => sum + (task.task.timePerUnit || 0), 0);
  const needsAttentionTasks = [...partialTasks, ...notCompletedTasks, ...postponedTasks];
  const selectedEducationStage = selectedChild?.educationStage || 'primary';
  const stageAdviceText = selectedEducationStage === 'middle'
    ? getStageMiddleAdvice(remainingTasks, needsAttentionTasks.length)
    : getStagePrimaryAdvice(remainingTasks, needsAttentionTasks.length);
  const nextActions = pendingTasks.slice(0, 2);
  const greeting = getGreeting();
  const displayName = selectedChild?.name || user?.name || '家长';
  const todayStudyMinutes = stats?.todayStudyMinutes || 0;
  const readingPages = stats?.readingPerformance?.pages || 0;
  const totalFocusMinutes = todayCheckins.reduce((sum: number, checkin: Checkin) => sum + (checkin.focusMinutes || 0), 0);
  const yesterdayDelta = formatMinuteDelta(todayStudyMinutes, yesterdayStats?.todayStudyMinutes);
  const lastWeekDelta = formatMinuteDelta(todayStudyMinutes, lastWeekStats?.todayStudyMinutes);

  return (
    <div className="mx-auto max-w-[1360px] space-y-5" ref={pageRef}>
      <PageToolbar
        left={
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-950">今日概览</h1>
              <p className="truncate text-xs text-slate-500 sm:text-sm">
                {greeting}，{displayName} · {getEducationStageLabel(selectedEducationStage)} · 坚持学习的每一天，都是成长的最好见证
              </p>
            </div>
          </div>
        }
        right={
          <>
          <DatePicker value={selectedDate} onChange={setSelectedDate} className="w-[190px]" />
          <Button onClick={handleShareToDingTalk} className="h-11 rounded-xl bg-blue-500 px-4 text-white shadow-sm hover:bg-blue-600">
            <Send className="mr-1.5 h-4 w-4" />
            钉钉
          </Button>
          <Button onClick={() => setExportDialogOpen(true)} className="h-11 rounded-xl bg-emerald-500 px-4 text-white shadow-sm hover:bg-emerald-600">
            <Download className="mr-1.5 h-4 w-4" />
            导出
          </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(260px,0.82fr)]">
        <section className="relative min-h-[214px] overflow-hidden rounded-xl border border-violet-100 bg-gradient-to-br from-blue-50 via-violet-50 to-fuchsia-50 p-5 shadow-sm">
          <h2 className="relative z-10 text-base font-semibold text-slate-950">今日进度</h2>
          <div className="relative z-10 mt-5 grid gap-5 md:grid-cols-[128px_minmax(0,1fr)] md:items-center md:pr-32 lg:pr-[120px] xl:pr-36">
            <div className="flex justify-center md:justify-start">
              <ProgressRing value={statsLoading ? 0 : completionRate} />
            </div>
            <div className="grid max-w-[210px] gap-3">
              <div className="flex min-h-12 items-center gap-3 rounded-xl bg-white/55 px-3 py-2 ring-1 ring-violet-100/70">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-950">{completedCount}/{totalTasksForRate} 项</p>
                  <p className="text-xs text-slate-500">任务完成</p>
                </div>
              </div>
              <div className="flex min-h-12 items-center gap-3 rounded-xl bg-white/55 px-3 py-2 ring-1 ring-violet-100/70">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-950">{todayStudyMinutes} 分钟</p>
                  <p className="text-xs text-slate-500">学习时长</p>
                </div>
              </div>
              <p className="inline-flex w-fit rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600">
                加油！开启今天的学习之旅吧
              </p>
            </div>
          </div>
          <StudyIllustration />
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricTile label="待完成任务" value={remainingTasks} unit="项" icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} tone="bg-emerald-50" />
          <MetricTile label="学习时长" value={todayStudyMinutes} unit="分钟" icon={<Clock className="h-5 w-5 text-indigo-600" />} tone="bg-indigo-50" />
          <MetricTile label="阅读页数" value={readingPages} unit="页" icon={<BookOpen className="h-5 w-5 text-orange-500" />} tone="bg-orange-50" />
          <MetricTile label="专注时长" value={totalFocusMinutes} unit="分钟" icon={<Brain className="h-5 w-5 text-sky-500" />} tone="bg-sky-50" />
        </div>

        <DailyQuoteCard date={selectedDate} />
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(260px,0.78fr)]">
        <section className="flex h-[390px] min-h-0 flex-col overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-orange-50 to-white px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">今日任务</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tasksLoading && todayTasks.length === 0 ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}
              </div>
            ) : totalTasksForRate === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-50 text-violet-500">
                  <Calendar className="h-10 w-10" />
                </div>
                <p className="mt-5 text-base font-semibold text-slate-950">还没有任务安排呢</p>
                <p className="mt-2 text-sm text-slate-500">从学习计划生成今日任务，或手动添加任务吧</p>
                <Button onClick={() => navigate('/parent/tasks')} className="mt-5 rounded-lg bg-primary px-6 text-white hover:bg-primary/90">
                  去创建任务
                </Button>
              </div>
            ) : (
              <div className="space-y-3 pr-1">
                {[...pendingTasks, ...needsAttentionTasks, ...completedTasks].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task.task}
                    status={task.status as any}
                    actualTime={task.actualTime}
                    onClick={() => handleTaskClick(task.task)}
                    onStartFocus={() => handleStartFocus(task.task)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex h-[390px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">学习趋势</h2>
            <Button variant="outline" size="sm" className="h-9 rounded-lg">本周 · 较昨日</Button>
          </div>
          <div className="mt-4 flex-1">
            <TrendChart data={weekTrend} />
          </div>
          <div className="grid grid-cols-2 border-t border-slate-100 pt-4 text-sm">
            <div>
              <p className="text-slate-500">较上周同期</p>
              <p className="mt-1 font-semibold text-slate-900">{lastWeekDelta}</p>
              <p className="mt-0.5 text-xs text-slate-400">上周 {lastWeekStats?.todayStudyMinutes ?? 0} 分钟</p>
            </div>
            <div>
              <p className="text-slate-500">较昨天</p>
              <p className="mt-1 font-semibold text-slate-900">{yesterdayDelta}</p>
              <p className="mt-0.5 text-xs text-slate-400">昨天 {yesterdayStats?.todayStudyMinutes ?? 0} 分钟</p>
            </div>
          </div>
        </section>

        <aside className="flex h-[390px] min-h-0 flex-col gap-4 overflow-hidden">
          <section className="shrink-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">快速操作</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={openPomodoro} className="h-12 rounded-xl bg-violet-50/60">
                <Timer className="mr-2 h-4 w-4 text-primary" />
                番茄闹钟
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (pendingTasks.length > 0) setFocusPickerOpen(true);
                  else toast.info('当前没有待开始的任务');
                }}
                className="h-12 rounded-xl bg-pink-50/60"
              >
                <Clock className="mr-2 h-4 w-4 text-pink-500" />
                开始专注
              </Button>
              <Button variant="outline" onClick={() => navigate('/parent/reading')} className="h-12 rounded-xl bg-indigo-50/60">
                <BookOpen className="mr-2 h-4 w-4 text-indigo-500" />
                阅读记录
              </Button>
              <Button variant="outline" onClick={() => navigate('/parent/plans')} className="h-12 rounded-xl bg-sky-50/60">
                <Calendar className="mr-2 h-4 w-4 text-sky-500" />
                学习工具
              </Button>
            </div>
          </section>

          <section className="min-h-0 flex-1 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Brain className="h-5 w-5 text-primary" />
              AI 今日建议
            </h2>
            <p className="mt-5 text-sm leading-6 text-slate-600">
              {stageAdviceText}
            </p>
            <Button variant="outline" onClick={handleAIAnalysis} className="mt-5 rounded-lg">
              查看分析
            </Button>
          </section>
        </aside>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">学习状态</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-950">
                {completionRate >= 80 ? '状态良好' : completionRate >= 40 ? '需要推进' : '等待开始'}
              </p>
              <p className="text-sm text-muted-foreground">
                {completionRate >= 80
                  ? '今天任务推进顺利，可以保持当前节奏。'
                  : remainingTasks > 0
                    ? `今天还有 ${remainingTasks} 项任务待处理，建议先从短任务开始。`
                    : '今天还没有足够记录，完成任务后会形成更准确的状态判断。'}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ['完成率', `${completionRate}%`, completionRate],
              ['剩余任务', `${remainingTasks}项`, totalTasksForRate > 0 ? Math.max(0, 100 - completionRate) : 0],
              ['学习时长', `${todayStudyMinutes}分钟`, Math.min(100, Math.round((todayStudyMinutes / 120) * 100))],
              ['阅读页数', `${readingPages}页`, Math.min(100, readingPages * 5)],
            ].map(([label, value, progress]) => (
              <div key={String(label)}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">今日学习建议</h2>
          <div className="mt-4 space-y-4">
            {[
              {
                title: needsAttentionTasks.length > 0
                  ? (selectedEducationStage === 'middle' ? '先看薄弱项' : '先处理卡点')
                  : '继续保持',
                desc: stageAdviceText,
                icon: Lightbulb,
                bg: 'bg-amber-50',
                color: 'text-amber-500',
              },
              {
                title: remainingTasks > 0
                  ? (selectedEducationStage === 'middle' ? '按学科排优先级' : '放进时间块')
                  : '安排复盘',
                desc: remainingTasks > 0
                  ? (selectedEducationStage === 'middle'
                    ? `剩余任务预计还需 ${remainingMinutes} 分钟，优先处理薄弱学科和错题关联任务。`
                    : `剩余任务预计还需 ${remainingMinutes} 分钟，可优先安排阅读、专注或短任务。`)
                  : (selectedEducationStage === 'middle'
                    ? '今日任务基本完成后，可以整理错题和明日复习顺序。'
                    : '今日任务基本完成后，可以安排 5 分钟亲子复盘和阅读记录。'),
                icon: Clock,
                bg: 'bg-blue-50',
                color: 'text-blue-500',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Dialog open={pomodoroOpen} onOpenChange={setPomodoroOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-violet-100 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Timer className="size-5 text-primary" />
              番茄闹钟
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="flex justify-center gap-2">
              {[15, 25, 45].map((minutes) => (
                <Button
                  key={minutes}
                  variant="outline"
                  onClick={() => changePomodoroDuration(minutes)}
                  className={cn(
                    'h-9 rounded-lg border-violet-200',
                    pomodoroDuration === minutes
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-white text-violet-700 hover:bg-violet-50'
                  )}
                >
                  {minutes} 分钟
                </Button>
              ))}
            </div>

            <div className="flex flex-col items-center rounded-2xl bg-slate-950 px-6 py-9 text-white">
              <p className="text-xs font-medium text-violet-200">自由计时，不绑定任务</p>
              <p className="mt-3 font-mono text-6xl font-semibold tabular-nums">
                {formatPomodoroTime(pomodoroRemaining)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" onClick={resetPomodoro} className="h-11 rounded-xl">
                <RotateCcw className="mr-1.5 size-4" />
                重置
              </Button>
              <Button
                variant="outline"
                onClick={() => setPomodoroRunning(false)}
                disabled={!pomodoroRunning}
                className="h-11 rounded-xl"
              >
                <Pause className="mr-1.5 size-4" />
                暂停
              </Button>
              <Button
                onClick={() => {
                  if (pomodoroRemaining <= 0) resetPomodoro();
                  setPomodoroRunning(true);
                }}
                className="h-11 rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              >
                <Play className="mr-1.5 size-4" />
                开始
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={focusPickerOpen} onOpenChange={setFocusPickerOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Play className="size-5 text-pink-500" />
              选择专注任务
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto py-2">
            {pendingTasks.length > 0 ? pendingTasks.map((item) => (
              <button
                key={item.id}
                onClick={() => handleStartFocus(item.task)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-pink-200 hover:bg-pink-50/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{item.task.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {getCategoryLabel(item.task.category, item.task.subject)}
                    {item.task.abilityPoint ? ` · ${item.task.abilityPoint}` : ''}
                    {` · 预计 ${item.task.timePerUnit} 分钟`}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-pink-50 px-3 py-1 text-xs font-medium text-pink-600">开始</span>
              </button>
            )) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                当前没有待开始的任务
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(focusSession)}>
        <DialogContent
          className="sm:max-w-md rounded-2xl border border-sky-100 shadow-xl"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Clock className="size-5 text-sky-600" />
              专注计时
            </DialogTitle>
          </DialogHeader>
          {focusSession && (
            <div className="space-y-6 py-2">
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <p className="text-xs font-medium text-sky-700">当前任务</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{focusSession.task.name}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{getCategoryLabel(focusSession.task.category, focusSession.task.subject)}</span>
                  {focusSession.task.abilityPoint && <span>能力点：{focusSession.task.abilityPoint}</span>}
                  <span>预计 {focusSession.task.timePerUnit} 分钟</span>
                </div>
              </div>

              <div className="flex flex-col items-center rounded-2xl bg-slate-950 px-6 py-8 text-white">
                <p className="text-xs font-medium text-sky-200">已专注</p>
                <p className="mt-3 font-mono text-6xl font-semibold tabular-nums">
                  {formatFocusTime(focusSession.elapsedSeconds)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={handleCancelFocus} className="h-11 rounded-xl">
                  放弃计时
                </Button>
                <Button onClick={handleStopFocus} className="h-11 rounded-xl bg-sky-600 text-white hover:bg-sky-700">
                  <Square className="mr-1.5 size-4" />
                  结束并记录
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 任务完成弹窗 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto rounded-2xl border border-slate-200 shadow-xl sm:max-w-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-semibold text-slate-950 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              完成任务
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-2">
              {/* 任务信息 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="font-semibold text-slate-950">{selectedTask.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{selectedTask.timePerUnit}分钟</span>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{getCategoryLabel(selectedTask.category, selectedTask.subject)}</span>
                  {selectedTask.abilityPoint && <span>能力点：{selectedTask.abilityPoint}</span>}
                </div>
              </div>

              {/* 完成状态 */}
              <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-3">
                <Label className="text-sm font-medium text-slate-700">完成状态</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={completionStatus === 'completed' ? 'default' : 'outline'}
                    onClick={() => setCompletionStatus('completed')}
                    className={getStatusButtonClass('completed', completionStatus)}
                  >
                    全部完成
                  </Button>
                  <Button
                    variant={completionStatus === 'partial' ? 'default' : 'outline'}
                    onClick={() => setCompletionStatus('partial')}
                    className={getStatusButtonClass('partial', completionStatus)}
                  >
                    部分完成
                  </Button>
                  <Button
                    variant={completionStatus === 'not_completed' ? 'default' : 'outline'}
                    onClick={() => setCompletionStatus('not_completed')}
                    className={getStatusButtonClass('not_completed', completionStatus)}
                  >
                    未完成
                  </Button>
                  <Button
                    variant={completionStatus === 'postponed' ? 'default' : 'outline'}
                    onClick={() => setCompletionStatus('postponed')}
                    className={getStatusButtonClass('postponed', completionStatus)}
                  >
                    推迟
                  </Button>
                  <Button
                    variant={completionStatus === 'not_involved' ? 'default' : 'outline'}
                    onClick={() => setCompletionStatus('not_involved')}
                    className={getStatusButtonClass('not_involved', completionStatus)}
                  >
                    今日不涉及
                  </Button>
                </div>
              </div>

              {/* 实际用时 */}
              {!['postponed', 'not_completed', 'not_involved'].includes(completionStatus) && (
                <div className="grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">计入学习时长（分钟）</Label>
                    <Input
                      type="number"
                      min="0"
                      value={completionData.actualTime}
                      onChange={(e) => setCompletionData({ ...completionData, actualTime: e.target.value })}
                      placeholder="用于统计，可手动修正"
                      className="rounded-lg border-slate-200 focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">计时器记录（分钟）</Label>
                    <Input
                      type="number"
                      min="0"
                      value={completionData.focusMinutes}
                      onChange={(e) => setCompletionData({ ...completionData, focusMinutes: e.target.value })}
                      placeholder="任务专注结束后自动带入"
                      className="rounded-lg border-slate-200 focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {!['postponed', 'not_involved'].includes(completionStatus) && (
                <div className="grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">完成质量</Label>
                    <select
                      value={completionData.quality}
                      onChange={(e) => setCompletionData({ ...completionData, quality: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      {qualityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">难度感受</Label>
                    <select
                      value={completionData.difficulty}
                      onChange={(e) => setCompletionData({ ...completionData, difficulty: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      {difficultyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {['partial', 'not_completed', 'postponed'].includes(completionStatus) && (
                <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3">
                  <Label className="text-sm font-medium text-slate-700">未完成/调整原因</Label>
                  <select
                    value={completionData.blocker}
                    onChange={(e) => setCompletionData({ ...completionData, blocker: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  >
                    {blockerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              )}

              {/* 备注 */}
              {!['not_involved'].includes(completionStatus) && (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-3">
                  <Label className="text-sm font-medium text-slate-700">孩子反馈（可选）</Label>
                  <Input
                    value={completionData.childFeedback}
                    onChange={(e) => setCompletionData({ ...completionData, childFeedback: e.target.value })}
                    placeholder="例如：今天计算有点慢，但能坚持做完"
                    className="rounded-lg border-slate-200 focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <Label className="text-sm font-medium text-slate-700">家长观察（可选）</Label>
                  <Textarea
                    value={completionData.notes}
                    onChange={(e) => setCompletionData({ ...completionData, notes: e.target.value })}
                    placeholder="记录状态、卡点、需要调整的地方，后续可用于复盘分析"
                    rows={3}
                    className="w-full rounded-lg border-slate-200 focus:ring-2 focus:ring-primary/30 focus:border-primary p-3"
                  />
                </div>
              )}

              {/* 完成日期 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700">完成日期</Label>
	                <DatePicker
	                  value={completionData.date}
	                  onChange={(date) => setCompletionData({ ...completionData, date })}
	                  className="w-full"
	                  align="start"
	                />
              </div>

              {/* 证据上传 */}
              {!['postponed', 'not_completed', 'not_involved'].includes(completionStatus) && (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-3">
                  <Label className="text-sm font-medium text-slate-700">添加证据（可选）</Label>
                  
                  {/* 已上传的证据预览 */}
                  {completionData.evidenceUrl && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm text-slate-600">已上传证据</span>
                        </div>
                        <a 
                          href={completionData.evidenceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80"
                        >
                          查看
                        </a>
                      </div>
                    </div>
                  )}

                  {/* 新证据上传 */}
                  {!completionData.evidence && (
                    <div className="flex gap-3">
                      <input
                        type="file"
                        id="evidence-upload"
                        accept="image/*,audio/*,video/*,.pdf,.xls,.xlsx,.csv,.ppt,.pptx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error('文件大小不能超过 10MB');
                              return;
                            }
                            setCompletionData({ ...completionData, evidence: file });
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="evidence-upload"
                        className="flex-1 cursor-pointer"
                      >
                        <Button
                          variant="outline"
                          className="w-full rounded-lg border-dashed border-2 hover:border-primary hover:bg-primary/5"
                          asChild
                        >
                          <span>
                            <Image className="w-4 h-4 mr-2" />
                            选择文件
                          </span>
                        </Button>
                      </label>
                    </div>
                  )}

                  {/* 已选择的文件预览 */}
                  {completionData.evidence && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm text-slate-700 truncate max-w-[200px]">
                            {completionData.evidence.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({(completionData.evidence.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCompletionData({ ...completionData, evidence: null })}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    支持图片、音频、视频、PDF、Excel 和 PPT，最大 10MB
                  </p>
                </div>
              )}

              {/* 提交按钮 */}
              <Button
                onClick={handleCompleteTask}
                className="w-full rounded-lg h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                {completionStatus === 'postponed' ? '确认推迟' : 
                 completionStatus === 'not_completed' ? '确认未完成' : 
                 completionStatus === 'not_involved' ? '确认今日不涉及' : '标记完成'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI分析弹窗 */}
      <Dialog open={aiAnalysisOpen} onOpenChange={setAiAnalysisOpen}>
        <DialogContent className="sm:max-w-2xl rounded-xl border border-slate-200 shadow-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg font-semibold text-slate-950 flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              AI学习分析
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {aiAnalysisLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : aiAnalysisData ? (
              <div className="space-y-6">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <h3 className="text-base font-semibold text-slate-950 mb-2">总体评价</h3>
                  <p className="text-slate-700">{aiAnalysisData.overallEvaluation}</p>
                </div>
                
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-950 mb-2">任务完成分析</h3>
                  <p className="text-slate-700">{aiAnalysisData.taskCompletionAnalysis}</p>
                </div>
                
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-950 mb-2">学习效率分析</h3>
                  <p className="text-slate-700">{aiAnalysisData.learningEfficiencyAnalysis}</p>
                </div>
                
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-base font-semibold text-slate-950 mb-2">学习亮点</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-700">
                    {(Array.isArray(aiAnalysisData.strengths) ? aiAnalysisData.strengths : []).map((strength: string, index: number) => (
                      <li key={index}>{strength}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-base font-semibold text-slate-950 mb-2">改进建议</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-700">
                    {(Array.isArray(aiAnalysisData.improvementSuggestions) ? aiAnalysisData.improvementSuggestions : []).map((suggestion: string, index: number) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-950 mb-2">明日计划建议</h3>
                  <p className="text-slate-700">{aiAnalysisData.tomorrowPlan}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-12">
                <p className="text-slate-500">暂无分析数据</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-center pt-4">
            <Button 
              type="button" 
              onClick={() => setAiAnalysisOpen(false)}
              className="w-full rounded-lg h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导出对话框 */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        targetRef={pageRef}
        title="导出概览数据"
        filename="学习概览"
      />

    </div>
  );
}
