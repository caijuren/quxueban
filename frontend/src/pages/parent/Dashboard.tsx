import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { Clock, CheckCircle2, ClipboardList, BookOpen, Plus, GraduationCap, Star, BookMarked, Dumbbell, X, Calendar, Send, Brain, Download, Loader2, Camera, Image, Mic, FileText, XCircle, MoreHorizontal, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExportDialog } from '@/components/ExportDialog';
import { toast } from 'sonner';
import { startOfWeek } from 'date-fns';

// Components
import { MetricCard } from '@/components/ui/metric-card';

// Task Category Icons
const getTaskIcon = (category: string) => {
  switch (category) {
    case 'school':
    case '校内巩固':
      return <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>;
    case 'advanced':
    case '校内拔高':
      return <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-purple-600" /></div>;
    case 'extra':
    case '课外课程':
      return <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><Star className="w-5 h-5 text-orange-600" /></div>;
    case 'english':
    case '英语阅读':
      return <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-purple-600" /></div>;
    case 'chinese':
    case '中文阅读':
      return <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-pink-600" /></div>;
    case 'sports':
    case '体育运动':
      return <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Dumbbell className="w-5 h-5 text-green-600" /></div>;
    case 'flexible':
    case '灵活安排':
      return <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center"><Calendar className="w-5 h-5 text-yellow-600" /></div>;
    case 'other':
    case '其他':
      return <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-gray-600" /></div>;
    default:
      return <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-gray-600" /></div>;
  }
};

