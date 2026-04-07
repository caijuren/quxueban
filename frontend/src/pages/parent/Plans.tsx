import { useState, useMemo } from 'react';
import { PublishPlanDialog } from '@/components/PublishPlanDialog';
import { Plus, X, ChevronDown, Send, Trash2, Move, CalendarDays, Download, AlertTriangle, Clock, Target, BookOpen, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, startOfWeek, addWeeks, addDays, isToday, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Calendar as DayPickerCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TaskAllocation {
  taskId: string;
  taskName: string;
  category: string;
  timePerUnit: number;
  assignedDays: number[];
  target: number;
  progress: number;
  subject: string | null;
  difficulty: string | null;
  isTemporary: boolean;
  scheduleRule: string;
}

interface WeeklyPlan {
  id: string;
  childId: string;
  childName: string;
  weekStartDate: string;
  allocations: TaskAllocation[];
  dailyProgress: { day: number; completed: number; total: number }[];
}

interface TaskDetailProps {
  task: TaskAllocation;
  weekStartDate: Date;
  onClose: () => void;
  onRefresh: () => void;
}

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const subjectLabel = (s: string | null) => s === 'chinese' ? '语文' : s === 'math' ? '数学' : s === 'english' ? '英语' : s === 'sports' ? '体育' : s || '其他';
const subjectColor = (s: string | null) => s === 'chinese' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : s === 'math' ? 'bg-blue-100 text-blue-700 border-blue-200' : s === 'english' ? 'bg-purple-100 text-purple-700 border-purple-200' : s === 'sports' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-600 border-gray-200';
const diffLabel = (d: string | null) => d === 'basic' ? '基础' : d === 'advanced' ? '提升' : d === 'challenge' ? '挑战' : '';
const ruleLabel = (r: string) => r === 'daily' ? '每日' : r === 'school' ? '上学日' : r === 'flexible' ? '灵活' : r === 'weekend' ? '周末' : r || '每日';

// 优化后的任务详情弹窗
function TaskDetailModal({ task, weekStartDate, onClose, onRefresh }: TaskDetailProps) {
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedMoveDay, setSelectedMoveDay] = useState<number | null>(null);
  const [selectedDayForAction, setSelectedDayForAction] = useState<number | null>(null);

  const assignedDays = useMemo(() => {
    switch (task.scheduleRule) {
      case 'daily': return [0, 1, 2, 3, 4, 5, 6];
      case 'school': return [0, 1, 2, 3, 4];
      case 'flexible': return [0, 1, 2, 3, 4];
      case 'weekend': return [5, 6];
      default: return task.assignedDays.length > 0 ? task.assignedDays : [0, 1, 2, 3, 4, 5, 6];
    }
  }, [task.scheduleRule, task.assignedDays]);

  // 删除某天的安排
  const deleteDayMutation = useMutation({
    mutationFn: async ({ dayIndex }: { dayIndex: number }) => {
      // 计算实际日期（dayIndex 是 0-6 对应周一到周日）
      const date = addDays(weekStartDate, dayIndex);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const response = await apiClient.post('/plans/modify', {
        taskId: task.taskId,
        action: 'remove',
        date: dateStr,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('已删除该日安排');
      setShowDeleteConfirm(false);
      setSelectedDayForAction(null);
      onRefresh();
      onClose();
    },
    onError: (e: unknown) => {
      const error = e as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || '删除失败，请重试');
    },
  });

  // 移动到其他日期
  const moveDayMutation = useMutation({
    mutationFn: async ({ fromDay, toDay }: { fromDay: number; toDay: number }) => {
      const fromDate = addDays(weekStartDate, fromDay);
      const toDate = addDays(weekStartDate, toDay);
      
      const response = await apiClient.post('/plans/modify', {
        taskId: task.taskId,
        action: 'move',
        fromDate: format(fromDate, 'yyyy-MM-dd'),
        toDate: format(toDate, 'yyyy-MM-dd'),
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('已移动到新日期');
      setShowMoveDialog(false);
      setSelectedDayForAction(null);
      setSelectedMoveDay(null);
      onRefresh();
      onClose();
    },
    onError: (e: unknown) => {
      const error = e as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || '移动失败，请重试');
    },
  });

  // 处理删除确认
  const handleDeleteConfirm = () => {
    if (selectedDayForAction !== null) {
      deleteDayMutation.mutate({ dayIndex: selectedDayForAction });
    }
  };

  // 处理移动确认
  const handleMoveConfirm = () => {
    if (selectedDayForAction !== null && selectedMoveDay !== null) {
      moveDayMutation.mutate({ fromDay: selectedDayForAction, toDay: selectedMoveDay });
    }
  };

  return (
    <>
      {/* 主弹窗 */}
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4' onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className='bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden'
          onClick={e => e.stopPropagation()}
        >
          {/* 简洁标题栏 */}
          <div className='px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white'>
            <div className='flex items-center gap-3'>
              {task.isTemporary && <span className='text-amber-500 text-lg'>⚡</span>}
              <h2 className='text-lg font-semibold text-gray-900'>{task.taskName}</h2>
            </div>
            <button 
              onClick={onClose} 
              className='w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
          
          {/* 内容区 */}
          <div className='p-6 space-y-5'>
            {/* 信息标签区 */}
            <div className='flex flex-wrap gap-2'>
              {task.subject && (
                <span className={cn('text-sm px-3 py-1 rounded-full border font-medium', subjectColor(task.subject))}>
                  {subjectLabel(task.subject)}
                </span>
              )}
              {task.difficulty && (
                <span className='text-sm px-3 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200'>
                  {diffLabel(task.difficulty)}
                </span>
              )}
              {task.isTemporary && (
                <span className='text-sm px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200'>
                  临时任务
                </span>
              )}
            </div>

            {/* 信息列表 */}
            <div className='space-y-3'>
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                <div className='w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center'>
                  <Clock className='w-4 h-4 text-blue-600' />
                </div>
                <div className='flex-1'>
                  <div className='text-xs text-gray-500'>每次时长</div>
                  <div className='text-sm font-semibold text-gray-900'>{task.timePerUnit} 分钟</div>
                </div>
              </div>
              
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                <div className='w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center'>
                  <Target className='w-4 h-4 text-purple-600' />
                </div>
                <div className='flex-1'>
                  <div className='text-xs text-gray-500'>分配规则</div>
                  <div className='text-sm font-semibold text-gray-900'>{ruleLabel(task.scheduleRule)}</div>
                </div>
              </div>
              
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                <div className='w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center'>
                  <BookOpen className='w-4 h-4 text-emerald-600' />
                </div>
                <div className='flex-1'>
                  <div className='text-xs text-gray-500'>本周进度</div>
                  <div className='text-sm font-semibold text-gray-900'>
                    已完成 {task.progress} / {task.target} 次
                    {task.target > 0 && (
                      <span className='ml-2 text-xs text-gray-500'>({Math.round((task.progress / task.target) * 100)}%)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 本周安排 - 带编辑提示 */}
            <div>
              <div className='flex items-center justify-between mb-2'>
                <span className='text-sm font-medium text-gray-700'>本周安排</span>
                <span className='text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1'>
                  <Sparkles className='w-3 h-3' />
                  点击日期可编辑
                </span>
              </div>
              <div className='flex gap-1.5'>
                {weekDays.map((d, i) => {
                  const isAssigned = assignedDays.includes(i);
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        if (isAssigned) {
                          setSelectedDayForAction(selectedDayForAction === i ? null : i);
                        }
                      }}
                      className={cn(
                        'flex-1 py-2.5 rounded-lg text-xs font-medium transition-all',
                        isAssigned 
                          ? selectedDayForAction === i 
                            ? 'bg-blue-500 text-white ring-2 ring-blue-300' 
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                      )}
                      disabled={!isAssigned}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              
              {/* 选中日期的快捷操作 */}
              {selectedDayForAction !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className='mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100'
                >
                  <div className='text-sm text-blue-700 mb-2'>
                    已选择：<strong>{weekDays[selectedDayForAction]}</strong>（{format(addDays(weekStartDate, selectedDayForAction), 'M月d日')}）
                  </div>
                  <div className='flex gap-2'>
                    <button
                      onClick={() => setShowMoveDialog(true)}
                      className='flex-1 flex items-center justify-center gap-1.5 py-2 bg-white rounded-lg text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-200'
                    >
                      <Move className='w-4 h-4' />
                      移动到其他日期
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className='flex-1 flex items-center justify-center gap-1.5 py-2 bg-white rounded-lg text-red-600 text-sm font-medium hover:bg-red-50 transition-colors border border-red-200'
                    >
                      <Trash2 className='w-4 h-4' />
                      删除本日安排
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 删除确认弹窗 */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4'
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className='bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden'
              onClick={e => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4'>
                  <AlertTriangle className='w-6 h-6 text-red-600' />
                </div>
                <h3 className='text-lg font-semibold text-center text-gray-900 mb-2'>确认删除？</h3>
                <p className='text-sm text-center text-gray-500 mb-6'>
                  确定要删除 <strong>{weekDays[selectedDayForAction!]}</strong> 的任务安排吗？此操作不可撤销。
                </p>
                <div className='flex gap-3'>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className='flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleteDayMutation.isPending}
                    className='flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50'
                  >
                    {deleteDayMutation.isPending ? '删除中...' : '确认删除'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 移动日期弹窗 */}
      <AnimatePresence>
        {showMoveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4'
            onClick={() => setShowMoveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className='bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden'
              onClick={e => e.stopPropagation()}
            >
              <div className='px-5 py-4 border-b border-gray-100'>
                <h3 className='text-base font-semibold text-gray-900 flex items-center gap-2'>
                  <CalendarDays className='w-5 h-5 text-blue-500' />
                  移动到其他日期
                </h3>
              </div>
              
              <div className='p-5'>
                <p className='text-sm text-gray-600 mb-4'>
                  将 <strong className='text-blue-600'>{weekDays[selectedDayForAction!]}</strong> 的任务移动到：
                </p>
                
                {/* 周历选择器 */}
                <div className='grid grid-cols-7 gap-2 mb-4'>
                  {weekDays.map((d, i) => {
                    const isFromDay = i === selectedDayForAction;
                    const isSelected = selectedMoveDay === i;
                    const dateStr = format(addDays(weekStartDate, i), 'M/d');
                    
                    return (
                      <button
                        key={d}
                        onClick={() => !isFromDay && setSelectedMoveDay(i)}
          disabled={isFromDay}
                        className={cn(
                          'aspect-square rounded-xl flex flex-col items-center justify-center transition-all',
                          isFromDay 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : isSelected 
                              ? 'bg-blue-500 text-white shadow-lg scale-105' 
                              : 'bg-gray-50 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                        )}
                      >
                        <span className='text-xs font-medium'>{d}</span>
                        <span className={cn('text-[10px]', isSelected ? 'text-blue-100' : 'text-gray-400')}>
                          {dateStr}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                {selectedMoveDay !== null && (
                  <div className='text-sm text-center text-gray-600 mb-4 p-2 bg-blue-50 rounded-lg'>
                    → 移动到 <strong className='text-blue-700'>{weekDays[selectedMoveDay]}</strong>
                  </div>
                )}
  
                <div className='flex gap-3'>
                  <button
                    onClick={() => setShowMoveDialog(false)}
                    className='flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleMoveConfirm}
                    disabled={selectedMoveDay === null || moveDayMutation.isPending}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-white font-medium transition-colors',
                      selectedMoveDay === null || moveDayMutation.isPending
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600'
                    )}
                  >
                    {moveDayMutation.isPending ? '移动中...' : '确认移动'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

async function fetchWeeklyPlan(weekStart: string): Promise<WeeklyPlan[]> {
  const response = await apiClient.get(`/plans/week/${weekStart}`);
  return response.data.data || [];
}

export default function PlansPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskAllocation | null>(null);
  const [tempDialogOpen, setTempDialogOpen] = useState(false);
  const [tempUrgency, setTempUrgency] = useState('normal');
  const [isExporting, setIsExporting] = useState(false);

  const { data: planTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await apiClient.get('/tasks');
      return res.data.data || [];
    },
    staleTime: 60 * 1000,
  });

  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));
  const isNextWeek = isSameDay(currentWeekStart, startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }));

  const { data: weeklyPlans, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ['weekly-plan', format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: () => fetchWeeklyPlan(format(currentWeekStart, 'yyyy-MM-dd')),
    staleTime: 5 * 60 * 1000
  });

  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDates = useMemo(() => {
    // 调整日期，使其与 weekDays 数组顺序一致（周日开始）
    return weekDays.map((_, index) => {
      // currentWeekStart 是周一开始，所以周日需要减 1 天
      if (index === 0) {
        return addDays(currentWeekStart, -1);
      }
      return addDays(currentWeekStart, index - 1);
    });
  }, [currentWeekStart]);
  const weekLabel = `${format(currentWeekStart, 'M月d日', { locale: zhCN })} - ${format(addDays(currentWeekStart, 6), 'M月d日', { locale: zhCN })}`;

  // 导出为 PNG
  const handleExportPNG = async () => {
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const element = document.getElementById('weekly-plan-view');
      if (!element) {
        toast.error('未找到导出内容');
        setIsExporting(false);
        return;
      }
      const canvas = await html2canvas(element);
      const link = document.createElement('a');
      link.download = `周计划_${format(currentWeekStart, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" id="weekly-plan-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">计划管理</h1>
          <p className="text-gray-500 mt-1">查看和管理每周学习计划</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setTempDialogOpen(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl px-5 h-10 shadow-lg shadow-amber-500/25">
            <Plus className="w-5 h-5 mr-1" />
            <span>临时任务</span>
          </Button>
          <Button onClick={handleExportPNG} disabled={isExporting} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl px-5 h-10 shadow-lg shadow-emerald-500/25">
            <Download className="w-5 h-5 mr-1" />
            <span>{isExporting ? '导出中...' : '导出'}</span>
          </Button>
          <Button onClick={() => setPublishDialogOpen(true)} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl px-5 h-10 shadow-lg shadow-purple-500/25">
            <Plus className="w-5 h-5 mr-1" />
            <span>发布计划</span>
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {plansLoading ? (
        <Card className="border-0 shadow-lg rounded-3xl">
          <CardContent className="p-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(weeklyPlans && weeklyPlans.length > 0 ? weeklyPlans : [{id: "empty", childId: "0", childName: "学习计划", allocations: [], dailyProgress: []}]).map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-gray-900">
                      {plan.childName}的学习计划
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                            <span className="text-sm text-gray-600">{weekLabel}</span>
                            <ChevronDown className="size-4 text-gray-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-0 shadow-xl rounded-2xl" align="end">
                          <div className="p-3 border-b border-gray-100">
                            <div className="flex gap-2">
                              <button onClick={() => goToCurrentWeek()} className={cn("flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors", isCurrentWeek ? "bg-purple-100 text-purple-700" : "text-gray-600 hover:bg-gray-100")}>本周</button>
                              <button onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))} className={cn("flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors", isNextWeek ? "bg-purple-100 text-purple-700" : "text-gray-600 hover:bg-gray-100")}>下周</button>
                              <button onClick={() => setCurrentWeekStart(prev => addWeeks(prev, -1))} className="flex-1 text-center py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">上周</button>
                            </div>
                          </div>
                          <DayPickerCalendar
                            mode="single"
                            selected={currentWeekStart}
                            onSelect={(date: Date | undefined) => {
                              if (date) {
                                const day = date.getDay();
                                const mondayOffset = day === 0 ? -6 : 1 - day;
                                const monday = new Date(date);
                                monday.setDate(monday.getDate() + mondayOffset);
                                setCurrentWeekStart(monday);
                              }
                            }}
                            className="rounded-2xl p-3"
                            classNames={{
                              day_selected: "bg-gradient-to-br from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 rounded-lg",
                              day_today: "bg-purple-100 text-purple-700 font-bold rounded-lg",
                              nav_button: "h-8 w-8 rounded-lg hover:bg-gray-100",
                              caption: "flex justify-center pt-1 relative items-center w-full",
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      {plan.childId !== "0" && (
                        <button
                          onClick={async () => {
                            try {
                              await apiClient.post('/dingtalk/push-weekly-plan', { childId: parseInt(plan.childId), weekStartDate: currentWeekStart.toISOString() });
                              toast.success('已推送至钉钉');
                            } catch (e: unknown) {
                              const error = e as { response?: { data?: { message?: string } } };
                              toast.error(error.response?.data?.message || '推送失败');
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors text-sm font-medium"
                        >
                          <Send className="size-4" />
                          推送
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-6">
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      {/* Day headers */}
                      <div className="grid grid-cols-8 gap-1 mb-2">
                        <div className="p-2"></div>
                        {weekDays.map((day, i) => {
                          const date = weekDates[i];
                          const isTodayDate = isToday(date);
                          const dayTasks = plan.allocations.filter(a => a.assignedDays.includes(i));
                          const dayTotalMin = dayTasks.reduce((s, a) => s + a.timePerUnit, 0);
                          return (
                            <div key={day} className={cn('p-2 text-center rounded-xl', isTodayDate ? 'bg-purple-500 text-white' : 'bg-gray-50')}>
                              <span className={cn('text-[10px]', isTodayDate ? 'text-white/70' : 'text-gray-400')}>{day}</span>
                              <div className={cn('text-sm font-bold', isTodayDate ? 'text-white' : 'text-gray-700')}>{format(date, 'M/d')}</div>
                              {dayTotalMin > 0 && <span className={cn('text-[9px]', isTodayDate ? 'text-white/60' : 'text-gray-400')}>{dayTotalMin}m</span>}
                            </div>
                          );
                        })}
                      </div>
                      {/* 任务排序 */}
                      {plan.allocations.sort((a, b) => {
                        const categoryOrder = {
                          '校内巩固': 0,
                          '课外课程': 1,
                          '中文阅读': 2,
                          '英文阅读': 3,
                          '体育任务': 4,
                          '校内拔高': 5
                        };
                        return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999);
                      }).map((taskItem) => {
                        // 调试：打印 taskItem 结构
                        console.log('Task item:', taskItem);
                        const getDotColor = (dayIndex: number) => {
                          const isAssigned = taskItem.assignedDays && taskItem.assignedDays.includes(dayIndex);
                          if (!isAssigned) return 'bg-gray-300';
                          
                          // 确保 subject 是字符串
                          const subject = taskItem.subject || 'other';
                          const subjectStr = typeof subject === 'string' ? subject.toLowerCase() : 'other';
                          
                          switch (subjectStr) {
                            case 'chinese': return 'bg-emerald-500';
                            case 'math': return 'bg-blue-500';
                            case 'english': return 'bg-orange-500';
                            case 'sports': return 'bg-yellow-500';
                            default: return 'bg-purple-500';
                          }
                        };
                        
                        return (
                          <div key={taskItem.taskId} className="grid grid-cols-8 gap-1 group/row">
                            <div className="p-2 flex items-center text-xs font-medium truncate pr-2" title={taskItem.taskName}>
                              <span className={cn('truncate', taskItem.isTemporary && 'text-amber-500 font-bold')}>
                                {taskItem.isTemporary && <span className="mr-1">⚡</span>}
                                {taskItem.taskName}
                              </span>
                            </div>
                            {weekDays.map((_, i) => {
                              const isAssigned = taskItem.assignedDays && taskItem.assignedDays.includes(i);
                              const dayProgress = plan.dailyProgress.find(d => d.day === i);
                              const isCompleted = isCurrentWeek && dayProgress && isAssigned && dayProgress.completed > 0;
                              const dotColor = getDotColor(i);
                               
                              return (
                                <div key={i} className={cn('p-2 flex items-center justify-center rounded-lg min-h-[40px]', isToday(weekDates[i]) && 'bg-purple-50/50')}>
                                  <div className="relative">
                                    {isAssigned ? (
                                      taskItem.isTemporary ? (
                                        <button onClick={() => setSelectedTask(taskItem)} className={cn('w-6 h-6 rounded-full hover:scale-125 transition-all cursor-pointer shadow-sm bg-amber-500')} title={`${taskItem.taskName} - 临时任务`}>
                                          <span className="text-white text-xs">⚡</span>
                                        </button>
                                      ) : (
                                        <button onClick={() => setSelectedTask(taskItem)} className={cn('w-6 h-6 rounded-full hover:scale-125 transition-all cursor-pointer shadow-sm', isCompleted ? 'bg-emerald-400 ring-2 ring-emerald-200' : dotColor)} title={`${taskItem.taskName} - 点击查看详情`}>
                                          {isCompleted && <span className="text-white text-xs">✓</span>}
                                          {taskItem.difficulty === 'challenge' && !isCompleted && (
                                            <span className="absolute -top-1 -right-1 text-[8px] text-amber-500">★</span>
                                          )}
                                        </button>
                                      )
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-gray-300 shadow-sm"></div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      {plan.allocations.length === 0 && (
                        <div className="py-8 text-center text-gray-400 text-sm">该周暂无任务安排</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Temp Task Dialog */}
      {tempDialogOpen && (
        <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className='bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden'>
            <div className='px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-between'>
              <h3 className='text-lg font-semibold text-white'>临时任务</h3>
              <button onClick={() => setTempDialogOpen(false)} className='w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors'><X className='w-5 h-5' /></button>
            </div>
            <div className='p-6 space-y-4'>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-1.5'>任务名称 <span className='text-red-500'>*</span></label>
                <input id='temp-task-name' type='text' className='w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 outline-none text-gray-900 text-sm' placeholder='例如：今天多练2页口算' />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1.5 ml-1'>学科</label>
                  <select id='temp-task-subject' className='w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 outline-none'>
                    <option value=''>未设置</option>
                    <option value='chinese'>语文</option>
                    <option value='math'>数学</option>
                    <option value='english'>英语</option>
                    <option value='sports'>体育</option>
                  </select>
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1.5 ml-1'>期望完成</label>
                  <select id='temp-task-due' className='w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 outline-none'>
                    <option value='today'>今天</option>
                    <option value='tomorrow'>明天</option>
                    <option value='weekend'>本周末</option>
                  </select>
                </div>
              </div>
              <div>
                <label className='block text-xs font-medium text-gray-500 mb-1.5 ml-1'>紧急程度</label>
                <div className='flex gap-2'>
                  {['normal','urgent'].map(u => (
                    <button key={u} onClick={() => setTempUrgency(u)} className={cn('flex-1 px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all',
                      tempUrgency === u ? 'border-amber-500 bg-amber-500 text-white shadow-sm' : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300')}>
                      {u === 'normal' ? '普通' : '紧急'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className='px-6 py-3.5 bg-gray-50/80 border-t border-gray-100 flex justify-end gap-2.5'>
              <button onClick={() => setTempDialogOpen(false)} className='rounded-xl px-5 h-10 text-sm font-medium border border-gray-200 hover:bg-gray-100'>取消</button>
              <button onClick={async () => {
                const name = (document.getElementById('temp-task-name') as HTMLInputElement)?.value?.trim();
                const subject = (document.getElementById('temp-task-subject') as HTMLSelectElement)?.value;
                const due = (document.getElementById('temp-task-due') as HTMLSelectElement)?.value;
                
                if (!name) { toast.error('请输入任务名称'); return; }
                
                try {
                  // 确保获取到有效的孩子ID
                  if (!weeklyPlans || weeklyPlans.length === 0) {
                    toast.error('请先创建孩子账号');
                    return;
                  }
                  
                  const childId = weeklyPlans[0].childId;
                  console.log('Creating temporary task with childId:', childId);
                  
                  const response = await apiClient.post('/plans/temp-task', {
                    name,
                    subject,
                    due,
                    urgency: tempUrgency,
                    childId: parseInt(childId)
                  });
                  
                  console.log('Temporary task created:', response);
                  toast.success('临时任务已创建！');
                  setTempDialogOpen(false);
                  refetchPlans(); // 刷新计划数据
                } catch (error: unknown) {
                  console.error('Error creating temporary task:', error);
                  const err = error as { response?: { data?: { message?: string } } };
                  toast.error(err.response?.data?.message || '创建临时任务失败，请重试');
                }
              }} className='bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl px-6 h-10 text-sm font-medium shadow-lg shadow-amber-500/20'>创建任务</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          weekStartDate={currentWeekStart}
          onClose={() => setSelectedTask(null)} 
          onRefresh={() => refetchPlans()}
        />
      )}

      <PublishPlanDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen} tasks={planTasks} onSuccess={() => setCurrentWeekStart(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }))} />
    </div>
  );
}