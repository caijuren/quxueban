import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FadeIn, Stagger, HoverLift } from '@/components/MotionPrimitives';
import { apiClient } from '@/lib/api-client';

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
}

interface AchievementStats {
  streakDays: number;
  totalStudyTime: number;
  completionRate: number;
  totalAchievements: number;
  unlockedAchievements: number;
}

const defaultAchievements: Achievement[] = [
  { id: 1, name: '初学者', description: '完成第一个任务', icon: '🌱', unlocked: false, progress: 0, maxProgress: 1 },
  { id: 2, name: '勤奋小蜜蜂', description: '连续学习7天', icon: '🐝', unlocked: false, progress: 0, maxProgress: 7 },
  { id: 3, name: '阅读达人', description: '读完5本书', icon: '📚', unlocked: false, progress: 0, maxProgress: 5 },
  { id: 4, name: '作业高手', description: '完成50个作业任务', icon: '📝', unlocked: false, progress: 0, maxProgress: 50 },
  { id: 5, name: '早起鸟儿', description: '早上6点前完成打卡10次', icon: '🐦', unlocked: false, progress: 0, maxProgress: 10 },
  { id: 6, name: '坚持不懈', description: '连续学习30天', icon: '💪', unlocked: false, progress: 0, maxProgress: 30 },
  { id: 7, name: '数学小天才', description: '完成100道数学题', icon: '🧮', unlocked: false, progress: 0, maxProgress: 100 },
  { id: 8, name: '英语之星', description: '学习英语累计100小时', icon: '🔤', unlocked: false, progress: 0, maxProgress: 100 },
  { id: 9, name: '全能选手', description: '完成所有类型的任务', icon: '🏆', unlocked: false, progress: 0, maxProgress: 6 },
  { id: 10, name: '学霸称号', description: '完成率达到90%', icon: '🎓', unlocked: false, progress: 0, maxProgress: 1 },
  { id: 11, name: '运动健将', description: '完成30次体育锻炼', icon: '⚽', unlocked: false, progress: 0, maxProgress: 30 },
  { id: 12, name: '科学探索家', description: '完成20个科学实验', icon: '🔬', unlocked: false, progress: 0, maxProgress: 20 },
];

export default function Achievements() {
  const { data: achievements = defaultAchievements, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<Achievement[]>('/achievements');
        return response.data;
      } catch {
        return defaultAchievements;
      }
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['achievements', 'stats'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<AchievementStats>('/achievements/stats');
        return response.data;
      } catch {
        return {
          streakDays: 0,
          totalStudyTime: 0,
          completionRate: 0,
          totalAchievements: 12,
          unlockedAchievements: 0,
        };
      }
    },
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-4xl"
        >
          🏆
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="text-center">
          <h1 className="text-2xl font-bold">我的成就</h1>
          <p className="text-muted-foreground mt-1">
            已解锁 {unlockedCount} / {totalCount} 个成就
          </p>
        </div>
      </FadeIn>

      {/* Stats Cards */}
      <FadeIn delay={0.1}>
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-xl text-center p-3">
            <span className="text-2xl">🔥</span>
            <p className="text-xl font-bold mt-1">{stats?.streakDays || 0}</p>
            <p className="text-xs text-muted-foreground">连续天数</p>
          </Card>
          <Card className="rounded-xl text-center p-3">
            <span className="text-2xl">⏱️</span>
            <p className="text-xl font-bold mt-1">{stats?.totalStudyTime || 0}</p>
            <p className="text-xs text-muted-foreground">学习小时</p>
          </Card>
          <Card className="rounded-xl text-center p-3">
            <span className="text-2xl">📊</span>
            <p className="text-xl font-bold mt-1">{stats?.completionRate || 0}%</p>
            <p className="text-xs text-muted-foreground">完成率</p>
          </Card>
        </div>
      </FadeIn>

      {/* Overall Progress */}
      <FadeIn delay={0.15}>
        <Card className="rounded-2xl border-2 border-primary/20 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">成就进度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={(unlockedCount / totalCount) * 100} className="flex-1 h-3" />
              <span className="text-sm font-medium">
                {Math.round((unlockedCount / totalCount) * 100)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Achievements Grid */}
      <Stagger stagger={0.08} className="grid grid-cols-3 gap-4">
        {achievements.map((achievement) => (
          <HoverLift key={achievement.id}>
            <motion.div
              className={`
                rounded-xl p-4 text-center cursor-pointer transition-all
                ${achievement.unlocked
                  ? 'bg-gradient-to-br from-primary/20 to-secondary/20 border-2 border-primary/30'
                  : 'bg-muted/50 border-2 border-transparent'
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                className={`text-4xl block mb-2 ${!achievement.unlocked && 'grayscale opacity-50'}`}
                animate={achievement.unlocked ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {achievement.icon}
              </motion.span>
              <h3 className="text-sm font-semibold truncate">{achievement.name}</h3>
              {!achievement.unlocked && achievement.maxProgress > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {achievement.progress}/{achievement.maxProgress}
                </p>
              )}
              {achievement.unlocked && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mt-1"
                >
                  <span className="text-xs text-success font-medium">已解锁</span>
                </motion.div>
              )}
            </motion.div>
          </HoverLift>
        ))}
      </Stagger>
    </div>
  );
}
