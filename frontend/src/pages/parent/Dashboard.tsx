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
import { useSelectedChild } from '@/contexts/SelectedChildContext';

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
async function fetchDashboardStats(childId?: number): Promise<DashboardStats> {
  const params = childId ? { childId } : {};
  const response = await apiClient.get('/dashboard/stats', { params });
  return response.data.data;
}

async function fetchChildren(): Promise<Child[]> {
  const response = await apiClient.get('/auth/children');
  return response.data.data;
}

async function fetchActivities(childId?: number): Promise<Activity[]> {
  const params = childId ? { childId } : {};
  const response = await apiClient.get('/dashboard/activities', { params });
  return response.data.data;
}

export default function ParentDashboard() {
  const { selectedChildId } = useSelectedChild();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', selectedChildId],
    queryFn: () => fetchDashboardStats(selectedChildId || undefined),
    staleTime: 5 * 60 * 1000
  });

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
    staleTime: 5 * 60 * 1000
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities', selectedChildId],
    queryFn: () => fetchActivities(selectedChildId || undefined),
    staleTime: 60 * 1000
  });

  const statCards = [
    {
      title: '总任务数',
      value: stats?.totalTasks || 0,
      icon: Target,
      borderColor: 'border-primary',
      iconColor: 'bg-primary/10 text-primary'
    },
    {
      title: '本周完成率',
      value: `${stats?.weeklyCompletionRate || 0}%`,
      icon: TrendingUp,
      borderColor: 'border-[#0CAF60]',
      iconColor: 'bg-[#0CAF60]/10 text-[#0CAF60]'
    },
    {
      title: '今日学习时长',
      value: `${stats?.todayStudyMinutes || 0}分钟`,
      icon: Clock,
      borderColor: 'border-[#339AF0]',
      iconColor: 'bg-[#339AF0]/10 text-[#339AF0]'
    },
    {
      title: '阅读书籍',
      value: stats?.booksRead || 0,
      icon: BookOpen,
      borderColor: 'border-[#17A2B8]',
      iconColor: 'bg-[#17A2B8]/10 text-[#17A2B8]'
    }
  ];

  return (
    <div className="space-y-6">


      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={cn("border border-border shadow-sm rounded-lg", stat.borderColor)}>
              <CardContent className="p-4">
                <div className={cn("size-10 rounded-lg flex items-center justify-center mb-3", stat.iconColor)}>
                  <stat.icon className="size-5" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Children Overview & Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Children Overview */}
        <Card className="border border-border shadow-sm rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary shadow-sm">
                <Users className="size-4 text-white" />
              </div>
              孩子概览
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link to="/parent/children">
                查看全部
                <ChevronRight className="size-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {childrenLoading ? (
              <>
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                    <Skeleton className="size-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-2 w-3/4" />
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
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Avatar className="size-10 ring-2 ring-white shadow-sm">
                    <AvatarImage src={child.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-medium">
                      {child.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-foreground">{child.name}</span>
                      <span className="text-xs text-muted-foreground">
                        今日 {child.todayMinutes}分钟
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={child.weeklyProgress} className="flex-1 h-2 bg-muted" />
                      <span className="text-xs font-medium text-foreground w-8">
                        {child.weeklyProgress}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs bg-muted text-foreground">
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
        <Card className="border border-border shadow-sm rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning shadow-sm">
                <Award className="size-4 text-white" />
              </div>
              最近活动
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {activitiesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg">
                    <Skeleton className="size-8 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {activities?.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="size-8 ring-2 ring-white shadow-sm">
                      <AvatarImage src={activity.childAvatar} />
                      <AvatarFallback className={cn(
                        'text-xs font-medium',
                        activity.type === 'achievement' ? 'bg-warning text-white' :
                        activity.type === 'plan_published' ? 'bg-info text-white' :
                        'bg-primary text-white'
                      )}>
                        {activity.type === 'achievement' ? '🏆' :
                         activity.type === 'plan_published' ? '📅' :
                         activity.childName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{activity.childName}</span>
                        {' '}{activity.action}
                        {activity.task && <span className="text-primary font-medium"> {activity.task}</span>}
                        {activity.book && <span className="text-primary font-medium"> 《{activity.book}》</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
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
