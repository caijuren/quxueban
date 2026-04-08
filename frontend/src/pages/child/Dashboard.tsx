import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FadeIn, Stagger, HoverLift } from '@/components/MotionPrimitives';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
      <HoverLift key={task.id}>
        <Card className={`${config.bgClass} border-2 rounded-xl overflow-hidden`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{task.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{task.name}</h3>
                {task.duration && (
                  <p className="text-xs text-muted-foreground">{task.duration}分钟</p>
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
                    className="flex-1 rounded-lg text-xs"
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'pending' })}
                  >
                    待完成
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === 'completed' ? 'default' : 'outline'}
                    className="flex-1 rounded-lg text-xs"
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'completed' })}
                  >
                    已完成
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === 'school_done' ? 'default' : 'outline'}
                    className="flex-1 rounded-lg text-xs"
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'school_done' })}
                  >
                    学校已完成
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === 'skipped' ? 'default' : 'outline'}
                    className="flex-1 rounded-lg text-xs"
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
                    className="flex-1 rounded-lg text-xs"
                    disabled={task.status === 'pending'}
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'pending' })}
                  >
                    待完成
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === 'completed' ? 'default' : 'outline'}
                    className="flex-1 rounded-lg text-xs"
                    onClick={() => checkinMutation.mutate({ taskId: task.id, status: 'completed' })}
                  >
                    ✓ 完成
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </HoverLift>
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
        <FadeIn>
          <div className="flex items-center justify-between">
            <div>
              <motion.p
                className="text-muted-foreground"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {greeting}
              </motion.p>
              <h1 className="text-2xl font-bold mt-1">
                {user?.name || '小朋友'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{formatDate(new Date())}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-2xl">{user?.avatar || '👶'}</span>
            </div>
          </div>
        </FadeIn>

        {/* Empty State */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 bg-card rounded-2xl border-2 border-dashed border-muted-foreground/20"
        >
          <span className="text-6xl">📭</span>
          <h3 className="text-xl font-semibold mt-4">今天还没有任务哦~</h3>
          <p className="text-muted-foreground mt-2">任务发布后，这里会亮起来！</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <motion.p
              className="text-muted-foreground"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {greeting}
            </motion.p>
            <h1 className="text-2xl font-bold mt-1">
              {user?.name || '小朋友'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{formatDate(new Date())}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-2xl">{user?.avatar || '👶'}</span>
          </div>
        </div>
      </FadeIn>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Core Progress */}
        <FadeIn delay={0.1}>
          <Card className="lg:col-span-2 border-2 border-primary/20 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">核心进度</h2>
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
                      <p className="text-sm text-muted-foreground">已完成</p>
                      <p className="text-2xl font-bold">{completedCount}项</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                      <span className="text-lg">⏱</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">总学习</p>
                      <p className="text-2xl font-bold">{todayPlan?.studyTime || 0}分钟</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Right: Quick Access */}
        <FadeIn delay={0.15}>
          <div className="space-y-3">
            {/* Weekly Plan */}
            <HoverLift>
              <Card className="rounded-xl overflow-hidden cursor-pointer" onClick={() => navigate('/child/weekly-plan')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl">📋</span>
                      <h3 className="font-semibold mt-1">周计划</h3>
                      <p className="text-sm text-muted-foreground">查看本周安排</p>
                    </div>
                    <span className="text-primary">→</span>
                  </div>
                </CardContent>
              </Card>
            </HoverLift>

            {/* Today's Tasks */}
            <HoverLift>
              <Card className="rounded-xl overflow-hidden cursor-pointer" onClick={() => navigate('/child/tasks')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl">✅</span>
                      <h3 className="font-semibold mt-1">今日待办</h3>
                      <p className="text-sm text-muted-foreground">{pendingCount}项</p>
                    </div>
                    <span className="text-primary">→</span>
                  </div>
                </CardContent>
              </Card>
            </HoverLift>

            {/* Quick Start */}
            <HoverLift>
              <Card className="rounded-xl overflow-hidden cursor-pointer" onClick={() => mostImportantTask && navigate('/child/tasks')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl">🚀</span>
                      <h3 className="font-semibold mt-1">快速开始</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {mostImportantTask ? mostImportantTask.name : '点击开始'}
                      </p>
                    </div>
                    <span className="text-primary">→</span>
                  </div>
                </CardContent>
              </Card>
            </HoverLift>
          </div>
        </FadeIn>
      </div>

      {/* Action List */}
      {pendingTasks.length > 0 && (
        <FadeIn delay={0.2}>
          <Card className="border-2 border-primary/20 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>🎯</span> 接下来要做什么？
              </h2>
              <Stagger stagger={0.05} className="space-y-3">
                {pendingTasks.map((task) => (
                  <HoverLift key={task.id}>
                    <div className="flex items-center justify-between p-3 bg-card rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{task.icon}</span>
                        <div className="flex-1">
                          <h3 className="font-semibold">{task.name}</h3>
                          {task.duration && (
                            <p className="text-xs text-muted-foreground">{task.duration}分钟</p>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => navigate('/child/tasks')}
                      >
                        去完成
                      </Button>
                    </div>
                  </HoverLift>
                ))}
              </Stagger>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Task Sections */}
      <AnimatePresence>
        {/* Fixed Tasks */}
        {fixedTasks.length > 0 && (
          <FadeIn delay={0.25}>
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span>📌</span> 固定任务
              </h2>
              <Stagger stagger={0.05} className="space-y-3">
                {fixedTasks.map(renderTaskCard)}
              </Stagger>
            </section>
          </FadeIn>
        )}

        {/* Flexible Tasks */}
        {flexibleTasks.length > 0 && (
          <FadeIn delay={0.3}>
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span>🔄</span> 灵活任务
              </h2>
              <Stagger stagger={0.05} className="space-y-3">
                {flexibleTasks.map(renderTaskCard)}
              </Stagger>
            </section>
          </FadeIn>
        )}

        {/* Makeup Tasks */}
        {makeupTasks.length > 0 && (
          <FadeIn delay={0.35}>
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span>📌</span> 待补任务
              </h2>
              <Stagger stagger={0.05} className="space-y-3">
                {makeupTasks.map(renderTaskCard)}
              </Stagger>
            </section>
          </FadeIn>
        )}

        {/* Advance Tasks */}
        {advanceTasks.length > 0 && (
          <FadeIn delay={0.4}>
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span>⚡</span> 提前任务
              </h2>
              <Stagger stagger={0.05} className="space-y-3">
                {advanceTasks.map(renderTaskCard)}
              </Stagger>
            </section>
          </FadeIn>
        )}
      </AnimatePresence>
    </div>
  );
}
