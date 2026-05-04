import React, { useState, useMemo, useRef } from 'react';
import { PublishPlanDialog } from '@/components/PublishPlanDialog';
import { Plus, X, ChevronDown, Send, Trash2, Move, CalendarDays, Download, AlertTriangle, Clock, Target, BookOpen, Sparkles, ClipboardCheck, Calculator, Languages, Dumbbell, BookMarked, Shapes, Check, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { FilterBar, PageToolbar, PageToolbarTitle } from '@/components/parent/PageToolbar';

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
  timeSegment?: string;
  sortOrder?: number;
  dayStatuses?: Array<{
    day: number;
    status: string | null;
    completedValue?: number;
    focusMinutes?: number;
  }>;
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
  childId: number;
  weekStartDate: Date;
  onClose: () => void;
  onRefresh: () => void;
}

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const subjectLabel = (s: string | null) => s === 'chinese' ? '语文' : s === 'math' ? '数学' : s === 'english' ? '英语' : s === 'sports' ? '体育' : s || '其他';
const subjectColor = (s: string | null) => s === 'chinese' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : s === 'math' ? 'bg-blue-50 text-blue-700 border border-blue-200' : s === 'english' ? 'bg-purple-50 text-purple-700 border border-purple-200' : s === 'sports' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-600 border border-gray-200';
const diffLabel = (d: string | null) => d === 'basic' ? '基础' : d === 'advanced' ? '提升' : d === 'challenge' ? '挑战' : '';
const ruleLabel = (r: string) => r === 'daily' ? '每日任务' : r === 'school' ? '在校日任务' : r === 'flexible' ? '智能分配' : r === 'weekend' ? '周末任务' : r || '每日任务';
const toBackendDayIndex = (frontendIndex: number) => frontendIndex === 6 ? 0 : frontendIndex + 1;

