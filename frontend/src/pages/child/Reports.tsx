import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FadeIn, Stagger } from '@/components/MotionPrimitives';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TaskStatus {
  id: number;
  name: string;
  icon: string;
  status: 'completed' | 'pending' | 'skipped' | 'school_done';
}

interface DailyReport {
  date: string;
  completedCount: number;
  totalCount: number;
  completionRate: number;
  studyTime: number;
  tasks: TaskStatus[];
  weekProgress: { date: string; rate: number }[];
}

const statusLabels = {
  completed: { label: '已完成', emoji: '✅', color: 'success' },
  pending: { label: '未完成', emoji: '⏳', color: 'secondary' },
  skipped: { label: '跳过', emoji: '⏭️', color: 'warning' },
  school_done: { label: '学校已完成', emoji: '🏫', color: 'info' },
};

function ProgressCircle({ value, size = 100 }: { value: number; size?: number }) {
  const strokeWidth = 8;
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
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-primary">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const selectedDate = new Date().toISOString().split('T')[0];

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', 'daily', selectedDate],
    queryFn: async () => {
      try {
        const response = await apiClient.get<DailyReport>('/reports/daily', {
          params: { date: selectedDate },
        });
        return response.data;
      } catch {
        // Return mock data for development
        return {
          date: selectedDate,
          completedCount: 5,
          totalCount: 8,
          completionRate: 62.5,
          studyTime: 90,
          tasks: [
            { id: 1, name: '语文作业', icon: '📝', status: 'completed' },
            { id: 2, name: '数学练习', icon: '🧮', status: 'completed' },
            { id: 3, name: '英语听力', icon: '🔤', status: 'completed' },
            { id: 4, name: '阅读30分钟', icon: '📖', status: 'completed' },
            { id: 5, name: '体育锻炼', icon: '⚽', status: 'school_done' },
            { id: 6, name: '科学实验', icon: '🔬', status: 'pending' },
            { id: 7, name: '钢琴练习', icon: '🎹', status: 'skipped' },
            { id: 8, name: '书法练习', icon: '✍️', status: 'pending' },
          ],
          weekProgress: [
            { date: '周一', rate: 85 },
            { date: '周二', rate: 100 },
            { date: '周三', rate: 70 },
            { date: '周四', rate: 90 },
            { date: '周五', rate: 60 },
            { date: '周六', rate: 80 },
            { date: '周日', rate: 62.5 },
          ],
        } as DailyReport;
      }
    },
  });

  const pushToDingTalkMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/reports/push-dingtalk', { date: selectedDate });
    },
    onSuccess: () => {
      toast.success('报告已发送到钉钉~');
    },
    onError: () => {
      toast.error('发送失败，请重试');
    },
  });

  const isParent = user?.role === 'parent';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-4xl"
        >
          📊
        </motion.div>
      </div>
    );
  }

  const weekDays = report?.weekProgress || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="text-center">
          <h1 className="text-2xl font-bold">学习报告</h1>
          <p className="text-muted-foreground mt-1">查看每日学习情况</p>
        </div>
      </FadeIn>

      {/* Completion Rate Circle */}
      <FadeIn delay={0.1}>
        <Card className="rounded-2xl border-2 border-primary/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-around">
              <ProgressCircle value={report?.completionRate || 0} size={100} />
              <div className="text-right space-y-2">
                <div>
                  <p className="text-2xl font-bold">{report?.completedCount || 0}</p>
                  <p className="text-xs text-muted-foreground">已完成任务</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{report?.studyTime || 0}</p>
                  <p className="text-xs text-muted-foreground">学习分钟</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Week Progress */}
      <FadeIn delay={0.15}>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">本周进度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end gap-2 h-24">
              {weekDays.map((day, index) => (
                <motion.div
                  key={day.date}
                  className="flex-1 flex flex-col items-center"
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div
                    className="w-full rounded-t-lg bg-primary/20 relative overflow-hidden"
                    style={{ height: `${day.rate}%`, minHeight: '8px' }}
                  >
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 bg-primary"
                      initial={{ height: 0 }}
                      animate={{ height: '100%' }}
                      transition={{ delay: index * 0.1 + 0.2, duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{day.date}</p>
                  <p className="text-xs font-medium">{Math.round(day.rate)}%</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Task List */}
      <FadeIn delay={0.2}>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">任务完成情况</CardTitle>
          </CardHeader>
          <CardContent>
            <Stagger stagger={0.05} className="space-y-3">
              {report?.tasks.map((task) => {
                const status = statusLabels[task.status];
                return (
                  <motion.div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <span className="text-xl">{task.icon}</span>
                    <span className="flex-1 font-medium">{task.name}</span>
                    <Badge variant={status.color as 'success' | 'secondary' | 'warning' | 'info'}>
                      {status.emoji} {status.label}
                    </Badge>
                  </motion.div>
                );
              })}
            </Stagger>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Push to DingTalk Button (Parent Only) */}
      {isParent && (
        <FadeIn delay={0.25}>
          <Button
            className="w-full h-12 rounded-xl text-base font-semibold"
            onClick={() => pushToDingTalkMutation.mutate()}
            disabled={pushToDingTalkMutation.isPending}
          >
            {pushToDingTalkMutation.isPending ? '发送中...' : '📤 推送到钉钉'}
          </Button>
        </FadeIn>
      )}
    </div>
  );
}
