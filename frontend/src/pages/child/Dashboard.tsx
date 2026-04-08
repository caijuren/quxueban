import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Target, Clock, Calendar, BookOpen, CheckCircle2, LayoutDashboard } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Task {
  id: number;
  name: string;
  icon: string;
  type: 'fixed' | 'flexible' | 'makeup' | 'advance';
  status: 'pending' | 'completed' | 'skipped' | 'school_done';
  duration?: number;
}

interface TodayPlan {
  date: string;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  studyTime: number;
}

const taskTypeConfig = {
  fixed: { label: '固定任务', emoji: '📌', bgClass: 'bg-card' },
  flexible: { label: '灵活任务', emoji: '🔄', bgClass: 'bg-card' },
  makeup: { label: '待补', emoji: '📌', bgClass: 'bg-warning/10 border-warning/30' },
  advance: { label: '提前', emoji: '⚡', bgClass: 'bg-info/10 border-info/30' },
};

const statusConfig = {
  pending: { label: '待完成', color: 'secondary' },
  completed: { label: '已完成', color: 'success' },
  skipped: { label: '跳过', color: 'warning' },
  school_done: { label: '学校已完成', color: 'info' },
};

function getDynamicGreeting(completionRate: number): string {
  const hour = new Date().getHours();
  let timeGreeting = '';
  
  if (hour < 6) timeGreeting = '夜深了';
  else if (hour < 9) timeGreeting = '早上好';
  else if (hour < 12) timeGreeting = '上午好';
  else if (hour < 14) timeGreeting = '中午好';
  else if (hour < 18) timeGreeting = '下午好';
  else if (hour < 22) timeGreeting = '晚上好';
  else timeGreeting = '夜深了';
  
  if (completionRate >= 100) {
    return `${timeGreeting}！太棒了，今天的任务都完成啦！🎉`;
  } else if (completionRate >= 50) {
    return `${timeGreeting}！已经完成了一半任务，继续加油！💪`;
  } else if (completionRate > 0) {
    return `${timeGreeting}！开始学习啦，坚持就是胜利！🌟`;
  } else {
    return `${timeGreeting}！今天的学习之旅开始啦！🚀`;
  }
}

function formatDate(date: Date): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = days[date.getDay()];
  return `${month}月${day}日 ${weekday}`;
}

