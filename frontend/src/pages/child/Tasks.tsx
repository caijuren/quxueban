import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Calendar, BookOpen, Dumbbell, Star, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

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
}

type TaskType = '校内任务' | '阅读任务' | '体育运动' | '课外课程';

const typeConfig: Record<string, { icon: any; color: string }> = {
  '校内任务': { icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
  '阅读任务': { icon: BookOpen, color: 'bg-purple-100 text-purple-600' },
  '体育运动': { icon: Dumbbell, color: 'bg-green-100 text-green-600' },
  '课外课程': { icon: Star, color: 'bg-orange-100 text-orange-600' },
};

export default function ChildTasks() {
  const [tasks, setTasks] = useState<ChildTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role === 'child') {
      fetchTasks();
    }
  }, [user]);

  // 判断任务今天是否需要完成
  const isTaskDueToday = (task: ChildTask): boolean => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
    
    // 获取任务的 schedule_rule（优先使用自定义的，否则使用模板的）
    const scheduleRule = task.customScheduleRule || task.schedule_rule || 'daily';
    
    // 检查是否在 excludeDays 中
    if (task.excludeDays) {
      const excludedDays = task.excludeDays.split(',').map(d => parseInt(d.trim()));
      // 将 JS 的 dayOfWeek (0=周日) 转换为后端格式 (1=周一, ..., 7=周日)
      const backendDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      if (excludedDays.includes(backendDay)) {
        return false;
      }
    }
    
    // 根据 schedule_rule 判断
    switch (scheduleRule) {
      case 'daily':
        // 每日任务
        return true;
      
      case 'school':
        // 在校日任务（周一到周五，排除周末）
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      
      case 'weekend':
        // 周末任务（周六、周日）
        return dayOfWeek === 0 || dayOfWeek === 6;
      
      case 'flexible':
        // 智能分配（默认周一到周五）
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      
      default:
        // 默认每日任务
        return true;
    }
  };

  const fetchTasks = async () => {
    if (!user || user.role !== 'child') return;
    
    try {
      console.log('当前用户信息:', user);
      setLoading(true);
      const response = await apiClient.get(`/task-templates/children/${user.id}/tasks`);
      console.log('任务数据:', response.data);
      const tasksData = response.data.data;
      
      // 过滤出今天需要完成的任务，并添加完成状态和进度数据
      const tasksWithStatus = tasksData
        .filter((task: ChildTask) => isTaskDueToday(task))
        .map((task: ChildTask) => ({
          ...task,
          completedToday: Math.random() > 0.5,
          weeklyProgress: Math.floor(Math.random() * 100),
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
    return typeConfig[type] || { icon: BookOpen, color: 'bg-gray-100 text-gray-600' };
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.completedToday).length;
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
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-7 h-7 text-purple-500" />
            我的任务
          </h1>
          <p className="text-gray-500 mt-1">完成今日任务，获得成就感！</p>
        </div>
        <Button 
          variant="default"
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
          onClick={fetchTasks}
        >
          刷新任务
        </Button>
      </motion.div>

      {/* Progress Summary */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              今日进度
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
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
          </CardContent>
        </Card>
      </motion.div>

      {/* Tasks List */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">任务列表</h2>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
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
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无任务</p>
            <p className="text-sm mt-1">家长还没有为你分配任务</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => {
              const TypeIcon = getTaskTypeConfig(task.template_type).icon;
              const typeColor = getTaskTypeConfig(task.template_type).color;
              
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden border border-gray-200 hover:shadow-md transition-shadow duration-300">
                    <CardContent className="p-0">
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer"
                        onClick={() => toggleExpandTask(task.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full ${typeColor} flex items-center justify-center`}>
                            <TypeIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{getTaskName(task)}</h3>
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
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">本周进度</span>
                                <span className="font-medium text-purple-600">{task.weeklyProgress}%</span>
                              </div>
                              <Progress value={task.weeklyProgress} className="h-1.5 bg-gray-200" />
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
      </motion.div>
    </div>
  );
}
