import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  CalendarPlus,
  Clock,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Users,
  ChevronRight,
  Target,
  Award,
  LayoutDashboard
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

// Types
interface Child {
  id: string;
  name: string;
  avatar?: string;
  weeklyProgress: number;
  todayMinutes: number;
  completedTasks: number;
  totalTasks: number;
}

interface Activity {
  id: string;
  childName: string;
  childAvatar?: string;
  action: string;
  task?: string;
  book?: string;
  time: string;
  type: 'task_complete' | 'book_read' | 'achievement' | 'plan_published';
}

interface DashboardStats {
  totalTasks: number;
  weeklyCompletionRate: number;
  todayStudyMinutes: number;
  booksRead: number;
}

// API functions
async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get('/dashboard/stats');
  return response.data.data;
}

async function fetchChildren(): Promise<Child[]> {
  const response = await apiClient.get('/auth/children');
  return response.data.data;
}

async function fetchActivities(): Promise<Activity[]> {
  const response = await apiClient.get('/dashboard/activities');
  return response.data.data;
}

export default function ParentDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 5 * 60 * 1000
  });

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
    staleTime: 5 * 60 * 1000
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: fetchActivities,
    staleTime: 60 * 1000
  });

  const statCards = [
    {
      title: '总任务数',
      value: stats?.totalTasks || 0,
      icon: Target,
      gradient: 'from-purple-500 to-violet-500',
      lightColor: 'bg-purple-50 text-purple-600'
    },
    {
      title: '本周完成率',
      value: `${stats?.weeklyCompletionRate || 0}%`,
      icon: TrendingUp,
      gradient: 'from-blue-500 to-cyan-500',
      lightColor: 'bg-blue-50 text-blue-600'
    },
    {
      title: '今日学习时长',
      value: `${stats?.todayStudyMinutes || 0}分钟`,
      icon: Clock,
      gradient: 'from-emerald-500 to-teal-500',
      lightColor: 'bg-emerald-50 text-emerald-600'
    },
    {
      title: '阅读书籍',
      value: stats?.booksRead || 0,
      icon: BookOpen,
      gradient: 'from-orange-500 to-amber-500',
      lightColor: 'bg-orange-50 text-orange-600'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-purple-500" />
            概览
          </h1>
          <p className="text-gray-500 mt-1">查看孩子们的学习进度和活动</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="rounded-xl h-11 border-gray-200 hover:bg-gray-50">
            <Link to="/parent/tasks">
              <Plus className="size-4 mr-2" />
              <span>添加任务</span>
            </Link>
          </Button>
          <Button asChild className="rounded-xl h-11 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25">
            <Link to="/parent/plans">
              <CalendarPlus className="size-4 mr-2" />
              <span>发布下周计划</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-lg shadow-gray-200/50 rounded-2xl">
              <CardContent className="p-5">
                <div className={cn("size-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br", stat.gradient)}>
                  <stat.icon className="size-5 text-white" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.title}</p>
              </CardContent>
              <div className={cn("absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-5 rounded-full -translate-y-8 translate-x-8", stat.gradient)} />
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Children Overview & Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Children Overview */}
        <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Users className="size-4 text-white" />
              </div>
              孩子概览
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-gray-500 hover:text-gray-900">
              <Link to="/parent/children">
                查看全部
                <ChevronRight className="size-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            {childrenLoading ? (
              <>
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              children?.map((child, index) => (
                <motion.div
                  key={child.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors"
                >
                  <Avatar className="size-12 ring-2 ring-white shadow-md">
                    <AvatarImage src={child.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
                      {child.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{child.name}</span>
                      <span className="text-sm text-gray-500">
                        今日 {child.todayMinutes}分钟
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={child.weeklyProgress} className="flex-1 h-2 bg-gray-200" />
                      <span className="text-sm font-medium text-gray-700 w-10">
                        {child.weeklyProgress}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs bg-white border border-gray-100">
                        <CheckCircle2 className="size-3 mr-1" />
                        {child.completedTasks}/{child.totalTasks} 任务
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center">
                <Award className="size-4 text-white" />
              </div>
              最近活动
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {activitiesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="size-10 rounded-xl" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {activities?.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors"
                  >
                    <Avatar className="size-10 ring-2 ring-white shadow-sm">
                      <AvatarImage src={activity.childAvatar} />
                      <AvatarFallback className={cn(
                        'text-sm font-medium',
                        activity.type === 'achievement' ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white' :
                        activity.type === 'plan_published' ? 'bg-gradient-to-br from-blue-400 to-cyan-400 text-white' :
                        'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                      )}>
                        {activity.type === 'achievement' ? '🏆' :
                         activity.type === 'plan_published' ? '📅' :
                         activity.childName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{activity.childName}</span>
                        {' '}{activity.action}
                        {activity.task && <span className="text-purple-600 font-medium"> {activity.task}</span>}
                        {activity.book && <span className="text-purple-600 font-medium"> 《{activity.book}》</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
