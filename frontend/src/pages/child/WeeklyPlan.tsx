import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Calendar, BookOpen, Dumbbell, Star, ChevronDown, ChevronUp, Award, Circle, CircleCheck, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface ChildTask {
  id: number;
  childId: number;
  taskTemplateId: number;
  customName: string | null;
  customDuration: number | null;
  customScheduleRule: string | null;
  weeklyTarget: number | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  skipHolidays: boolean;
  excludeDays: string | null;
  familyId: number;
  createdAt: string;
  updatedAt: string;
  template_name: string;
  template_type: string;
  subject: string | null;
  template_duration: number;
  schedule_rule?: string;
  completedToday?: boolean;
  weeklyProgress?: number;
  assignedDays?: number[];
}

type TaskType = '校内任务' | '阅读任务' | '体育运动' | '课外课程';

const typeConfig: Record<string, { icon: any; color: string; gradient: string }> = {
  '校内任务': { icon: BookOpen, color: 'bg-blue-100 text-blue-600', gradient: 'from-blue-500 to-cyan-500' },
  '阅读任务': { icon: BookOpen, color: 'bg-purple-100 text-purple-600', gradient: 'from-purple-500 to-violet-500' },
  '体育运动': { icon: Dumbbell, color: 'bg-green-100 text-green-600', gradient: 'from-emerald-500 to-teal-500' },
  '课外课程': { icon: Star, color: 'bg-orange-100 text-orange-600', gradient: 'from-orange-500 to-amber-500' },
};

// 生成本周日期
const generateWeekDays = () => {
  const days = [];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
  
  // 从周一开始
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    const diff = i - dayOfWeek;
    date.setDate(today.getDate() + diff);
    
    days.push({
      date,
      dayOfWeek: i,
      isToday: i === dayOfWeek,
      dayName: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i - 1]
    });
  }
  
  return days;
};

// 判断任务在某天是否需要完成
const isTaskDueOnDay = (task: ChildTask, dayOfWeek: number): boolean => {
  // 首先检查任务是否有 assignedDays 字段
  if (task.assignedDays && Array.isArray(task.assignedDays)) {
    // 转换 dayOfWeek 为 JavaScript 标准索引（1-7 转换为 0-6，1=周一=1, 7=周日=0）
    const jsDayOfWeek = dayOfWeek === 7 ? 0 : dayOfWeek - 1;
    return task.assignedDays.includes(jsDayOfWeek);
  }
  
  // 如果没有 assignedDays 字段，回退到使用 schedule_rule
  const scheduleRule = task.customScheduleRule || task.schedule_rule || 'daily';
  
  // 检查是否在 excludeDays 中
  if (task.excludeDays) {
    const excludedDays = task.excludeDays.split(',').map((d: string) => parseInt(d.trim()));
    if (excludedDays.includes(dayOfWeek)) {
      return false;
    }
  }
  
  // 根据 schedule_rule 判断
  switch (scheduleRule) {
    case 'daily':
      return true;
    case 'school':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekend':
      return dayOfWeek === 6 || dayOfWeek === 7;
    case 'flexible':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    default:
      return true;
  }
};

