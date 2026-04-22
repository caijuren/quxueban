import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { Clock, CheckCircle2, ClipboardList, BookOpen, Plus, GraduationCap, Star, BookMarked, Dumbbell, X, Calendar, Send, Brain, Download, Loader2, Camera, Image, Mic, FileText, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-3 h-3" />
            已完成
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            <CheckCircle2 className="w-3 h-3" />
            部分完成
          </span>
        );
      case 'postponed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
            <Clock className="w-3 h-3" />
            推迟
          </span>
        );
      case 'not_completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-rose-100 text-rose-700">
            <X className="w-3 h-3" />
            未完成
          </span>
        );
      case 'not_involved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
            <Clock className="w-3 h-3" />
            今日不涉及
          </span>
        );
      default:
        return null;
    }
  };

  const isCompleted = status === 'completed' || status === 'partial';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow group cursor-pointer ${
        isCompleted ? 'border-emerald-200 bg-emerald-50/30' : 'border-border'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* 左侧图标 */}
          <div className={`flex-shrink-0 ${isCompleted ? 'opacity-70' : ''}`}>
            {getTaskIcon(task.category)}
          </div>
          
          {/* 任务内容 */}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className={`font-medium text-sm ${isCompleted ? 'text-emerald-900 line-through decoration-emerald-400' : 'text-foreground'}`}>
                {task.name}
              </h3>
              {getStatusBadge()}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {task.category && (
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                  isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-foreground'
                }`}>
                  {task.category}
                </span>
              )}
              {task.scheduleRule && (
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                  isCompleted ? 'bg-emerald-100/50 text-emerald-600' : 'bg-blue-100 text-blue-800'
                }`}>
                  {task.scheduleRule === 'daily' ? '每日' : 
                   task.scheduleRule === 'school' ? '在校日' : 
                   task.scheduleRule === 'weekend' ? '周末' : '智能'}
                </span>
              )}
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                isCompleted 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {actualTime !== undefined ? `${actualTime}分钟` : `${task.timePerUnit}分钟`}
              </span>
            </div>
          </div>
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
    const checkin = todayCheckins.find((c: Checkin) => c.taskId === task.id);

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
      toast.error('分享失败，请稍后重试');
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
      const checkin = todayCheckins.find((c: Checkin) => c.taskId === parseInt(t.id));
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
  const greeting = getGreeting();
  const displayName = selectedChild?.name || user?.name || '家长';

  return (
    <div className="space-y-6" ref={pageRef}>
      {/* 问候栏 */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {greeting}，{displayName}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{getFormattedDate()}</p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <Input
              id="date-select"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[190px] rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {selectedDate !== getLocalDateString(new Date()) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(getLocalDateString(new Date()))}
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              >
                返回今天
              </Button>
            )}
          </div>
          <Button size="sm" onClick={handleAIAnalysis} className="bg-purple-600 text-white hover:bg-purple-700">
            <Brain className="size-4 mr-1" />
            {aiAnalysisLoading ? '分析中...' : 'AI分析'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleShareToDingTalk} className="border-gray-200 hover:bg-gray-50">
            <Send className="size-4 mr-1" />
            分享到钉钉
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExportDialogOpen(true)} className="border-gray-200 hover:bg-gray-50">
            <Download className="size-4 mr-1" />
            导出
          </Button>
        </div>
      </div>

      {/* 1. 核心指标行 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="当日任务"
          value={statsLoading ? '...' : `${completedCount}/${totalTasksForRate}`}
          subtext="已完成/总任务"
          icon={ClipboardList}
          color="purple"
          className={cardClassName}
        />
        <MetricCard
          title="今日学习时长"
          value={statsLoading ? '...' : formatStudyTime(stats?.todayStudyMinutes || 0)}
          subtext={selectedChild ? `${selectedChild.name}的今日数据` : '全部孩子'}
          icon={Clock}
          color="blue"
          className={cardClassName}
        />
        <MetricCard
          title="当日完成率"
          value={statsLoading ? '...' : `${totalTasksForRate > 0 ? Math.round((completedCount / totalTasksForRate) * 100) : 0}%`}
          subtext="今日任务完成情况"
          icon={CheckCircle2}
          color="green"
          className={cardClassName}
        />
        <MetricCard
          title="当日阅读情况"
          value={statsLoading ? '...' : `${stats?.todayReadingCount || 0}本`}
          subtext="今日阅读书籍"
          icon={BookOpen}
          color="orange"
          className={cardClassName}
        />
      </div>

      {/* 2. 任务模块（按状态分类展示） */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">当日任务</h2>
          {tasksLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载中...
            </div>
          )}
        </div>

        {/* 加载状态 */}
        {tasksLoading && todayTasks.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-border p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 待完成任务 */}
        {!tasksLoading && pendingTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-sm font-medium text-blue-700">
                待完成 ({pendingTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {pendingTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task.task}
                  status={task.status as 'pending'}
                  onClick={() => handleTaskClick(task.task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 已完成任务 */}
        {!tasksLoading && completedTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-sm font-medium text-emerald-700">
                已完成 ({completedTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {completedTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task.task}
                  status="completed"
                  actualTime={task.actualTime}
                  onClick={() => handleTaskClick(task.task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 部分完成任务 */}
        {!tasksLoading && partialTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="text-sm font-medium text-amber-700">
                部分完成 ({partialTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {partialTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task.task}
                  status="partial"
                  actualTime={task.actualTime}
                  onClick={() => handleTaskClick(task.task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 未完成任务 */}
        {!tasksLoading && notCompletedTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
                <X className="w-4 h-4 text-rose-600" />
              </div>
              <h3 className="text-sm font-medium text-rose-700">
                未完成 ({notCompletedTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {notCompletedTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task.task}
                  status="not_completed"
                  actualTime={0}
                  onClick={() => handleTaskClick(task.task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 推迟任务 */}
        {!tasksLoading && postponedTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-600" />
              </div>
              <h3 className="text-sm font-medium text-orange-700">
                推迟 ({postponedTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {postponedTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task.task}
                  status="postponed"
                  actualTime={task.actualTime}
                  onClick={() => handleTaskClick(task.task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 今日不涉及任务 */}
        {!tasksLoading && notInvolvedTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-slate-600" />
              </div>
              <h3 className="text-sm font-medium text-slate-700">
                今日不涉及 ({notInvolvedTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {notInvolvedTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task.task}
                  status="not_involved"
                  actualTime={0}
                  onClick={() => handleTaskClick(task.task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 无任务提示 - 优化版 */}
        {!tasksLoading && totalTasksForRate === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50/70 to-slate-100/50 py-16 text-center">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              {selectedDate === getLocalDateString(new Date()) 
                ? '今天还没有安排学习任务' 
                : '该日期没有安排学习任务'}
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              {selectedDate === getLocalDateString(new Date()) 
                ? '为孩子制定学习计划，让学习更有条理。您可以从任务管理开始，或前往学习计划生成今日安排。'
                : '您可以切换到其他日期查看任务，或为该日期添加新的学习计划。'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => navigate('/parent/tasks')}
                className="rounded-xl border-slate-300 hover:bg-slate-50"
              >
                <Plus className="mr-2 size-4" />
                去任务管理
              </Button>
              <Button 
                onClick={() => navigate('/parent/plans')}
                className="rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
              >
                <Calendar className="mr-2 size-4" />
                去学习计划
              </Button>
            </div>
          </div>
        )}
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