// Task Card Component
function TaskCard({ 
  task, 
  onClick, 
  actualTime, 
  status = 'pending' 
}: { 
  task: Task; 
  onClick: () => void; 
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
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${isCompleted ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>
            {task.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {actualTime !== undefined ? `实际 ${actualTime} 分钟` : `预计 ${task.timePerUnit} 分钟`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
          {statusMeta.label}
        </span>
      </div>
    </button>
  );
}

// Types
interface DashboardStats {
  totalTasks: number;
  weeklyCompletionRate: number;
  todayStudyMinutes: number;
  booksRead: number;
  todayReadingCount: number;
}

interface Task {
  id: number;
  name: string;
  category: string;
  scheduleRule: string;
  timePerUnit: number;
  appliesTo: number[];
}

interface Checkin {
  id: number;
  taskId: number;
  status: 'completed' | 'partial' | 'postponed' | 'not_completed' | 'not_involved' | 'pending';
  completedValue?: number;
  notes?: string;
}

interface CheckinPayload {
  taskId: number;
  childId: number | undefined | null;
  status: string;
  value: number;
  completedValue: number | undefined | null;
  notes: string;
  date: string;
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function getFormattedDate(): string {
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;
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

const cardClassName = 'rounded-[10px] border-[#eaedf3] shadow-none hover:shadow-sm';

type CompletionStatus = 'completed' | 'partial' | 'postponed' | 'not_completed' | 'not_involved';

function getStatusButtonClass(status: CompletionStatus, currentStatus: CompletionStatus): string {
  const isActive = status === currentStatus;
  if (isActive) {
    return 'rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white';
  }
  return 'rounded-xl border-gray-200 hover:bg-gray-50';
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
    notes: '',
    date: getLocalDateString(new Date()),
    evidence: null as File | null,
    evidenceUrl: '' as string
  });
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

  // 概览统计数据
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats', selectedChildId, selectedDate],
    queryFn: async () => {
      const response = await apiClient.get(`/dashboard/stats?date=${selectedDate}&childId=${selectedChildId}`);
      return response.data.data as DashboardStats;
    },
    staleTime: 2 * 60 * 1000,
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
      // 如果找到签到记录，填充上次的数据
      setCompletionStatus(checkin.status);
      setCompletionData({
        actualTime: checkin.completedValue ? checkin.completedValue.toString() : '',
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
        notes: '',
        date: selectedDate,
        evidence: null,
        evidenceUrl: ''
      });
    }
    
    setOpen(true);
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
          notes: completionData.notes,
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
  const nextActions = pendingTasks.slice(0, 2);
  const greeting = getGreeting();
  const displayName = selectedChild?.name || user?.name || '家长';

  return (
    <div className="space-y-5" ref={pageRef}>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg font-semibold text-slate-700">
              {selectedChild?.avatar || displayName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{getFormattedDate()}</p>
              <h1 className="mt-1 truncate text-xl font-semibold text-slate-950">
                {greeting}，{displayName}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {remainingTasks > 0
                  ? `今天还有 ${remainingTasks} 项待处理，预计 ${remainingMinutes} 分钟`
                  : totalTasksForRate > 0
                    ? '今天的核心任务已经处理完'
                    : '今天还没有安排学习任务'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="date-select"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 w-[170px] rounded-lg border-slate-200"
            />
            {selectedDate !== getLocalDateString(new Date()) && (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(getLocalDateString(new Date()))} className="rounded-lg">
                返回今天
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => nextActions[0] ? handleTaskClick(nextActions[0].task) : navigate('/parent/plans')}
              className="rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              {nextActions[0] ? '继续任务' : '安排计划'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleAIAnalysis}>
                  <Brain className="mr-2 h-4 w-4" />
                  {aiAnalysisLoading ? '分析中...' : 'AI分析'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareToDingTalk}>
                  <Send className="mr-2 h-4 w-4" />
                  分享到钉钉
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600">今日完成进度</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{statsLoading ? '...' : `${completionRate}%`}</p>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>{completedCount}/{totalTasksForRate} 项</p>
                <p className="mt-1">{formatStudyTime(stats?.todayStudyMinutes || 0)}</p>
              </div>
            </div>
            <Progress value={completionRate} className="mt-4 h-2" />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">下一步关键行动</h2>
                <p className="mt-1 text-sm text-slate-500">优先处理还未完成的今日任务。</p>
              </div>
              {tasksLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>

            {nextActions.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {nextActions.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleTaskClick(task.task)}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-slate-300 hover:bg-white"
                  >
                    <p className="text-sm font-semibold text-slate-950">{task.title}</p>
                    <p className="mt-2 text-sm text-slate-500">预计 {task.task.timePerUnit} 分钟</p>
                    <span className="mt-4 inline-flex items-center text-sm font-medium text-slate-900">
                      继续
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">
                  {totalTasksForRate > 0 ? '当前没有待处理任务' : '今天还没有安排学习任务'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/parent/tasks')} className="rounded-lg">
                    去任务管理
                  </Button>
                  <Button size="sm" onClick={() => navigate('/parent/plans')} className="rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                    去学习计划
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">今日任务</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/parent/tasks')} className="rounded-lg text-slate-600">
                全部任务
              </Button>
            </div>

            {tasksLoading && todayTasks.length === 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : totalTasksForRate === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-800">没有今日任务</p>
                <p className="mt-1 text-sm text-slate-500">可以从学习计划生成今日安排，或在任务管理中添加任务。</p>
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {pendingTasks.length > 0 && (
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-700">待处理 ({pendingTasks.length})</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {pendingTasks.map(task => (
                        <TaskCard key={task.id} task={task.task} status="pending" onClick={() => handleTaskClick(task.task)} />
                      ))}
                    </div>
                  </div>
                )}

                {needsAttentionTasks.length > 0 && (
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      需要处理 ({needsAttentionTasks.length})
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {needsAttentionTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task.task}
                          status={task.status as any}
                          actualTime={task.actualTime}
                          onClick={() => handleTaskClick(task.task)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {completedTasks.length > 0 && (
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-700">已完成 ({completedTasks.length})</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {completedTasks.map(task => (
                        <TaskCard key={task.id} task={task.task} status="completed" actualTime={task.actualTime} onClick={() => handleTaskClick(task.task)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">今日摘要</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">待完成</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{remainingTasks}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">剩余预计</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{remainingMinutes}m</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">学习时长</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{stats?.todayStudyMinutes || 0}m</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">阅读</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{stats?.todayReadingCount || 0}本</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">AI 简报</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {needsAttentionTasks.length > 0
                ? `今天有 ${needsAttentionTasks.length} 项需要处理，建议先确认原因，再安排补做或调整。`
                : remainingTasks > 0
                  ? `今天还有 ${remainingTasks} 项待处理，建议先完成预计时间较短的任务。`
                  : '今日任务状态平稳，可以继续保持节奏。'}
            </p>
            <Button variant="outline" size="sm" onClick={handleAIAnalysis} className="mt-4 rounded-lg">
              查看分析
            </Button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">工具</h2>
            <div className="mt-4 grid gap-2">
              <Button variant="outline" onClick={handleShareToDingTalk} className="justify-start rounded-lg">
                <Send className="mr-2 h-4 w-4" />
                分享到钉钉
              </Button>
              <Button variant="outline" onClick={() => setExportDialogOpen(true)} className="justify-start rounded-lg">
                <Download className="mr-2 h-4 w-4" />
                导出首页
              </Button>
            </div>
          </section>
        </aside>
      </div>

      {/* 任务完成弹窗 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-500" />
              完成任务
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-6 py-4">
              {/* 任务信息 */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedTask.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{selectedTask.timePerUnit}分钟</span>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{selectedTask.category}</span>
                </div>
              </div>

              {/* 完成状态 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">完成状态</Label>
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
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">实际用时（分钟）</Label>
                  <Input
                    type="number"
                    min="0"
                    value={completionData.actualTime}
                    onChange={(e) => setCompletionData({ ...completionData, actualTime: e.target.value })}
                    placeholder="输入实际用时"
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* 备注 */}
              {!['postponed', 'not_completed', 'not_involved'].includes(completionStatus) && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">备注（可选）</Label>
                  <Textarea
                    value={completionData.notes}
                    onChange={(e) => setCompletionData({ ...completionData, notes: e.target.value })}
                    placeholder="添加任务完成备注..."
                    rows={3}
                    className="w-full rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent p-3"
                  />
                </div>
              )}

              {/* 完成日期 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">完成日期</Label>
                <Input
                  type="date"
                  value={completionData.date}
                  onChange={(e) => setCompletionData({ ...completionData, date: e.target.value })}
                  className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* 证据上传 */}
              {!['postponed', 'not_completed', 'not_involved'].includes(completionStatus) && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">添加证据（可选）</Label>
                  
                  {/* 已上传的证据预览 */}
                  {completionData.evidenceUrl && (
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-gray-600">已上传证据</span>
                        </div>
                        <a 
                          href={completionData.evidenceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-purple-600 hover:text-purple-700"
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
                        accept="image/*,audio/*,video/*,.pdf"
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
                          className="w-full rounded-xl border-dashed border-2 hover:border-purple-500 hover:bg-purple-50"
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
                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-gray-700 truncate max-w-[200px]">
                            {completionData.evidence.name}
                          </span>
                          <span className="text-xs text-gray-500">
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
                    支持图片、音频、视频和 PDF，最大 10MB
                  </p>
                </div>
              )}

              {/* 提交按钮 */}
              <Button
                onClick={handleCompleteTask}
                className="w-full rounded-xl h-11 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25"
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
        <DialogContent className="sm:max-w-2xl rounded-3xl border-0 shadow-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              AI学习分析
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {aiAnalysisLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
              </div>
            ) : aiAnalysisData ? (
              <div className="space-y-6">
                <div className="bg-purple-50 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-purple-800 mb-2">总体评价</h3>
                  <p className="text-gray-700">{aiAnalysisData.overallEvaluation}</p>
                </div>
                
                <div className="bg-blue-50 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">任务完成分析</h3>
                  <p className="text-gray-700">{aiAnalysisData.taskCompletionAnalysis}</p>
                </div>
                
                <div className="bg-green-50 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">学习效率分析</h3>
                  <p className="text-gray-700">{aiAnalysisData.learningEfficiencyAnalysis}</p>
                </div>
                
                <div className="bg-yellow-50 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">学习亮点</h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    {(Array.isArray(aiAnalysisData.strengths) ? aiAnalysisData.strengths : []).map((strength: string, index: number) => (
                      <li key={index}>{strength}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-orange-50 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-orange-800 mb-2">改进建议</h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    {(Array.isArray(aiAnalysisData.improvementSuggestions) ? aiAnalysisData.improvementSuggestions : []).map((suggestion: string, index: number) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-indigo-50 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-indigo-800 mb-2">明日计划建议</h3>
                  <p className="text-gray-700">{aiAnalysisData.tomorrowPlan}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-12">
                <p className="text-gray-500">暂无分析数据</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-center pt-4">
            <Button 
              type="button" 
              onClick={() => setAiAnalysisOpen(false)}
              className="w-full rounded-xl h-11 bg-gray-600 hover:bg-gray-700 text-white"
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