function getDayLoadMeta(minutes: number) {
  if (minutes > 90) return { label: '偏重', className: 'bg-rose-50 text-rose-600 border-rose-100' };
  if (minutes > 45) return { label: '正常', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  return { label: '轻量', className: 'bg-sky-50 text-sky-600 border-sky-100' };
}

const categoryOrder: { [key: string]: number } = {
  school: 0,
  advanced: 1,
  extra: 2,
  chinese: 3,
  english: 4,
  sports: 5,
};
const timeSegmentOrder: Record<string, number> = {
  '早晨': 0,
  '上午': 1,
  '中午': 2,
  '放学后': 3,
  '晚饭后': 4,
  '睡前': 5,
};

const planAccent = {
  strongButton: 'bg-[linear-gradient(135deg,#16b3a5_0%,#12988d_100%)] text-white shadow-[0_14px_28px_rgba(18,152,141,0.18)] hover:brightness-95',
  softTone: 'bg-[#e8faf6] text-[#14978c]',
  softSurface: 'border-[#d9f2ec] bg-[#f5fcfa] text-[#137f76]',
  activeTab: 'bg-[#17b3a5] text-white shadow-sm hover:bg-[#159e92] hover:text-white',
};

function PlanSummaryMetric({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-3 whitespace-nowrap text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function getTaskStatusOrder(task: TaskAllocation) {
  if (task.progress >= task.target) return 0;
  if (task.progress > 0) return 1;
  return 2;
}

function getPlanCellStatus(task: TaskAllocation, dayIndex: number, date: Date, isAssigned: boolean) {
  if (!isAssigned) return 'unassigned';
  const checkinStatus = task.dayStatuses?.find((item) => item.day === dayIndex)?.status || null;
  if (checkinStatus === 'completed' || checkinStatus === 'advance') return 'completed';
  if (checkinStatus === 'partial' || checkinStatus === 'makeup') return 'partial';
  if (checkinStatus === 'postponed') return 'postponed';
  if (checkinStatus === 'not_completed') return 'not_completed';
  if (checkinStatus === 'not_involved') return 'not_involved';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cellDate = new Date(date);
  cellDate.setHours(0, 0, 0, 0);
  return cellDate < today ? 'not_completed' : 'pending';
}

function getPlanCellClass(status: string, color: ReturnType<typeof getCategoryStyle>) {
  if (status === 'completed') return cn(color.bg, 'text-white ring-2 ring-white/80 shadow-sm');
  if (status === 'partial') return 'border-2 border-orange-300 bg-orange-50 text-orange-500 shadow-sm';
  if (status === 'postponed') return 'border-2 border-slate-200 bg-slate-50 text-slate-400';
  if (status === 'not_completed') return 'bg-rose-50 text-rose-500 ring-1 ring-rose-100';
  if (status === 'not_involved') return 'border-2 border-slate-200 bg-slate-100 text-slate-300';
  return cn('border-[2.5px] bg-white', color.border);
}

function PlanCellIcon({ status }: { status: string }) {
  if (status === 'completed') return <Check className="h-3.5 w-3.5" />;
  if (status === 'partial') return <Play className="h-3.5 w-3.5" />;
  if (status === 'postponed') return <Clock className="h-3.5 w-3.5" />;
  if (status === 'not_completed') return <X className="h-3.5 w-3.5" />;
  if (status === 'not_involved') return <span className="text-xs font-bold leading-none">−</span>;
  return null;
}

const getCategoryStyle = (category: string) => {
  const cat = (category || '').toLowerCase();
  switch (cat) {
    case 'school':
      return { bg: 'bg-emerald-400', text: 'text-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-300', hex: '#6ee7b7', icon: ClipboardCheck };
    case 'advanced':
      return { bg: 'bg-pink-400', text: 'text-pink-700', light: 'bg-pink-50', border: 'border-pink-300', hex: '#f472b6', icon: Target };
    case 'extra':
      return { bg: 'bg-cyan-400', text: 'text-cyan-700', light: 'bg-cyan-50', border: 'border-cyan-300', hex: '#67e8f9', icon: Shapes };
    case 'chinese':
      return { bg: 'bg-violet-500', text: 'text-violet-700', light: 'bg-violet-50', border: 'border-violet-300', hex: '#8b5cf6', icon: BookMarked };
    case 'english':
      return { bg: 'bg-orange-400', text: 'text-orange-700', light: 'bg-orange-50', border: 'border-orange-300', hex: '#fb923c', icon: Languages };
    case 'sports':
      return { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-300', hex: '#34d399', icon: Dumbbell };
    default:
      return { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50', border: 'border-blue-300', hex: '#3b82f6', icon: Calculator };
  }
};

// 优化后的任务详情弹窗
function TaskDetailModal({ task, childId, weekStartDate, onClose, onRefresh }: TaskDetailProps) {
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedMoveDay, setSelectedMoveDay] = useState<number | null>(null);
  const [selectedDayForAction, setSelectedDayForAction] = useState<number | null>(null);
  const color = getCategoryStyle(task.category);
  const Icon = color.icon;

  // 后端仍然使用 JavaScript 标准索引：0=周日, 1=周一, ..., 6=周六
  // 前端表格按周一到周日展示：0=周一, ..., 5=周六, 6=周日
  const getFrontendDayIndex = (backendIndex: number) => {
    if (backendIndex === 0) return 6; // 周日放到最后一列
    return backendIndex - 1; // 周一到周六整体前移
  };

  const getBackendDayIndex = (frontendIndex: number) => {
    if (frontendIndex === 6) return 0; // 周日
    return frontendIndex + 1; // 周一到周六
  };

  // 将后端索引的 assignedDays 转换为前端索引
  const assignedDays = useMemo(() => {
    // 优先使用实际分配的天数（后端已存储的 assignedDays）
    let backendDays: number[];
    if (task.assignedDays && task.assignedDays.length > 0) {
      backendDays = task.assignedDays;
    } else {
      // 如果没有实际分配，根据 scheduleRule 计算默认值（后端索引）
      switch (task.scheduleRule) {
        case 'daily': backendDays = [0, 1, 2, 3, 4, 5, 6]; break;
        case 'school': backendDays = [1, 2, 4, 5]; break; // 周一、周二、周四、周五
        case 'flexible': backendDays = [1, 2, 3, 4, 5]; break; // 周一到周五
        case 'weekend': backendDays = [0, 6]; break; // 周日、周六
        default: backendDays = [0, 1, 2, 3, 4, 5, 6];
      }
    }
    return backendDays.map(getFrontendDayIndex);
  }, [task.scheduleRule, task.assignedDays]);

  // 删除某天的安排
  const deleteDayMutation = useMutation({
    mutationFn: async ({ dayIndex }: { dayIndex: number }) => {
      // 计算实际日期（dayIndex 是 0-6 对应周一到周日）
      const date = addDays(weekStartDate, dayIndex);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const response = await apiClient.post('/plans/modify', {
        taskId: task.taskId,
        childId,
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
        childId,
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
          className='bg-white rounded-[28px] w-full max-w-md shadow-2xl overflow-hidden'
          onClick={e => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className='px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-white'>
            <div className='flex items-start gap-4'>
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm', color.bg)}>
                <Icon className='w-5 h-5' />
              </div>
              <div>
                <h2 className='text-xl font-semibold tracking-tight text-slate-950'>{task.taskName}</h2>
                <p className='mt-1 text-sm text-slate-500'>{subjectLabel(task.subject)} · {ruleLabel(task.scheduleRule)} · 本周已完成 {task.progress}/{task.target} 次</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className='w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors'
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
              <span className='text-sm px-3 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200'>
                {task.timeSegment || '放学后'}
              </span>

            </div>

            {/* 信息列表 */}
            <div className='space-y-3'>
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-2xl'>
                <div className='w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center'>
                  <Clock className='w-4 h-4 text-slate-700' />
                </div>
                <div className='flex-1'>
                  <div className='text-xs text-gray-500'>每次时长</div>
                  <div className='text-sm font-semibold text-gray-900'>{task.timePerUnit} 分钟</div>
                </div>
              </div>
              
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-2xl'>
                <div className='w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center'>
                  <Target className='w-4 h-4 text-slate-700' />
                </div>
                <div className='flex-1'>
                  <div className='text-xs text-gray-500'>分配规则</div>
                  <div className='text-sm font-semibold text-gray-900'>{ruleLabel(task.scheduleRule)}</div>
                </div>
              </div>
              
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-2xl'>
                <div className='w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center'>
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
                            : 'bg-primary/10 text-primary hover:bg-primary/15'
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
                  className='mt-3 p-3 rounded-2xl border border-[#d9f2ec] bg-[#f5fcfa]'
                >
                  <div className='text-sm text-[#14978c] mb-2'>
                    已选择：<strong>{weekDays[selectedDayForAction]}</strong>（{format(addDays(weekStartDate, selectedDayForAction), 'M月d日')}）
                  </div>
                  <div className='flex gap-2'>
                    <button
                      onClick={() => setShowMoveDialog(true)}
                      className='flex-1 flex items-center justify-center gap-1.5 py-2 bg-white rounded-xl text-[#14978c] text-sm font-medium hover:bg-[#ecfaf7] transition-colors border border-[#d9f2ec]'
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
              className='bg-white rounded-[28px] w-full max-w-sm shadow-2xl overflow-hidden'
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
              className='bg-white rounded-[28px] w-full max-w-sm shadow-2xl overflow-hidden'
              onClick={e => e.stopPropagation()}
            >
              <div className='px-5 py-4 border-b border-gray-100'>
                <h3 className='text-base font-semibold text-gray-900 flex items-center gap-2'>
                  <CalendarDays className='w-5 h-5 text-[#14978c]' />
                  移动到其他日期
                </h3>
              </div>
              
              <div className='p-5'>
                <p className='text-sm text-gray-600 mb-4'>
                  将 <strong className='text-[#14978c]'>{weekDays[selectedDayForAction!]}</strong> 的任务移动到：
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
                              ? 'bg-[#14978c] text-white shadow-lg scale-105'
                              : 'bg-gray-50 text-gray-700 hover:bg-[#ecfaf7] hover:text-[#14978c]'
                        )}
                      >
                        <span className='text-xs font-medium'>{d}</span>
                        <span className={cn('text-[10px]', isSelected ? 'text-white/80' : 'text-gray-400')}>
                          {dateStr}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                {selectedMoveDay !== null && (
                  <div className='text-sm text-center text-gray-600 mb-4 p-2 rounded-xl bg-[#f5fcfa]'>
                    → 移动到 <strong className='text-[#14978c]'>{weekDays[selectedMoveDay]}</strong>
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
  const { selectedChildId, selectedChild } = useSelectedChild();
  const queryClient = useQueryClient();
  
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

  const refreshPlanDependents = async () => {
    await refetchPlans();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks', selectedChildId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', selectedChildId] }),
      queryClient.invalidateQueries({ queryKey: ['today-checkins', selectedChildId] }),
    ]);
  };

  const handlePlanPublished = () => {
    setCurrentWeekStart(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }));
    void queryClient.invalidateQueries({ queryKey: ['weekly-plan'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-tasks', selectedChildId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-stats', selectedChildId] });
    void queryClient.invalidateQueries({ queryKey: ['today-checkins', selectedChildId] });
  };

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

  const weeklySummary = useMemo(() => {
    const allocations = displayPlan.allocations || [];
    const dailyLoads = weekDays.map((day, index) => {
      const backendIndex = toBackendDayIndex(index);
      const dayTasks = allocations.filter((allocation) => allocation.assignedDays?.includes(backendIndex));
      const minutes = dayTasks.reduce((sum, task) => sum + (Number(task.timePerUnit) || 0), 0);
      return {
        day,
        date: weekDates[index],
        taskCount: dayTasks.length,
        minutes,
        load: getDayLoadMeta(minutes),
      };
    });
    const totalScheduledCount = dailyLoads.reduce((sum, day) => sum + day.taskCount, 0);
    const totalMinutes = dailyLoads.reduce((sum, day) => sum + day.minutes, 0);
    const completedCount = allocations.filter((item) => item.progress >= item.target && item.target > 0).length;
    const remainingCount = allocations.filter((item) => item.target <= 0 || item.progress < item.target).length;
    const attentionCount = allocations.filter((item) =>
      item.dayStatuses?.some((status) => ['postponed', 'not_completed', 'partial'].includes(status.status || ''))
    ).length;
    const todayIndex = weekDates.findIndex((date) => isToday(date));

    return {
      uniqueTaskCount: allocations.length,
      totalScheduledCount,
      totalMinutes,
      completedCount,
      remainingCount,
      attentionCount,
      todayTaskCount: todayIndex >= 0 ? dailyLoads[todayIndex].taskCount : 0,
      dailyLoads,
    };
  }, [displayPlan, weekDates]);
  
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
    <div className="mx-auto max-w-[1360px] space-y-5" id="weekly-plan-view">
      <PageToolbar
        left={
          <PageToolbarTitle
            icon={CalendarDays}
            title="学习计划"
            description={`${selectedChild?.name || '当前孩子'}的周计划安排、任务分配和执行进度`}
          />
        }
        right={
          <>
            {/* 推送按钮 - 只在有计划数据时显示 */}
            {displayPlan && displayPlan.childId !== "0" && (
              <Button
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
                variant="secondary"
              >
                <Send className="size-4" />
                推送
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 gap-2 rounded-xl bg-white">
                  <span className="text-sm font-semibold text-slate-900">{weekLabel}</span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-2xl border border-slate-200 p-0 shadow-xl" align="end">
                <div className="p-3 border-b border-border">
                  <div className="flex gap-2">
                    <button onClick={() => goToCurrentWeek()} className={cn("flex-1 text-center py-2 rounded-xl text-sm font-medium transition-colors", isCurrentWeek ? "bg-primary text-white" : "text-foreground hover:bg-muted")}>本周</button>
                    <button onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))} className={cn("flex-1 text-center py-2 rounded-xl text-sm font-medium transition-colors", isNextWeek ? "bg-primary text-white" : "text-foreground hover:bg-muted")}>下周</button>
                    <button onClick={() => setCurrentWeekStart(prev => addWeeks(prev, -1))} className="flex-1 text-center py-2 rounded-xl text-sm font-medium text-foreground hover:bg-muted">上周</button>
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
                    day_selected: "bg-primary text-white hover:bg-primary/90 rounded-xl",
                    day_today: "bg-primary/10 text-primary font-bold rounded-xl",
                    nav_button: "h-8 w-8 rounded-xl hover:bg-muted",
                    caption: "flex justify-center pt-1 relative items-center w-full",
                  }}
                />
              </PopoverContent>
            </Popover>


            <Button
              variant="outline"
              onClick={() => setAdvancedExportOpen(true)}
              className="h-11 min-w-24 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50"
            >
              <Download className="w-4 h-4 mr-1.5" />
              <span className="text-sm">导出</span>
            </Button>
            <Button
              onClick={() => setPublishDialogOpen(true)}
              className={cn('rounded-xl px-5', planAccent.strongButton)}
            >
              <Plus className="size-4 mr-1.5" />
              <span className="text-sm">发布计划</span>
            </Button>
          </>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">本周计划摘要</h2>
            <p className="mt-1 text-sm text-slate-500">先看这周总量和今天负荷，再进入计划网格做查看、调整和发布。</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <PlanSummaryMetric label="任务项" value={`${weeklySummary.uniqueTaskCount} 项`} helper="本周涉及的唯一任务数" icon={ClipboardCheck} tone="bg-emerald-50 text-emerald-700" />
          <PlanSummaryMetric label="安排次数" value={`${weeklySummary.totalScheduledCount} 次`} helper="包含同一任务多日分配" icon={Shapes} tone="bg-sky-50 text-sky-700" />
          <PlanSummaryMetric label="预计时长" value={`${weeklySummary.totalMinutes} 分钟`} helper="全周总投入预估" icon={Clock} tone="bg-violet-50 text-violet-700" />
          <PlanSummaryMetric label="已完成" value={`${weeklySummary.completedCount} 项`} helper="本周目标已完成的任务" icon={Check} tone="bg-teal-50 text-teal-700" />
          <PlanSummaryMetric label="待推进" value={`${weeklySummary.remainingCount} 项`} helper="尚未完成或仍需推进" icon={Target} tone="bg-amber-50 text-amber-700" />
          <PlanSummaryMetric label="今日安排" value={`${weeklySummary.todayTaskCount} 项`} helper="今天落在计划里的任务" icon={CalendarDays} tone="bg-orange-50 text-orange-700" />
        </div>
        {weeklySummary.attentionCount > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>本周有 {weeklySummary.attentionCount} 个任务出现部分完成、推迟或未完成，建议在周末复盘时优先调整。</span>
          </div>
        )}
      </section>

      <FilterBar
        actions={
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            当前筛选：
            <span className="ml-1 font-semibold text-slate-900">{categories.find((item) => item.value === selectedCategory)?.label || '全部'}</span>
          </div>
        }
      >
        {categories.map((category) => (
          <Button
            key={category.value}
            variant="outline"
            size="sm"
            onClick={() => setSelectedCategory(category.value)}
            className={cn(
              'rounded-xl border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              selectedCategory === category.value && planAccent.activeTab
            )}
          >
            {category.label}
          </Button>
        ))}
      </FilterBar>

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
              <Card className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
                <CardContent className="p-6">
                  <div className="overflow-x-auto">
                    <div className="min-w-[1220px]">
                      {/* Day headers */}
                      <div className="mb-3 grid grid-cols-[268px_repeat(7,minmax(116px,1fr))] gap-2.5">
                        <div className="p-2"></div>
                        {weekDays.map((day, i) => {
                          const date = weekDates[i];
                          const isTodayDate = isToday(date);
                          const isHoliday = format(date, 'MM-dd') === '05-01';
                          const dayLoad = weeklySummary.dailyLoads[i];
                          return (
                            <div
                              key={day}
                              className={cn(
                                'rounded-2xl px-3 py-3 text-center transition-all duration-300',
                                isTodayDate
                                  ? 'bg-primary text-primary-foreground shadow-sm'
                                  : isHoliday
                                    ? 'bg-rose-50 text-slate-900'
                                    : 'bg-slate-50 text-slate-900 hover:bg-slate-100'
                              )}
                            >
                              <div className="text-sm font-semibold tracking-tight">
                                {day} {format(date, 'M/d')}
                              </div>
                              <div className={cn('mt-1 text-xs font-medium', isTodayDate ? 'text-white/80' : 'text-slate-500')}>
                                {isHoliday ? '劳动节' : `${dayLoad.taskCount}项 · ${dayLoad.minutes}分钟`}
                              </div>
                              {!isHoliday && (
                                <span className={cn(
                                  'mt-1.5 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                                  isTodayDate ? 'border-white/30 bg-white/15 text-white' : dayLoad.load.className
                                )}>
                                  {dayLoad.load.label}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* 任务列表 - 直接平铺，无分组 */}
                      {(() => {
                        // 按分类筛选并排序任务
                        const filteredAndSortedTasks = [...plan.allocations]
                          .filter(task => selectedCategory === 'all' || task.category === selectedCategory)
                          .sort((a, b) => {
                            const timeA = timeSegmentOrder[a.timeSegment || '放学后'] ?? 99;
                            const timeB = timeSegmentOrder[b.timeSegment || '放学后'] ?? 99;
                            if (timeA !== timeB) return timeA - timeB;

                            const statusA = getTaskStatusOrder(a);
                            const statusB = getTaskStatusOrder(b);
                            if (statusA !== statusB) return statusA - statusB;

                            const orderA = categoryOrder[a.category || ''] ?? 99;
                            const orderB = categoryOrder[b.category || ''] ?? 99;
                            if (orderA !== orderB) return orderA - orderB;

                            const manualA = a.sortOrder ?? 0;
                            const manualB = b.sortOrder ?? 0;
                            if (manualA !== manualB) return manualA - manualB;

                            return a.taskName.localeCompare(b.taskName);
                          });

                        return filteredAndSortedTasks.map((taskItem) => {
                          const hasAssignedDays = taskItem.assignedDays && taskItem.assignedDays.length > 0;
                          const color = getCategoryStyle(taskItem.category);
                          const Icon = color.icon;

                          // 转换前端索引到后端索引
                          const getBackendDayIndex = (frontendIndex: number) => {
                            if (frontendIndex === 6) return 0; // 周日
                            return frontendIndex + 1;
                          };

                          const isTaskAssignedOnDay = (frontendDayIndex: number) => {
                            const backendIndex = getBackendDayIndex(frontendDayIndex);
                            return taskItem.assignedDays && taskItem.assignedDays.includes(backendIndex);
                          };

                          const progressPercent = taskItem.target > 0 ? Math.min(100, Math.round((taskItem.progress / taskItem.target) * 100)) : 0;
                          const stageSummary = taskItem.target > 0
                            ? `本周目标 ${taskItem.target} 次`
                            : `本周安排 ${taskItem.assignedDays?.length || 0} 天`;
                          return (
                            <motion.div 
                              key={taskItem.taskId} 
                              className="group/row mb-2.5 grid grid-cols-[268px_repeat(7,minmax(116px,1fr))] gap-2.5"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, ease: "easeOut" }}
                              whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.7)' }}
                            >
                              <div className="flex min-h-[72px] items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-300 hover:bg-slate-50" title={taskItem.taskName}>
                                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm', color.bg)}>
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className={cn('truncate text-[15px] font-semibold tracking-tight text-slate-950', !hasAssignedDays && 'text-slate-400')}>
                                      {taskItem.taskName}
                                    </p>
                                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{taskItem.progress}/{taskItem.target}</span>
                                  </div>
                                  <p className="mt-1 text-xs font-medium text-slate-500">{stageSummary}</p>
                                  <p className="mt-1 text-[11px] font-medium text-slate-400">{taskItem.timeSegment || '放学后'}</p>
                                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                    <div className={cn('h-full rounded-full', color.bg)} style={{ width: `${progressPercent}%` }} />
                                  </div>
                                </div>
                              </div>
                              {weekDays.map((_, i) => {
                                const isAssigned = isTaskAssignedOnDay(i);
                                const isHoliday = format(weekDates[i], 'MM-dd') === '05-01';
                                const cellStatus = getPlanCellStatus(taskItem, i, weekDates[i], isAssigned);
                                return (
                                  <div
                                    key={i}
                                    className={cn(
                                      'flex min-h-[72px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-1 transition-all duration-300',
                                      isToday(weekDates[i]) && 'border-indigo-100 bg-indigo-50/40',
                                      isHoliday && 'border-rose-50 bg-rose-50/50'
                                    )}
                                  >
                                    <div className="relative">
                                      {isAssigned ? (
                                        <motion.button 
                                          onClick={() => setSelectedTask(taskItem)} 
                                          className={cn(
                                            'flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl shadow-sm transition-all',
                                            getPlanCellClass(cellStatus, color)
                                          )}
                                          title={`${taskItem.taskName} - 点击查看详情`}
                                          whileHover={{ scale: 1.12, boxShadow: '0 8px 16px rgba(15, 23, 42, 0.12)' }}
                                          whileTap={{ scale: 0.95 }}
                                        >
                                          <PlanCellIcon status={cellStatus} />
                                        </motion.button>
                                      ) : (
                                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-300">−</div>
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
                        <div className="rounded-xl bg-slate-50 py-10 text-center text-sm text-muted-foreground">该周暂无任务安排</div>
                      )}
                      {plan.allocations.length > 0 && (
                        <div className="mt-5 flex w-max min-w-full flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-100 pt-4 text-sm">
                          <span className="flex items-center gap-2 whitespace-nowrap text-slate-600"><i className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500 text-white"><Check className="h-3.5 w-3.5" /></i> 已完成</span>
                          <span className="flex items-center gap-2 whitespace-nowrap text-slate-600"><i className="h-6 w-6 rounded-lg border-2 border-slate-200 bg-white" /> 未开始</span>
                          <span className="flex items-center gap-2 whitespace-nowrap text-slate-600"><i className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-slate-400"><Clock className="h-3.5 w-3.5" /></i> 延期</span>
                          <span className="flex items-center gap-2 whitespace-nowrap text-slate-600"><i className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-500 ring-1 ring-rose-100"><X className="h-3.5 w-3.5" /></i> 未完成</span>
                          <span className="whitespace-nowrap text-slate-500">
                            计划 {plan.allocations.length} 项 · 已完成 {plan.allocations.filter((item) => item.progress >= item.target).length} · 剩余 {plan.allocations.filter((item) => item.progress < item.target).length}
                          </span>
                        </div>
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
          childId={parseInt(displayPlan.childId)}
          weekStartDate={currentWeekStart}
          onClose={() => setSelectedTask(null)}
          onRefresh={() => void refreshPlanDependents()}
        />
      )}

      <PublishPlanDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen} tasks={planTasks} selectedChildId={selectedChildId!} selectedChildName={selectedChild?.name} onSuccess={handlePlanPublished} />

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
