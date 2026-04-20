import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Users, Target, Eye, ArrowRight } from 'lucide-react';

interface Child {
  id: string;
  name: string;
  avatar?: string;
  taskCompletion: number;
  completedTasks: number;
  totalTasks: number;
  streak?: number;
  achievements?: number;
  todayMinutes?: number;
  weeklyProgress?: number;
}

interface ChildComparisonProps {
  children: Child[];
  onDetailClick?: (childId: string) => void;
  onEmptyAction?: () => void;
}

export function ChildComparison({ children, onDetailClick, onEmptyAction }: ChildComparisonProps) {
  // 渲染头像
  const renderAvatar = (child: Child) => {
    const avatar = child.avatar || '👶';
    if (avatar.startsWith('data:') || avatar.startsWith('http')) {
      return (
        <div className="flex-shrink-0">
          <img 
            src={avatar} 
            alt={child.name} 
            className="size-20 rounded-2xl object-cover shadow-sm"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.parentElement) {
                target.parentElement.innerHTML = '<div class="size-20 rounded-2xl bg-primary/80 flex items-center justify-center text-4xl shadow-sm">👶</div>';
              }
            }}
          />
        </div>
      );
    } else if (avatar.startsWith('/')) {
      return (
        <div className="flex-shrink-0">
          <img 
            src={avatar} 
            alt={child.name} 
            className="size-20 rounded-2xl object-cover shadow-sm"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.parentElement) {
                target.parentElement.innerHTML = '<div class="size-20 rounded-2xl bg-primary/80 flex items-center justify-center text-4xl shadow-sm">👶</div>';
              }
            }}
          />
        </div>
      );
    }
    // emoji 或短字符直接展示；长字符串（如数字ID）回退到名字首字母
    const display = avatar.length <= 2 && !/^[a-zA-Z0-9]+$/.test(avatar) ? avatar : child.name.charAt(0);
    return (
      <div className="size-20 rounded-2xl bg-primary/80 flex items-center justify-center text-4xl shadow-sm">
        {display}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">孩子学习情况</h2>
      {children.length === 0 ? (
        <Card className="border-0 shadow-lg rounded-3xl">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Users className="size-10 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">还没有添加孩子</h3>
            <p className="text-gray-500 mt-1">点击上方按钮添加第一个孩子</p>
            {onEmptyAction && (
              <Button onClick={onEmptyAction} className="mt-4 rounded-xl bg-primary text-primary-foreground">添加孩子</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child, index) => (
            <motion.div key={child.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="overflow-hidden border-0 shadow-lg shadow-gray-200/50 rounded-3xl hover:shadow-xl transition-all duration-300">
                <div className="h-2 bg-primary" />
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    {renderAvatar(child)}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900">{child.name}</h3>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100">
                          <span className="text-orange-500">🔥</span>
                          <p className="text-lg font-bold text-gray-900">{child.streak || 0}</p>
                          <p className="text-xs text-gray-500">连续学习</p>
                        </div>
                        <div className="text-center p-3 rounded-2xl bg-primary/5 border border-primary/10">
                          <span className="text-purple-500">🏆</span>
                          <p className="text-lg font-bold text-gray-900">{child.achievements || 0}</p>
                          <p className="text-xs text-gray-500">成就</p>
                        </div>
                        <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
                          <span className="text-blue-500">⏰</span>
                          <p className="text-lg font-bold text-gray-900">{child.todayMinutes || 0}</p>
                          <p className="text-xs text-gray-500">今日分钟</p>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-500 flex items-center gap-1"><Target className="size-4" />本周进度</span>
                          <span className="font-bold text-gray-900">{child.weeklyProgress || child.taskCompletion}%</span>
                        </div>
                        <Progress value={child.weeklyProgress || child.taskCompletion} className="h-2 bg-gray-100" />
                        <p className="text-xs text-gray-400 mt-1">已完成 {child.completedTasks}/{child.totalTasks} 任务</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" className="flex-1 gap-1 rounded-xl h-10" onClick={() => onDetailClick?.(child.id)}>
                          <Eye className="size-4" />查看详情
                        </Button>
                        <Button size="sm" className="flex-1 gap-1 rounded-xl h-10 bg-primary text-primary-foreground" onClick={() => onDetailClick?.(child.id)}>
                          切换视图<ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
