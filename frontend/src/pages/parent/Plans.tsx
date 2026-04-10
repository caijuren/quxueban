import React, { useState, useMemo, useRef } from 'react';
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
import { AdvancedExportDialog, AdvancedExportConfig, ChildOption } from '@/components/AdvancedExportDialog';
import { useSelectedChild } from '@/contexts/SelectedChildContext';

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

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const subjectLabel = (s: string | null) => s === 'chinese' ? '语文' : s === 'math' ? '数学' : s === 'english' ? '英语' : s === 'sports' ? '体育' : s || '其他';
const subjectColor = (s: string | null) => s === 'chinese' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : s === 'math' ? 'bg-blue-50 text-blue-700 border border-blue-200' : s === 'english' ? 'bg-purple-50 text-purple-700 border border-purple-200' : s === 'sports' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-600 border border-gray-200';
const diffLabel = (d: string | null) => d === 'basic' ? '基础' : d === 'advanced' ? '提升' : d === 'challenge' ? '挑战' : '';
const ruleLabel = (r: string) => r === 'daily' ? '每日任务' : r === 'school' ? '在校日任务' : r === 'flexible' ? '智能分配' : r === 'weekend' ? '周末任务' : r || '每日任务';

// 优化后的任务详情弹窗
function TaskDetailModal({ task, weekStartDate, onClose, onRefresh }: TaskDetailProps) {
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedMoveDay, setSelectedMoveDay] = useState<number | null>(null);
  const [selectedDayForAction, setSelectedDayForAction] = useState<number | null>(null);

  // 转换后端索引到前端索引
  // 后端: 0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
  // 前端: 0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日
  const getFrontendDayIndex = (backendIndex: number) => {
    if (backendIndex === 0) return 6; // 周日
    return backendIndex - 1; // 其他日期
  };
  
  // 转换前端索引到后端索引
  const getBackendDayIndex = (frontendIndex: number) => {
    if (frontendIndex === 6) return 0; // 周日
    return frontendIndex + 1; // 其他日期
  };
  
  // 将后端索引的 assignedDays 转换为前端索引
  const assignedDays = useMemo(() => {
    // 优先使用实际分配的天数（后端已存储的 assignedDays）
    let backendDays: number[];
    if (task.assignedDays && task.assignedDays.length > 0) {
      backendDays = task.assignedDays;
    } else {
      // 如果没有实际分配，根据 scheduleRule 计算默认值
      // 使用 JavaScript 标准索引：0=周日, 1=周一, ..., 6=周六
      switch (task.scheduleRule) {
        case 'daily': backendDays = [0, 1, 2, 3, 4, 5, 6]; break;
        case 'school': backendDays = [1, 2, 4, 5]; break; // 周一、周二、周四、周五
        case 'flexible': backendDays = [1, 2, 3, 4, 5]; break; // 周一到周五
        case 'weekend': backendDays = [0, 6]; break; // 周日、周六
        default: backendDays = [0, 1, 2, 3, 4, 5, 6];
      }
    }
    // 转换为前端索引（0=周一, 1=周二, ..., 6=周日）
    return backendDays.map(getFrontendDayIndex);
  }, [task.scheduleRule, task.assignedDays]);

  // 删除某天的安排
  const deleteDayMutation = useMutation({
    mutationFn: async ({ dayIndex }: { dayIndex: number }) => {
      // 计算实际日期（dayIndex 是 0-6 对应周一到周日）
      const date = addDays(weekStartDate, dayIndex);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      console.log('删除请求参数:', { 
        taskId: task.taskId, 
        action: 'remove', 
        date: dateStr,
        dayIndex,
        dateObject: date,
        dayOfWeek: date.getDay()
      });
      
      const response = await apiClient.post('/plans/modify', {
        taskId: task.taskId,
        action: 'remove',
        date: dateStr,
      });
      return response.data;
    },
    onSuccess: (data) => {
      console.log('删除成功响应:', data);
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

async function fetchWeeklyPlan(weekStart: string, childId?: number): Promise<WeeklyPlan[]> {
  const params = childId ? { childId } : {};
  const response = await apiClient.get(`/plans/week/${weekStart}`, { params });
  return response.data.data || [];
}

export default function PlansPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskAllocation | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<{[key: string]: boolean}>({});
  const [advancedExportOpen, setAdvancedExportOpen] = useState(false);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const { selectedChildId } = useSelectedChild();
  
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const { data: planTasks = [] } = useQuery({
    queryKey: ['tasks', selectedChildId],
    queryFn: async () => {
      // 强制传递childId，确保数据隔离
      if (!selectedChildId) {
        return [];
      }
      const res = await apiClient.get('/tasks', { params: { childId: selectedChildId } });
      return res.data.data || [];
    },
    staleTime: 60 * 1000,
    enabled: !!selectedChildId, // 只有在选择了孩子时才查询
  });

  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));
  const isNextWeek = isSameDay(currentWeekStart, startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }));

  const { data: weeklyPlans, isLoading: plansLoading, error, refetch: refetchPlans } = useQuery({
    queryKey: ['weekly-plan', format(currentWeekStart, 'yyyy-MM-dd'), selectedChildId],
    queryFn: () => fetchWeeklyPlan(format(currentWeekStart, 'yyyy-MM-dd'), selectedChildId || undefined),
    staleTime: 5 * 60 * 1000
  });

  if (error) {
    console.error('Error fetching weekly plans:', error);
  }

  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDates = useMemo(() => {
    // 调整日期，使其与 weekDays 数组顺序一致（周一开始）
    return weekDays.map((_, index) => {
      return addDays(currentWeekStart, index);
    });
  }, [currentWeekStart]);
  const weekLabel = `${format(currentWeekStart, 'M月d日', { locale: zhCN })} - ${format(addDays(currentWeekStart, 6), 'M月d日', { locale: zhCN })}`;

  const childOptions = useMemo<ChildOption[]>(() => {
    if (!weeklyPlans || weeklyPlans.length === 0) return [];
    return weeklyPlans.map(plan => ({
      id: parseInt(plan.childId),
      name: plan.childName,
      avatar: '',
    }));
  }, [weeklyPlans]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Calculate display plan
  const displayPlan = useMemo(() => {
    if (weeklyPlans && weeklyPlans.length > 0) {
      if (selectedChildId) {
        // If there's a selected child, show that child's plan
        const plan = weeklyPlans.find(plan => parseInt(plan.childId) === selectedChildId);
        if (plan) return plan;
      }
      // If no selected child or child not found, show the first plan
      return weeklyPlans[0];
    }
    // If no plans, show empty plan
    return {id: "empty", childId: "0", childName: "学习计划", allocations: [], dailyProgress: []};
  }, [weeklyPlans, selectedChildId]);
  
  const categories = [
    { value: 'all', label: '全部' },
    { value: 'school', label: '校内作业' },
    { value: 'advanced', label: '拔高训练' },
    { value: 'extra', label: '课外课程' },
    { value: 'chinese', label: '语文阅读' },
    { value: 'english', label: '英语学习' },
    { value: 'sports', label: '体育任务' },
  ];

  return (
    <div className="space-y-4" id="weekly-plan-view">
      {/* Page Control Bar */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Category Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
            {categories.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg',
                  selectedCategory === category.value
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* 推送按钮 - 只在有计划数据时显示 */}
            {displayPlan && displayPlan.childId !== "0" && (
              <button
                onClick={async () => {
                  try {
                    if (displayPlan && displayPlan.childId !== "0") {
                      await apiClient.post('/dingtalk/push-weekly-plan', { 
                        childId: parseInt(displayPlan.childId), 
                        weekStartDate: currentWeekStart.toISOString() 
                      });
                      toast.success('已推送至钉钉');
                    }
                  } catch (e: unknown) {
                    const error = e as { response?: { data?: { message?: string } } };
                    toast.error(error.response?.data?.message || '推送失败');
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 shadow-sm text-sm font-medium h-10"
              >
                <Send className="size-4" />
                推送
              </button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-border shadow-sm hover:shadow transition-all duration-200 h-10">
                  <span className="text-sm font-medium text-foreground">{weekLabel}</span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border border-border shadow-md rounded-lg" align="end">
                <div className="p-3 border-b border-border">
                  <div className="flex gap-2">
                    <button onClick={() => goToCurrentWeek()} className={cn("flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors", isCurrentWeek ? "bg-primary text-white" : "text-foreground hover:bg-muted")}>本周</button>
                    <button onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))} className={cn("flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors", isNextWeek ? "bg-primary text-white" : "text-foreground hover:bg-muted")}>下周</button>
                    <button onClick={() => setCurrentWeekStart(prev => addWeeks(prev, -1))} className="flex-1 text-center py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted">上周</button>
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
                  className="rounded-lg p-3"
                  classNames={{
                    day_selected: "bg-primary text-white hover:bg-primary/90 rounded-lg",
                    day_today: "bg-primary/10 text-primary font-bold rounded-lg",
                    nav_button: "h-8 w-8 rounded-lg hover:bg-muted",
                    caption: "flex justify-center pt-1 relative items-center w-full",
                  }}
                />
              </PopoverContent>
            </Popover>


            <Button
              onClick={() => setAdvancedExportOpen(true)}
              className="h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm min-w-20"
            >
              <Download className="w-4 h-4 mr-1.5" />
              <span className="text-sm">导出</span>
            </Button>
            <Button
              onClick={() => setPublishDialogOpen(true)}
              className="h-10 rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm min-w-20"
            >
              <Plus className="size-4 mr-1.5" />
              <span className="text-sm">发布计划</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {plansLoading ? (
        <Card className="border border-border shadow-sm rounded-lg">
          <CardContent className="p-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      ) : (
        <div ref={exportContainerRef} className="space-y-6">
          {/* 只显示当前选中的孩子的计划 */}
          {[displayPlan].map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
            >
              <Card className="border border-border shadow-sm rounded-lg overflow-hidden hover:shadow-md transition-all duration-300">
                <CardContent className="px-4 py-4">
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      {/* Day headers */}
                      <div className="grid grid-cols-8 gap-2 mb-3">
                        <div className="p-2"></div>
                        {weekDays.map((day, i) => {
                          const date = weekDates[i];
                          const isTodayDate = isToday(date);
                          // 转换前端索引到后端索引（0=周一→1, 6=周日→0）
                          const backendIndex = i === 6 ? 0 : i + 1;
                          const dayTasks = plan.allocations.filter(a => a.assignedDays.includes(backendIndex));
                          const dayTotalMin = dayTasks.reduce((s, a) => s + a.timePerUnit, 0);
                          return (
                            <div key={day} className={cn('p-2 text-center rounded-lg transition-all duration-300', isTodayDate ? 'bg-primary text-white shadow-sm' : 'bg-muted hover:bg-muted/80')}>
                              <div className={cn('flex items-center justify-center gap-1', isTodayDate ? 'text-white' : 'text-foreground')}>
                                <span className={cn('text-xs font-medium', isTodayDate ? 'text-white/80' : 'text-muted-foreground')}>{day}</span>
                                <span className={cn('text-sm font-semibold', isTodayDate ? 'text-white' : 'text-foreground')}>{format(date, 'M/d')}</span>
                              </div>
                              {dayTotalMin > 0 && <span className={cn('text-xs mt-1 block', isTodayDate ? 'text-white/70' : 'text-muted-foreground')}>{dayTotalMin}m</span>}
                            </div>
                          );
                        })}
                      </div>
                      {/* 任务列表 - 直接平铺，无分组 */}
                      {(() => {
                        // 学科排序顺序
                        const categoryOrder: { [key: string]: number } = {
                          'school': 0,    // 校内作业
                          'advanced': 1,  // 拔高
                          'extra': 2,     // 课外
                          'chinese': 3,   // 语文
                          'english': 4,   // 英语
                          'sports': 5,    // 体育
                        };

                        // 获取分类颜色
                        const getCategoryColor = (category: string) => {
                          const cat = (category || '').toLowerCase();
                          switch (cat) {
                            case 'school': return { bg: 'bg-blue-400', text: 'text-blue-700', light: 'bg-blue-50' };
                            case 'advanced': return { bg: 'bg-indigo-400', text: 'text-indigo-700', light: 'bg-indigo-50' };
                            case 'extra': return { bg: 'bg-purple-400', text: 'text-purple-700', light: 'bg-purple-50' };
                            case 'chinese': return { bg: 'bg-emerald-400', text: 'text-emerald-700', light: 'bg-emerald-50' };
                            case 'english': return { bg: 'bg-orange-400', text: 'text-orange-700', light: 'bg-orange-50' };
                            case 'sports': return { bg: 'bg-yellow-400', text: 'text-yellow-700', light: 'bg-yellow-50' };
                            default: return { bg: 'bg-gray-400', text: 'text-gray-600', light: 'bg-gray-50' };
                          }
                        };

                        // 按分类筛选并排序任务
                        const filteredAndSortedTasks = [...plan.allocations]
                          .filter(task => selectedCategory === 'all' || task.category === selectedCategory)
                          .sort((a, b) => {
                            const orderA = categoryOrder[a.category || ''] ?? 99;
                            const orderB = categoryOrder[b.category || ''] ?? 99;
                            if (orderA !== orderB) return orderA - orderB;
                            return a.taskName.localeCompare(b.taskName);
                          });

                        return filteredAndSortedTasks.map((taskItem) => {
                          const hasAssignedDays = taskItem.assignedDays && taskItem.assignedDays.length > 0;
                          const color = getCategoryColor(taskItem.category);

                          // 转换前端索引到后端索引
                          const getBackendDayIndex = (frontendIndex: number) => {
                            if (frontendIndex === 6) return 0; // 周日
                            return frontendIndex + 1;
                          };

                          const isTaskAssignedOnDay = (frontendDayIndex: number) => {
                            const backendIndex = getBackendDayIndex(frontendDayIndex);
                            return taskItem.assignedDays && taskItem.assignedDays.includes(backendIndex);
                          };

                          const getDotColor = () => {
                            if (!hasAssignedDays) return 'bg-gray-300';
                            return color.bg;
                          };

                          return (
                            <motion.div 
                              key={taskItem.taskId} 
                              className="grid grid-cols-8 gap-2 group/row mb-1"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, ease: "easeOut" }}
                              whileHover={{ backgroundColor: 'rgba(249, 250, 251, 0.5)' }}
                            >
                              <div className="p-2 flex items-center gap-2 pr-3 rounded-lg hover:bg-muted/50 transition-all duration-300" title={taskItem.taskName}>
                                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', getDotColor())} />
                                <span className={cn('text-sm font-medium truncate', !hasAssignedDays && 'text-muted-foreground')}>
                                  {taskItem.taskName}
                                  {!hasAssignedDays && <span className="ml-1 text-xs text-muted-foreground">(未分配)</span>}
                                </span>
                              </div>
                              {weekDays.map((_, i) => {
                                const isAssigned = isTaskAssignedOnDay(i);
                                const dayProgress = plan.dailyProgress.find(d => d.day === i);
                                const isCompleted = isCurrentWeek && dayProgress && isAssigned && dayProgress.completed > 0;

                                return (
                                  <div key={i} className={cn('p-2 flex items-center justify-center rounded-lg min-h-[40px] transition-all duration-300', isToday(weekDates[i]) && 'bg-primary/5 hover:bg-primary/10')}>
                                    <div className="relative">
                                      {isAssigned ? (
                                        <motion.button 
                                          onClick={() => setSelectedTask(taskItem)} 
                                          className={cn('w-6 h-6 rounded-full cursor-pointer shadow-sm', isCompleted ? 'bg-emerald-400 ring-2 ring-emerald-200' : getDotColor())} 
                                          title={`${taskItem.taskName} - 点击查看详情`}
                                          whileHover={{ scale: 1.15, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                                          whileTap={{ scale: 0.95 }}
                                        >
                                          {isCompleted && <span className="text-white text-xs">✓</span>}
                                          {taskItem.difficulty === 'challenge' && !isCompleted && (
                                            <span className="absolute -top-1 -right-1 text-[8px] text-amber-500">★</span>
                                          )}
                                        </motion.button>
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-muted shadow-sm"></div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </motion.div>
                          );
                        });
                      })()}
                      {plan.allocations.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground text-sm bg-muted rounded-lg">该周暂无任务安排</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
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

      {/* Advanced Export Dialog */}
      <AdvancedExportDialog
        open={advancedExportOpen}
        onOpenChange={setAdvancedExportOpen}
        targetRef={exportContainerRef}
        children={childOptions}
        title="导出学习计划"
        filenamePrefix="学习计划"
        currentWeekStart={currentWeekStart}
      />
    </div>
  );
}