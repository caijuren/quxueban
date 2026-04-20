import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  childName: string;
  childAvatar?: string;
  action: string;
  task?: string;
  book?: string;
  time: string;
  type: 'task_complete' | 'book_read' | 'achievement' | 'plan_published';
}

interface RecentActivitiesProps {
  activities: ActivityItem[];
  title?: string;
  onEmptyAction?: () => void;
}

export function RecentActivities({ activities, title = '近期活动', onEmptyAction }: RecentActivitiesProps) {
  // 判断 avatar 是否为可直接展示的 emoji
  const getAvatar = (a: ActivityItem) => {
    if (a.type === 'achievement') return '🏆';
    if (a.type === 'plan_published') return '📅';
    const av = a.childAvatar;
    if (av && av.length <= 2 && !/^[a-zA-Z0-9]+$/.test(av)) return av;
    return a.childName.charAt(0);
  };

  return (
    <Card className="border border-border shadow-sm rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
        <CardTitle className="text-base font-semibold text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {activities.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <Activity className="size-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">暂无活动记录</p>
            {onEmptyAction && (
              <Button variant="outline" size="sm" onClick={onEmptyAction}>
                记录阅读
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={cn(
                  'size-8 rounded-full flex items-center justify-center text-sm font-medium',
                  activity.type === 'achievement' ? 'bg-warning text-white' :
                  activity.type === 'plan_published' ? 'bg-info text-white' :
                  'bg-primary text-white'
                )}>
                  {getAvatar(activity)}
                </div>
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
  );
}