export default function WeeklyPlan() {
  const [tasks, setTasks] = useState<ChildTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const { user } = useAuth();
  const weekDays = generateWeekDays();
  
  useEffect(() => {
    if (user && user.role === 'child') {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user || user.role !== 'child') return;
    
    try {
      setLoading(true);
      const response = await apiClient.get('/plans/week');
      const tasksData = response.data.data;
      
      // 添加完成状态和进度数据
      const tasksWithStatus = tasksData.allocations.map((task: any) => ({
        id: task.taskId,
        taskTemplateId: task.taskId,
        template_name: task.taskName,
        template_type: task.category,
        subject: task.subject,
        template_duration: task.timePerUnit,
        schedule_rule: task.scheduleRule,
        weeklyTarget: task.target,
        completedToday: false,
        weeklyProgress: (task.progress / task.target) * 100,
        assignedDays: task.assignedDays
      }));
      
      setTasks(tasksWithStatus);
    } catch (error) {
      console.error('获取任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskCompletion = (taskId: number) => {
    setTasks(tasks.map(task => 
      task.id === taskId 
        ? { ...task, completedToday: !task.completedToday }
        : task
    ));
  };

  const toggleExpandTask = (taskId: number) => {
    setExpandedTask(expandedTask === taskId ? null : taskId);
  };

  const getTaskName = (task: ChildTask) => {
    return task.customName || task.template_name;
  };

  const getTaskDuration = (task: ChildTask) => {
    return task.customDuration || task.template_duration;
  };

  const getTaskTypeConfig = (type: string) => {
    return typeConfig[type] || { icon: BookOpen, color: 'bg-gray-100 text-gray-600', gradient: 'from-gray-500 to-gray-600' };
  };

  // 过滤出今天的任务
  const todayTasks = useMemo(() => {
    const today = new Date().getDay(); // 0=周日, 1=周一, ..., 6=周六
    const backendDay = today === 0 ? 7 : today;
    return tasks.filter(task => isTaskDueOnDay(task, backendDay));
  }, [tasks]);

  const totalTasks = todayTasks.length;
  const completedTasks = todayTasks.filter(task => task.completedToday).length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  if (!user || user.role !== 'child') {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <CheckCircle2 className="w-16 h-16 mb-4 opacity-30" />
        <h2 className="text-xl font-semibold mb-2">请以孩子身份登录</h2>
        <p className="text-center max-w-md">只有孩子账号才能查看和完成任务</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-purple-500" />
            周计划与今日任务
          </h1>
          <p className="text-gray-500 mt-1">合理安排时间，完成每日任务！</p>
        </div>
        <Button 
          variant="default"
          className="rounded-xl h-11 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25"
          onClick={fetchTasks}
        >
          刷新任务
        </Button>
      </motion.div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Weekly Plan Preview */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-1"
        >
          <Card className="h-full border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Calendar className="size-4 text-white" />
                </div>
                我的本周计划
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-4">
                {weekDays.map((day, index) => {
                  const backendDay = day.dayOfWeek;
                  const dayTasks = tasks.filter(task => isTaskDueOnDay(task, backendDay));
                  
                  return (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-4 rounded-2xl ${day.isToday ? 'bg-purple-50 border border-purple-200' : 'bg-white border border-gray-100'}`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`font-medium ${day.isToday ? 'text-purple-600' : 'text-gray-900'}`}>
                          {day.dayName}
                        </span>
                        <span className="text-sm text-gray-500">
                          {day.date.getMonth() + 1}月{day.date.getDate()}日
                        </span>
                      </div>
                      <div className="space-y-3 ml-2">
                        {dayTasks.length === 0 ? (
                          <span className="text-sm text-gray-400">无任务</span>
                        ) : (
                          dayTasks.map((task, taskIndex) => {
                            const isCompleted = day.isToday && task.completedToday;
                            const TypeIcon = getTaskTypeConfig(task.template_type).icon;
                            return (
                              <motion.div 
                                key={task.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: taskIndex * 0.05 }}
                                className="flex items-center gap-3 text-sm"
                              >
                                {isCompleted ? (
                                  <CircleCheck className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Circle className="w-4 h-4 text-gray-300" />
                                )}
                                <TypeIcon className="w-4 h-4 text-gray-500" />
                                <span className={`${isCompleted ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                                  {getTaskName(task)}
                                </span>
                              </motion.div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column - Today's Tasks */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="h-full border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                今日任务 ({new Date().getMonth() + 1}月{new Date().getDate()}日 {weekDays.find(day => day.isToday)?.dayName})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {/* Progress Summary */}
              <div className="mb-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">完成率</span>
                  <span className="text-sm font-bold text-purple-600">{Math.round(completionRate)}%</span>
                </div>
                <Progress value={completionRate} className="h-2 bg-gray-200" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>已完成 {completedTasks} 项</span>
                  <span>共 {totalTasks} 项任务</span>
                </div>
              </div>

              {/* Tasks List */}
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="border-0 shadow-md">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                          </div>
                          <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : todayTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>今日暂无任务</p>
                  <p className="text-sm mt-1">好好休息一下吧！</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayTasks.map(task => {
                    const TypeIcon = getTaskTypeConfig(task.template_type).icon;
                    const typeGradient = getTaskTypeConfig(task.template_type).gradient;
                    
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl overflow-hidden">
                          <CardContent className="p-0">
                            <div 
                              className="flex items-center justify-between p-5 cursor-pointer"
                              onClick={() => toggleExpandTask(task.id)}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeGradient} flex items-center justify-center text-white`}>
                                  <TypeIcon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900">{getTaskName(task)}</h3>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{getTaskDuration(task)}分钟</span>
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>{task.customScheduleRule || task.template_type}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Button
                                  variant={task.completedToday ? "default" : "outline"}
                                  size="icon"
                                  className={`w-10 h-10 rounded-full ${task.completedToday ? 'bg-green-500 hover:bg-green-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTaskCompletion(task.id);
                                  }}
                                >
                                  <CheckCircle2 className={`w-5 h-5 ${task.completedToday ? '' : 'text-gray-400'}`} />
                                </Button>
                                {expandedTask === task.id ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                            </div>
                            {expandedTask === task.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <Separator />
                                <div className="p-5 space-y-4">
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">本周进度</span>
                                      <span className="font-medium text-purple-600">{task.weeklyProgress}%</span>
                                    </div>
                                    <Progress value={task.weeklyProgress} className="h-2 bg-gray-200" />
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    <p><strong>任务类型：</strong>{task.template_type}</p>
                                    {task.subject && <p><strong>学科：</strong>{task.subject}</p>}
                                    <p><strong>目标：</strong>每周完成 {task.weeklyTarget || 5} 次</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
