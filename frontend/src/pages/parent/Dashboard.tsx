import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { Clock, CheckCircle2, BookOpen, Calendar, Send, Brain, Download, Image, FileText, XCircle, AlertCircle, LayoutDashboard, HeartPulse, Lightbulb, Play, Square, Pause, RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageToolbar } from '@/components/parent/PageToolbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { ExportDialog } from '@/components/ExportDialog';
import { getEducationStageLabel } from '@/lib/education-stage';
import { toast } from 'sonner';
import { startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';

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
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-slate-500">
            <span>{getCategoryLabel(task.category, task.subject)}</span>
            {task.abilityCategory && <span>{task.abilityCategory}</span>}
            {task.abilityPoint && <span>{task.abilityPoint}</span>}
            <span>{typeof actualTime === 'number' && Number.isFinite(actualTime) ? `实际 ${actualTime} 分钟` : `预计 ${task.timePerUnit} 分钟`}</span>
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
          <Button type="button" variant="outline" size="sm" onClick={onClick} className="h-8 rounded-lg">
            {status === 'pending' ? '完成' : '查看'}
          </Button>
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
type TaskFilter = 'all' | 'pending' | 'attention' | 'completed';

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

const moodOptions = [
  { value: '', label: '未记录' },
  { value: 'stable', label: '稳定' },
  { value: 'tired', label: '疲惫' },
  { value: 'anxious', label: '焦虑' },
  { value: 'resistant', label: '抗拒' },
  { value: 'positive', label: '积极' },
];

const externalLoadOptions = [
  { value: '', label: '无明显外部负载' },
  { value: 'exam_week', label: '学校考试周' },
  { value: 'sick', label: '生病/恢复期' },
  { value: 'travel', label: '旅行/外出' },
  { value: 'teacher_change', label: '换老师/换班' },
  { value: 'family_schedule', label: '家庭节奏异常' },
];

const moodLabelMap = Object.fromEntries(moodOptions.map((option) => [option.value, option.label]));
const externalLoadLabelMap = Object.fromEntries(externalLoadOptions.map((option) => [option.value, option.label]));

const cognitiveErrorOptions = [
  { value: '', label: '未记录' },
  { value: 'missed_condition', label: '漏读条件' },
  { value: 'rule_misuse', label: '规则用错' },
  { value: 'calculation', label: '计算错误' },
  { value: 'logic_gap', label: '推理断点' },
  { value: 'strategy', label: '策略不当' },
  { value: 'careless', label: '粗心' },
];

const reviewQualityOptions = [
  { value: '', label: '未记录' },
  { value: 'none', label: '未复盘' },
  { value: 'surface', label: '只知道答案' },
  { value: 'cause', label: '能说出错因' },
  { value: 'rule', label: '能复述规则' },
  { value: 'transfer', label: '能完成变式迁移' },
];

const cognitiveErrorLabelMap = Object.fromEntries(cognitiveErrorOptions.map((option) => [option.value, option.label]));
const reviewQualityLabelMap = Object.fromEntries(reviewQualityOptions.map((option) => [option.value, option.label]));

const taskStatusLabelMap: Record<string, string> = {
  pending: '待处理',
  completed: '已完成',
  partial: '部分完成',
  postponed: '推迟',
  not_completed: '未完成',
  not_involved: '今日不涉及',
};

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
    sleepHours: '',
    mood: '',
    externalLoad: '',
    attemptCount: '',
    usedHint: '',
    cognitiveError: '',
    reviewQuality: '',
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
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
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
        sleepHours: metadata.sleepHours ? String(metadata.sleepHours) : '',
        mood: metadata.mood || '',
        externalLoad: metadata.externalLoad || '',
        attemptCount: metadata.attemptCount ? String(metadata.attemptCount) : '',
        usedHint: typeof metadata.usedHint === 'boolean' ? (metadata.usedHint ? 'yes' : 'no') : '',
        cognitiveError: metadata.cognitiveError || '',
        reviewQuality: metadata.reviewQuality || '',
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
        sleepHours: '',
        mood: '',
        externalLoad: '',
        attemptCount: '',
        usedHint: '',
        cognitiveError: '',
        reviewQuality: '',
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
      sleepHours: '',
      mood: '',
      externalLoad: '',
      attemptCount: '',
      usedHint: '',
      cognitiveError: '',
      reviewQuality: '',
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
            sleepHours: completionData.sleepHours !== '' ? Number(completionData.sleepHours) : undefined,
            mood: completionData.mood,
            externalLoad: completionData.externalLoad,
            attemptCount: completionData.attemptCount !== '' ? Number(completionData.attemptCount) : undefined,
            usedHint: completionData.usedHint === '' ? undefined : completionData.usedHint === 'yes',
            cognitiveError: completionData.cognitiveError,
            reviewQuality: completionData.reviewQuality,
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
          sleepHours: '',
          mood: '',
          externalLoad: '',
          attemptCount: '',
          usedHint: '',
          cognitiveError: '',
          reviewQuality: '',
          notes: '',
          date: selectedDate,
          evidence: null,
          evidenceUrl: ''
        });

        toast.success('任务完成');
      } catch (error) {
        console.error('任务完成失败:', error);
        toast.error(getErrorMessage(error) || '任务完成失败，请稍后重试');
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
  const orderedTodayTasks = [...pendingTasks, ...needsAttentionTasks, ...completedTasks, ...notInvolvedTasks];
  const visibleTodayTasks = (() => {
    if (taskFilter === 'pending') return pendingTasks;
    if (taskFilter === 'attention') return needsAttentionTasks;
    if (taskFilter === 'completed') return completedTasks;
    return orderedTodayTasks;
  })();
  const selectedEducationStage = selectedChild?.educationStage || 'primary';
  const stageAdviceText = selectedEducationStage === 'middle'
    ? getStageMiddleAdvice(remainingTasks, needsAttentionTasks.length)
    : getStagePrimaryAdvice(remainingTasks, needsAttentionTasks.length);
  const nextTask = pendingTasks[0]?.task;
  const nextActionTitle = nextTask
    ? `建议先做 ${nextTask.name}`
    : needsAttentionTasks.length > 0
      ? `需要处理 ${needsAttentionTasks.length} 项`
      : totalTasksForRate > 0
        ? '建议做 5 分钟复盘'
        : '先安排今日任务';
  const nextActionDesc = nextTask
    ? `${getCategoryLabel(nextTask.category, nextTask.subject)} · 预计 ${nextTask.timePerUnit} 分钟`
    : needsAttentionTasks.length > 0
      ? '先确认未完成原因，再补家长观察和复盘记录。'
      : totalTasksForRate > 0
        ? '今天任务已推进完，可以补充反馈并准备明日计划。'
        : '今日还没有任务，先去学习计划生成或调整任务。';
  const nextActionButtonLabel = nextTask ? '开始下一项' : totalTasksForRate > 0 ? '复盘今日' : '去任务列表';
  const taskFilterTabs: Array<{ value: TaskFilter; label: string; count: number }> = [
    { value: 'all', label: '全部', count: orderedTodayTasks.length },
    { value: 'pending', label: '待完成', count: pendingTasks.length },
    { value: 'attention', label: '需关注', count: needsAttentionTasks.length },
    { value: 'completed', label: '已完成', count: completedTasks.length },
  ];
  const displayName = selectedChild?.name || user?.name || '家长';
  const todayStudyMinutes = stats?.todayStudyMinutes || 0;
  const stabilityRecords = todayCheckins
    .map((checkin: Checkin) => checkin.metadata || {})
    .filter((metadata: Record<string, any>) => metadata.sleepHours || metadata.mood || metadata.externalLoad);
  const latestStabilityRecord = stabilityRecords[stabilityRecords.length - 1] as Record<string, any> | undefined;
  const averageSleepHours = stabilityRecords
    .map((metadata: Record<string, any>) => Number(metadata.sleepHours))
    .filter((value: number) => Number.isFinite(value) && value > 0);
  const sleepSummary = averageSleepHours.length > 0
    ? `${(averageSleepHours.reduce((sum: number, value: number) => sum + value, 0) / averageSleepHours.length).toFixed(1)}h`
    : '未记录';
  const moodSummary = latestStabilityRecord?.mood ? moodLabelMap[latestStabilityRecord.mood] || latestStabilityRecord.mood : '未记录';
  const externalLoadSummary = latestStabilityRecord?.externalLoad ? externalLoadLabelMap[latestStabilityRecord.externalLoad] || latestStabilityRecord.externalLoad : '无明显外部负载';
  const cognitiveRecords = todayCheckins
    .map((checkin: Checkin) => checkin.metadata || {})
    .filter((metadata: Record<string, any>) => metadata.attemptCount || metadata.usedHint !== undefined || metadata.cognitiveError || metadata.reviewQuality);
  const latestCognitiveRecord = cognitiveRecords[cognitiveRecords.length - 1] as Record<string, any> | undefined;
  const attemptValues = cognitiveRecords
    .map((metadata: Record<string, any>) => Number(metadata.attemptCount))
    .filter((value: number) => Number.isFinite(value) && value > 0);
  const attemptSummary = attemptValues.length > 0
    ? `${(attemptValues.reduce((sum: number, value: number) => sum + value, 0) / attemptValues.length).toFixed(1)} 次`
    : '未记录';
  const hintSummary = latestCognitiveRecord?.usedHint === undefined
    ? '未记录'
    : latestCognitiveRecord.usedHint ? '使用提示' : '未用提示';
  const reviewSummary = latestCognitiveRecord?.reviewQuality ? reviewQualityLabelMap[latestCognitiveRecord.reviewQuality] || latestCognitiveRecord.reviewQuality : '未记录';
  const yesterdayDelta = formatMinuteDelta(todayStudyMinutes, yesterdayStats?.todayStudyMinutes);
  const lastWeekDelta = formatMinuteDelta(todayStudyMinutes, lastWeekStats?.todayStudyMinutes);
  const readinessSuggestions = (() => {
    const suggestions: Array<{ title: string; desc: string; icon: ReactNode; tone: string; action: string }> = [];
    if (needsAttentionTasks.length > 0) {
      suggestions.push({
        title: '修复执行断裂',
        desc: `今天有 ${needsAttentionTasks.length} 项部分完成、未完成或推迟，先缩小任务颗粒度，恢复完成节奏。`,
        icon: <AlertCircle className="h-4 w-4" />,
        tone: 'bg-amber-50 text-amber-700 ring-amber-100',
        action: '修复',
      });
    }
    if (completionRate >= 85 && totalTasksForRate >= 4) {
      suggestions.push({
        title: '维持当前节奏',
        desc: '今日完成率稳定，建议保留核心任务，不急着继续加量。',
        icon: <CheckCircle2 className="h-4 w-4" />,
        tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        action: '维持',
      });
    }
    if (remainingMinutes >= 90) {
      suggestions.push({
        title: '检查今日负荷',
        desc: `剩余预计 ${remainingMinutes} 分钟，若孩子状态一般，优先保交付层核心任务。`,
        icon: <HeartPulse className="h-4 w-4" />,
        tone: 'bg-rose-50 text-rose-700 ring-rose-100',
        action: '减压',
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({
        title: '证据继续积累',
        desc: '当前没有明显风险，继续记录完成质量、复盘和孩子反馈，后续用于判断趋势。',
        icon: <Lightbulb className="h-4 w-4" />,
        tone: 'bg-blue-50 text-blue-700 ring-blue-100',
        action: '观察',
      });
    }
    return suggestions.slice(0, 3);
  })();

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
                {displayName} · {getEducationStageLabel(selectedEducationStage)} · {selectedDate}
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

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">今日完成进度</h2>
              <p className="mt-1 text-sm text-slate-500">先看今天是否能交付。</p>
            </div>
            <span className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{statsLoading ? 0 : completionRate}%</span>
          </div>
          <div className="mt-5">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${statsLoading ? 0 : completionRate}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">任务完成</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{completedCount}/{totalTasksForRate} 项</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">学习时长</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{todayStudyMinutes} 分钟</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">剩余任务</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{remainingTasks} 项</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">预计还需</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{remainingMinutes} 分钟</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">下一步行动</h2>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-sm font-semibold text-blue-900">{nextActionTitle}</p>
            <p className="mt-2 min-h-10 text-sm leading-5 text-blue-700">{nextActionDesc}</p>
          </div>
          <Button
            className="mt-4 h-11 w-full rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => {
              if (nextTask) handleStartFocus(nextTask);
              else if (totalTasksForRate > 0) navigate('/parent/reading');
              else navigate('/parent/tasks');
            }}
          >
            <Play className="mr-1.5 h-4 w-4" />
            {nextActionButtonLabel}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">状态提醒</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                <HeartPulse className="h-4 w-4" />
                稳定性风险
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-700">睡眠 {sleepSummary} · 情绪 {moodSummary} · 负载 {externalLoadSummary}</p>
            </div>
            <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-800">
                <Brain className="h-4 w-4" />
                认知记录
              </p>
              <p className="mt-1 text-xs leading-5 text-violet-700">尝试 {attemptSummary} · {hintSummary} · 复盘 {reviewSummary}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                <AlertCircle className="h-4 w-4" />
                数据缺口
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-700">
                {cognitiveRecords.length === 0 || stabilityRecords.length === 0 ? '今日证据还不完整，完成任务时补质量、状态和观察。' : '今日状态和认知证据已有记录。'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">今日任务</h2>
            <p className="mt-1 text-sm text-slate-500">待完成 {pendingTasks.length} 项，需关注 {needsAttentionTasks.length} 项。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {taskFilterTabs.map((tab) => (
              <Button
                key={tab.value}
                variant="outline"
                onClick={() => setTaskFilter(tab.value)}
                className={cn(
                  'h-9 rounded-lg border-slate-200 bg-white px-3 text-sm',
                  taskFilter === tab.value && 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50'
                )}
              >
                {tab.label}
                <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{tab.count}</span>
              </Button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {tasksLoading && todayTasks.length === 0 ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : totalTasksForRate === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-500">
                <Calendar className="h-10 w-10" />
              </div>
              <p className="mt-5 text-base font-semibold text-slate-950">还没有任务安排</p>
              <p className="mt-2 text-sm text-slate-500">从学习计划生成今日任务，或手动添加任务。</p>
              <Button onClick={() => navigate('/parent/tasks')} className="mt-5 rounded-lg bg-primary px-6 text-white hover:bg-primary/90">
                去任务列表
              </Button>
            </div>
          ) : visibleTodayTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              当前筛选下没有任务
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {visibleTodayTasks.map((task) => (
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="flex min-h-[360px] flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">本周趋势简版</h2>
            <span className="rounded-lg bg-slate-50 px-3 py-1 text-sm text-slate-600">学习时长</span>
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

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <section>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              今日建议
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{stageAdviceText}</p>
            <div className="mt-4 space-y-2">
              {readinessSuggestions.map((item) => (
                <div key={item.title} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <span className={cn('mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1', item.tone)}>
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5 border-t border-slate-100 pt-5">
            <h2 className="text-base font-semibold text-slate-950">快速操作</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
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
                学习计划
              </Button>
            </div>
          </section>
        </aside>
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

              <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">完成结果</h3>
                  <p className="mt-1 text-xs text-slate-500">必填：状态、用时、质量和难度。</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">完成状态</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['completed', 'partial', 'not_completed', 'postponed', 'not_involved'] as CompletionStatus[]).map((status) => (
                      <Button
                        key={status}
                        variant={completionStatus === status ? 'default' : 'outline'}
                        onClick={() => setCompletionStatus(status)}
                        className={getStatusButtonClass(status, completionStatus)}
                      >
                        {status === 'completed' ? '全部完成' : taskStatusLabelMap[status]}
                      </Button>
                    ))}
                  </div>
                </div>

                {!['postponed', 'not_completed', 'not_involved'].includes(completionStatus) && (
                  <div className="grid gap-3 sm:grid-cols-2">
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
                  <div className="grid gap-3 sm:grid-cols-2">
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
                  <div className="space-y-2">
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
                </div>

              {!['not_involved'].includes(completionStatus) && (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">反馈记录</h3>
                    <p className="mt-1 text-xs text-slate-500">建议填：孩子反馈和家长观察。</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">孩子反馈</Label>
                    <Input
                      value={completionData.childFeedback}
                      onChange={(e) => setCompletionData({ ...completionData, childFeedback: e.target.value })}
                      placeholder="例如：今天计算有点慢，但能坚持做完"
                      className="rounded-lg border-slate-200 focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">家长观察</Label>
                    <Textarea
                      value={completionData.notes}
                      onChange={(e) => setCompletionData({ ...completionData, notes: e.target.value })}
                      placeholder="记录状态、卡点、需要调整的地方，后续可用于复盘分析"
                      rows={3}
                      className="w-full rounded-lg border-slate-200 focus:ring-2 focus:ring-primary/30 focus:border-primary p-3"
                    />
                  </div>
                </div>
              )}

              <details className="group rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">1.9 证据</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">可选：稳定性、认知记录和证据上传。</span>
                  </span>
                  <span className="text-xs font-semibold text-slate-700 group-open:hidden">展开</span>
                  <span className="text-xs font-semibold text-slate-700 hidden group-open:inline">收起</span>
                </summary>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-emerald-700">稳定性记录</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">昨晚睡眠时长（小时）</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={completionData.sleepHours}
                      onChange={(e) => setCompletionData({ ...completionData, sleepHours: e.target.value })}
                      placeholder="例如 9 或 8.5"
                      className="rounded-lg border-slate-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">情绪状态</Label>
                    <select
                      value={completionData.mood}
                      onChange={(e) => setCompletionData({ ...completionData, mood: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      {moodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">外部负载</Label>
                    <select
                      value={completionData.externalLoad}
                      onChange={(e) => setCompletionData({ ...completionData, externalLoad: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      {externalLoadOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>

                  <p className="mt-5 text-xs font-semibold text-violet-700">认知记录</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">尝试次数</Label>
                    <Input
                      type="number"
                      min="0"
                      value={completionData.attemptCount}
                      onChange={(e) => setCompletionData({ ...completionData, attemptCount: e.target.value })}
                      placeholder="第几次做对"
                      className="rounded-lg border-slate-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">是否使用提示</Label>
                    <select
                      value={completionData.usedHint}
                      onChange={(e) => setCompletionData({ ...completionData, usedHint: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">未记录</option>
                      <option value="no">未使用提示</option>
                      <option value="yes">使用提示</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">主要错因</Label>
                    <select
                      value={completionData.cognitiveError}
                      onChange={(e) => setCompletionData({ ...completionData, cognitiveError: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      {cognitiveErrorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">复盘质量</Label>
                    <select
                      value={completionData.reviewQuality}
                      onChange={(e) => setCompletionData({ ...completionData, reviewQuality: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      {reviewQualityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>

                  <p className="mt-5 text-xs font-semibold text-slate-700">证据上传</p>
                  {!['postponed', 'not_completed', 'not_involved'].includes(completionStatus) ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
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
                          <label htmlFor="evidence-upload" className="flex-1 cursor-pointer">
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

                      <p className="text-xs text-gray-500">支持图片、音频、视频、PDF、Excel 和 PPT，最大 10MB</p>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">当前状态不需要上传证据。</p>
                  )}
                </div>
              </details>

              <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
                <Label className="text-sm font-medium text-slate-700">完成日期</Label>
	                <DatePicker
	                  value={completionData.date}
	                  onChange={(date) => setCompletionData({ ...completionData, date })}
	                  className="w-full"
	                  align="start"
	                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)} className="h-11 rounded-lg px-5">
                  取消
                </Button>
                <Button onClick={handleCompleteTask} className="h-11 rounded-lg bg-primary px-6 text-primary-foreground hover:bg-primary/90 shadow-sm">
                  保存记录
                </Button>
              </div>
            </div>
          )}
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