function ProgressCircle({ value, size = 120 }: { value: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-primary"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-primary">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

export default function ChildDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: todayPlan, isLoading } = useQuery({
    queryKey: ['plans', 'today'],
    queryFn: async () => {
      const response = await apiClient.get<TodayPlan>('/plans/today');
      return response.data;
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      await apiClient.post('/plans/checkin', { taskId, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans', 'today'] });
      toast.success('状态已更新~');
    },
    onError: () => {
      toast.error('更新失败，请重试');
    },
  });

  const tasks = todayPlan?.tasks || [];
  const completionRate = todayPlan
    ? (todayPlan.completedCount / Math.max(todayPlan.totalCount, 1)) * 100
    : 0;

  const fixedTasks = tasks.filter((t) => t.type === 'fixed');
  const flexibleTasks = tasks.filter((t) => t.type === 'flexible');
  const makeupTasks = tasks.filter((t) => t.type === 'makeup');
  const advanceTasks = tasks.filter((t) => t.type === 'advance');

  const completedCount = tasks.filter((t) => t.status === 'completed' || t.status === 'school_done').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  
  // Get pending tasks for action list
  const pendingTasks = tasks.filter((t) => t.status === 'pending').slice(0, 3);
  
  // Get most important task for quick start
  const mostImportantTask = pendingTasks[0];

  const renderTaskCard = (task: Task) => {
    const config = taskTypeConfig[task.type];
    const status = statusConfig[task.status as keyof typeof statusConfig];

    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={`${config.bgClass} border-0 shadow-lg shadow-gray-200/50 rounded-2xl overflow-hidden`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{task.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{task.name}</h3>
                {task.duration && (
                  <p className="text-xs text-gray-500">{task.duration}分钟</p>
                )}
              </div>
              <Badge variant={status.color as 'secondary' | 'success' | 'warning' | 'info'}>
                {status.label}
              </Badge>
            </div>

            {/* Status Buttons */}
            <div className="mt-3 flex gap-2">
              {task.type === 'flexible' ? (
                // Flexible tasks have 4 states
                <>
                  <Button
                    size="sm"
                    variant={task.status === 'pending' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl ${task.status === 'pending' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'pending' })}
                  >
                    待完成
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === 'completed' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl ${task.status === 'completed' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'completed' })}
                  >
                    已完成
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === 'school_done' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl ${task.status === 'school_done' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'school_done' })}
                  >
                    学校已完成
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === 'skipped' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl ${task.status === 'skipped' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'skipped' })}
                  >
                    跳过
                  </Button>
                </>
              ) : (
                // Fixed/makeup/advance tasks have simple toggle
                <>
                  <Button
                    size="sm"
                    variant={task.status === 'pending' ? 'secondary' : 'outline'}
                    className={`flex-1 rounded-xl ${task.status === 'pending' ? 'bg-gray-100 text-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}
                    disabled={task.status === 'pending'}
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'pending' })}
                  >
                    待完成
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === 'completed' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl ${task.status === 'completed' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'completed' })}
                  >
                    ✓ 完成
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-4xl"
        >
          ⏳
        </motion.div>
      </div>
    );
  }

  const greeting = getDynamicGreeting(completionRate);

  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutDashboard className="w-7 h-7 text-purple-500" />
              首页
            </h1>
            <p className="text-gray-500 mt-1">{greeting}</p>
            <p className="text-sm text-gray-500 mt-1">{formatDate(new Date())}</p>
          </div>
          <Avatar className="size-12 ring-2 ring-white shadow-md">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
              {user?.name?.charAt(0) || 'C'}
            </AvatarFallback>
          </Avatar>
        </motion.div>

        {/* Empty State */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 bg-white rounded-3xl shadow-lg shadow-gray-200/50"
        >
          <span className="text-6xl">📭</span>
          <h3 className="text-xl font-semibold mt-4 text-gray-900">今天还没有任务哦~</h3>
          <p className="text-gray-500 mt-2">任务发布后，这里会亮起来！</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-purple-500" />
            首页
          </h1>
          <p className="text-gray-500 mt-1">{greeting}</p>
          <p className="text-sm text-gray-500 mt-1">{formatDate(new Date())}</p>
        </div>
        <Avatar className="size-12 ring-2 ring-white shadow-md">
          <AvatarImage src={user?.avatar} />
          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
            {user?.name?.charAt(0) || 'C'}
          </AvatarFallback>
        </Avatar>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="size-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-purple-500 to-violet-500">
                <Target className="size-5 text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{tasks.length}</p>
              <p className="text-sm text-gray-500 mt-1">总任务数</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="size-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-blue-500 to-cyan-500">
                <CheckCircle2 className="size-5 text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{completedCount}</p>
              <p className="text-sm text-gray-500 mt-1">已完成</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="size-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-emerald-500 to-teal-500">
                <Clock className="size-5 text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{todayPlan?.studyTime || 0}</p>
              <p className="text-sm text-gray-500 mt-1">学习分钟</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="size-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-orange-500 to-amber-500">
                <Calendar className="size-5 text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{Math.round(completionRate)}%</p>
              <p className="text-sm text-gray-500 mt-1">完成率</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Core Progress */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Target className="size-4 text-white" />
                </div>
                核心进度
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <ProgressCircle value={completionRate} size={140} />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                      <span className="text-lg">✅</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">已完成</p>
                      <p className="text-2xl font-bold text-gray-900">{completedCount}项</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                      <span className="text-lg">⏱</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">总学习</p>
                      <p className="text-2xl font-bold text-gray-900">{todayPlan?.studyTime || 0}分钟</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right: Quick Access */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="space-y-4">
            {/* Weekly Plan */}
            <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300" onClick={() => navigate('/child/weekly-plan')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
                      <Calendar className="size-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">周计划</h3>
                    <p className="text-sm text-gray-500 mt-1">查看本周安排</p>
                  </div>
                  <span className="text-primary">→</span>
                </div>
              </CardContent>
            </Card>

            {/* Today's Tasks */}
            <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300" onClick={() => navigate('/child/tasks')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-3">
                      <CheckCircle2 className="size-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">今日待办</h3>
                    <p className="text-sm text-gray-500 mt-1">{pendingCount}项</p>
                  </div>
                  <span className="text-primary">→</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Start */}
            <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300" onClick={() => mostImportantTask && navigate('/child/tasks')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-3">
                      <BookOpen className="size-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">快速开始</h3>
                    <p className="text-sm text-gray-500 mt-1 truncate">
                      {mostImportantTask ? mostImportantTask.name : '点击开始'}
                    </p>
                  </div>
                  <span className="text-primary">→</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>

      {/* Action List */}
      {pendingTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Target className="size-4 text-white" />
                </div>
                接下来要做什么？
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-4">
                {pendingTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 rounded-2xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{task.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{task.name}</h3>
                        {task.duration && (
                          <p className="text-xs text-gray-500">{task.duration}分钟</p>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="default" 
                      size="sm"
                      className="rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                      onClick={() => navigate('/child/tasks')}
                    >
                      去完成
                    </Button>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Task Sections */}
      <AnimatePresence>
        {/* Fixed Tasks */}
        {fixedTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <BookOpen className="size-4 text-white" />
                  </div>
                  固定任务
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-4">
                  {fixedTasks.map(renderTaskCard)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Flexible Tasks */}
        {flexibleTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <BookOpen className="size-4 text-white" />
                  </div>
                  灵活任务
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-4">
                  {flexibleTasks.map(renderTaskCard)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Makeup Tasks */}
        {makeupTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                    <BookOpen className="size-4 text-white" />
                  </div>
                  待补任务
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-4">
                  {makeupTasks.map(renderTaskCard)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Advance Tasks */}
        {advanceTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <BookOpen className="size-4 text-white" />
                  </div>
                  提前任务
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-4">
                  {advanceTasks.map(renderTaskCard)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
