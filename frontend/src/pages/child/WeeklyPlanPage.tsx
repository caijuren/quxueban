import React, { useState, useMemo } from 'react';
import { CalendarDays, Clock, Target, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, addWeeks, addDays, isToday, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { Calendar as DayPickerCalendar } from '@/components/ui/calendar';

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
}

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const subjectLabel = (s: string | null) => s === 'chinese' ? '语文' : s === 'math' ? '数学' : s === 'english' ? '英语' : s === 'sports' ? '体育' : s || '其他';
const subjectColor = (s: string | null) => s === 'chinese' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : s === 'math' ? 'bg-blue-50 text-blue-700 border border-blue-200' : s === 'english' ? 'bg-purple-50 text-purple-700 border border-purple-200' : s === 'sports' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-600 border border-gray-200';
const diffLabel = (d: string | null) => d === 'basic' ? '基础' : d === 'advanced' ? '提升' : d === 'challenge' ? '挑战' : '';
const ruleLabel = (r: string) => r === 'daily' ? '每日任务' : r === 'school' ? '在校日任务' : r === 'flexible' ? '智能分配' : r === 'weekend' ? '周末任务' : r || '每日任务';

// 孩子端任务详情弹窗（只读版本）
function TaskDetailModal({ task, weekStartDate, onClose }: TaskDetailProps) {
  // 转换后端索引到前端索引
  // 后端: 0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
  // 前端: 0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日
  const getFrontendDayIndex = (backendIndex: number) => {
    if (backendIndex === 0) return 6; // 周日
    return backendIndex - 1; // 其他日期
  };
  
  const assignedDays = useMemo(() => {
    // 优先使用实际分配的天数（后端已存储的 assignedDays）
    if (task.assignedDays && task.assignedDays.length > 0) {
      return task.assignedDays;
    }
    // 如果没有实际分配，根据 scheduleRule 计算默认值
    // 使用 JavaScript 标准索引：0=周日, 1=周一, ..., 6=周六
    switch (task.scheduleRule) {
      case 'daily': return [0, 1, 2, 3, 4, 5, 6];
      case 'school': return [1, 2, 4, 5]; // 周一、周二、周四、周五
      case 'flexible': return [1, 2, 3, 4, 5]; // 周一到周五
      case 'weekend': return [0, 6]; // 周日、周六
      default: return [0, 1, 2, 3, 4, 5, 6];
    }
  }, [task.scheduleRule, task.assignedDays]);

  return (
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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

          {/* 本周安排 */}
          <div>
            <div className='flex items-center justify-between mb-2'>
              <span className='text-sm font-medium text-gray-700'>本周安排</span>
            </div>
            <div className='flex gap-1.5'>
              {weekDays.map((d, i) => {
                const isAssigned = assignedDays.includes(i);
                return (
                  <div
                    key={d}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-xs font-medium transition-all',
                      isAssigned 
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-50 text-gray-300'
                    )}
                  >
                    {d}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

async function fetchWeeklyPlan(weekStart: string): Promise<WeeklyPlan[]> {
  const response = await apiClient.get(`/plans/week/${weekStart}`);
  const data = response.data.data || [];
  // 确保返回的数据结构与前端期望的一致
  return data.map((plan: any) => ({
    ...plan,
    // 确保allocations数组存在
    allocations: plan.allocations || [],
    // 确保dailyProgress数组存在
    dailyProgress: plan.dailyProgress || Array.from({ length: 7 }, (_, i) => ({
      day: i,
      completed: 0,
      total: 0
    }))
  }));
}

export default function WeeklyPlanPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedTask, setSelectedTask] = useState<TaskAllocation | null>(null);

  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));
  const isNextWeek = isSameDay(currentWeekStart, startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }));

  const { data: weeklyPlans, isLoading: plansLoading, error } = useQuery({
    queryKey: ['weekly-plan', format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: () => fetchWeeklyPlan(format(currentWeekStart, 'yyyy-MM-dd')),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-purple-500" />
            我的周计划
          </h1>
          <p className="text-gray-500 mt-1">查看本周所有任务安排</p>
        </div>
        <div className="flex gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" className="rounded-2xl px-6 h-11">
                <span className="text-sm font-medium text-gray-700">{weekLabel}</span>
                <ChevronDown className="size-4 text-gray-400 ml-2" />
              </Button>
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
          {(weeklyPlans && weeklyPlans.length > 0 ? weeklyPlans : [{id: "empty", childId: "0", childName: "我的学习计划", allocations: [], dailyProgress: []}]).map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
            >
              <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-gray-200/70 transition-all duration-300">
                <CardHeader className="pb-3 pt-6 px-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* 左侧：标题和图例 */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* 图例 - 优化排列 */}
                        <div className="flex flex-wrap gap-4 justify-around w-full">
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-100 shadow-sm text-sm font-medium text-gray-600 hover:shadow transition-shadow cursor-default">
                            <span className="w-3 h-3 rounded-full bg-blue-400" />校内作业
                          </span>
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-100 shadow-sm text-sm font-medium text-gray-600 hover:shadow transition-shadow cursor-default">
                            <span className="w-3 h-3 rounded-full bg-indigo-400" />拔高训练
                          </span>
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-100 shadow-sm text-sm font-medium text-gray-600 hover:shadow transition-shadow cursor-default">
                            <span className="w-3 h-3 rounded-full bg-purple-400" />课外课程
                          </span>
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-100 shadow-sm text-sm font-medium text-gray-600 hover:shadow transition-shadow cursor-default">
                            <span className="w-3 h-3 rounded-full bg-emerald-400" />语文阅读
                          </span>
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-100 shadow-sm text-sm font-medium text-gray-600 hover:shadow transition-shadow cursor-default">
                            <span className="w-3 h-3 rounded-full bg-orange-400" />英语学习
                          </span>
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-100 shadow-sm text-sm font-medium text-gray-600 hover:shadow transition-shadow cursor-default">
                            <span className="w-3 h-3 rounded-full bg-yellow-400" />体育任务
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-6">
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      {/* Day headers */}
                      <div className="grid grid-cols-8 gap-2 mb-3">
                        <div className="p-2"></div>
                        {weekDays.map((day, i) => {
                          const date = weekDates[i];
                          const isTodayDate = isToday(date);
                          // 转换前端索引到后端索引
                          // 前端: 0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日
                          // 后端: 0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
                          const getBackendDayIndex = (frontendIndex: number) => {
                            if (frontendIndex === 6) return 0; // 周日
                            return frontendIndex + 1; // 其他日期
                          };
                          const backendDayIndex = getBackendDayIndex(i);
                          const dayTasks = plan.allocations.filter(a => a.assignedDays.includes(backendDayIndex));
                          const dayTotalMin = dayTasks.reduce((s, a) => s + a.timePerUnit, 0);
                          return (
                            <div key={day} className={cn('p-3 text-center rounded-2xl transition-all duration-300', isTodayDate ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25' : 'bg-gray-50 hover:bg-gray-100')}>
                              <span className={cn('text-[10px] font-medium', isTodayDate ? 'text-white/80' : 'text-gray-500')}>{day}</span>
                              <div className={cn('text-sm font-bold mt-1', isTodayDate ? 'text-white' : 'text-gray-700')}>{format(date, 'M/d')}</div>
                              {dayTotalMin > 0 && <span className={cn('text-[9px] mt-1 block', isTodayDate ? 'text-white/70' : 'text-gray-400')}>{dayTotalMin}m</span>}
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

                        // 按分类排序后直接渲染任务
                        const sortedTasks = [...plan.allocations].sort((a, b) => {
                          const orderA = categoryOrder[a.category || ''] ?? 99;
                          const orderB = categoryOrder[b.category || ''] ?? 99;
                          if (orderA !== orderB) return orderA - orderB;
                          return a.taskName.localeCompare(b.taskName);
                        });

                        return sortedTasks.map((taskItem) => {
                          const hasAssignedDays = taskItem.assignedDays && taskItem.assignedDays.length > 0;
                          const color = getCategoryColor(taskItem.category);

                          // 转换前端索引到后端索引
                          const getBackendDayIndex = (frontendDayIndex: number) => {
                            if (frontendDayIndex === 6) return 0; // 周日
                            return frontendDayIndex + 1;
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
                              className="grid grid-cols-8 gap-2 group/row mb-1.5"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, ease: "easeOut" }}
                              whileHover={{ backgroundColor: 'rgba(249, 250, 251, 0.5)' }}
                            >
                              <div className="p-2.5 flex items-center gap-2 pr-3 rounded-2xl hover:bg-gray-50 transition-all duration-300" title={taskItem.taskName}>
                                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', getDotColor())} />
                                <span className={cn('text-sm font-medium truncate', !hasAssignedDays && 'text-gray-400')}>
                                  {taskItem.taskName}
                                  {!hasAssignedDays && <span className="ml-1 text-xs text-gray-400">(未分配)</span>}
                                </span>
                              </div>
                              {weekDays.map((_, i) => {
                                const isAssigned = isTaskAssignedOnDay(i);
                                const dayProgress = plan.dailyProgress.find(d => d.day === i);
                                const isCompleted = isCurrentWeek && dayProgress && isAssigned && dayProgress.completed > 0;

                                return (
                                  <div key={i} className={cn('p-2.5 flex items-center justify-center rounded-2xl min-h-[40px] transition-all duration-300', isToday(weekDates[i]) && 'bg-purple-50/70 hover:bg-purple-100/70')}>
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
                                        <div className="w-6 h-6 rounded-full bg-gray-200 shadow-sm"></div>
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
                        <div className="py-12 text-center text-gray-400 text-sm bg-gray-50 rounded-2xl">该周暂无任务安排</div>
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
        />
      )}
    </div>
  );
}
