import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import {
  Plus,
  Edit2,
  Trash2,
  Trophy,
  Users,
  ToggleLeft,
  ToggleRight,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EmptyPanel, PageToolbar, PageToolbarTitle } from '@/components/parent/PageToolbar';

// Types
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
  isActive: boolean;
  unlockedChildren?: { id: string; name: string; avatar?: string; unlockedAt: string }[];
}

// Schema
const achievementSchema = z.object({
  name: z.string().min(1, '请输入成就名称').max(30, '名称不能超过30个字符'),
  description: z.string().min(1, '请输入成就描述').max(100, '描述不能超过100个字符'),
  icon: z.string().min(1, '请选择图标'),
  condition: z.string().min(1, '请输入解锁条件').max(100, '条件不能超过100个字符')
});

type AchievementFormData = z.infer<typeof achievementSchema>;

// Icon options
const iconOptions = ['🏆', '🥇', '🥈', '🥉', '⭐', '🌟', '💫', '🎯', '🔥', '💪', '📚', '📖', '✏️', '🎨', '🎵', '🎸', '⚽', '🏃', '🚀', '💎'];

// API functions
async function fetchAchievements(): Promise<Achievement[]> {
  const { data } = await apiClient.get('/achievements');
  return data;
}

async function createAchievement(achievement: AchievementFormData): Promise<Achievement> {
  const { data } = await apiClient.post('/achievements', achievement);
  return data;
}

async function updateAchievement(id: string, achievement: AchievementFormData): Promise<Achievement> {
  const { data } = await apiClient.put(`/achievements/${id}`, achievement);
  return data;
}

async function deleteAchievement(id: string): Promise<void> {
  await apiClient.delete(`/achievements/${id}`);
}

async function toggleAchievement(id: string, isActive: boolean): Promise<Achievement> {
  const { data } = await apiClient.patch(`/achievements/${id}/toggle`, { isActive });
  return data;
}


export default function AchievementsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [achievementToDelete, setAchievementToDelete] = useState<Achievement | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string>('🏆');
  const [showingUnlocked, setShowingUnlocked] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<AchievementFormData>({
    resolver: zodResolver(achievementSchema as never),
    defaultValues: { name: '', description: '', icon: '🏆', condition: '' }
  });

  const { data: achievements, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: fetchAchievements,
    staleTime: 5 * 60 * 1000
  });

  const createMutation = useMutation({
    mutationFn: createAchievement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      toast.success('成就创建成功');
      closeDialog();
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AchievementFormData }) => updateAchievement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      toast.success('成就更新成功');
      closeDialog();
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAchievement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      toast.success('成就删除成功');
      setDeleteDialogOpen(false);
      setAchievementToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleAchievement(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      toast.success('状态更新成功');
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const openCreateDialog = () => {
    setEditingAchievement(null);
    setSelectedIcon('🏆');
    reset({ name: '', description: '', icon: '🏆', condition: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (achievement: Achievement) => {
    setEditingAchievement(achievement);
    setSelectedIcon(achievement.icon);
    reset({ name: achievement.name, description: achievement.description, icon: achievement.icon, condition: achievement.condition });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAchievement(null);
    reset();
  };

  const selectIcon = (icon: string) => {
    setSelectedIcon(icon);
    setValue('icon', icon);
  };

  const onSubmit = (data: AchievementFormData) => {
    if (editingAchievement) {
      updateMutation.mutate({ id: editingAchievement.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => achievementToDelete && deleteMutation.mutate(achievementToDelete.id);
  const handleToggle = (achievement: Achievement) => toggleMutation.mutate({ id: achievement.id, isActive: !achievement.isActive });

  const totalAchievements = achievements?.length || 0;
  const activeAchievements = achievements?.filter(a => a.isActive).length || 0;
  const totalUnlocks = achievements?.reduce((sum, a) => sum + (a.unlockedChildren?.length || 0), 0) || 0;

  return (
    <div className="mx-auto max-w-[1360px] space-y-5">
      <PageToolbar
        left={
          <PageToolbarTitle
            icon={Trophy}
            title="成就管理"
            description="管理长期激励规则，查看孩子的成就解锁情况"
          />
        }
        right={
          <Button
            onClick={openCreateDialog}
            className="h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm hover:from-indigo-600 hover:to-violet-600"
          >
            <Plus className="size-4 mr-1.5" />
            <span className="text-sm">添加成就</span>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '总成就', value: totalAchievements, gradient: 'from-primary to-primary/70' },
          { label: '已启用', value: activeAchievements, gradient: 'from-emerald-500 to-teal-500' },
          { label: '已解锁', value: totalUnlocks, gradient: 'from-amber-500 to-yellow-500' }
        ].map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
            <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5 text-center relative overflow-hidden">
                <div className={cn("absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 rounded-full -translate-y-8 translate-x-8", stat.gradient)} />
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Achievement List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <Skeleton className="size-16 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : achievements && achievements.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {achievements?.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={cn('group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md', !achievement.isActive && 'opacity-60')}>
                <div className={cn('h-1.5', achievement.isActive ? 'bg-primary' : 'bg-gray-200')} />
                <CardContent className="p-5">
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={cn('size-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-md', achievement.isActive ? 'bg-primary/80' : 'bg-gray-100')}>
                      {achievement.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{achievement.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{achievement.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => handleToggle(achievement)} className="w-8 h-8">
                            {achievement.isActive ? <ToggleRight className="size-5 text-emerald-500" /> : <ToggleLeft className="size-5 text-gray-400" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(achievement)} className="w-8 h-8 text-gray-400 hover:text-blue-500 hover:bg-blue-50">
                            <Edit2 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setAchievementToDelete(achievement); setDeleteDialogOpen(true); }} className="w-8 h-8 text-gray-400 hover:text-red-500 hover:bg-red-50">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <Badge variant="outline" className="mt-2 rounded-full text-xs bg-gray-50 border-gray-200 text-gray-600">
                        {achievement.condition}
                      </Badge>

                      {/* Unlocked Children */}
                      {achievement.unlockedChildren && achievement.unlockedChildren.length > 0 && (
                        <div className="mt-3">
                          <button onClick={() => setShowingUnlocked(showingUnlocked === achievement.id ? null : achievement.id)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                            <Users className="size-3" />
                            <span>{achievement.unlockedChildren.length}人已解锁</span>
                          </button>

                          <AnimatePresence>
                            {showingUnlocked === achievement.id && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2 mt-2">
                                {achievement.unlockedChildren.map((child) => (
                                  <div key={child.id} className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-full">
                                    <Avatar className="size-4">
                                      <AvatarFallback className="text-[8px] bg-primary text-white">{child.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-gray-700">{child.name}</span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyPanel
          icon={Trophy}
          title="还没有创建成就"
          description="创建成就来激励孩子学习，后续会从任务、阅读和目标中自动解锁。"
          action={<Button onClick={openCreateDialog}><Plus className="size-4" />添加成就</Button>}
        />
      )}

      {/* Add/Edit Dialog */}
      <AnimatePresence>
        {dialogOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={closeDialog} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl lg:inset-auto lg:left-1/2 lg:top-1/2 lg:max-h-[85vh] lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">{editingAchievement ? '编辑成就' : '添加成就'}</h2>
                <Button variant="ghost" size="icon" onClick={closeDialog} className="rounded-full"><X className="size-5" /></Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto p-6">
                <form id="achievement-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">选择图标</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {iconOptions.map((icon) => (
                        <button key={icon} type="button" onClick={() => selectIcon(icon)} className={cn('size-10 rounded-xl text-xl flex items-center justify-center transition-all border-2', selectedIcon === icon ? 'border-purple-500 bg-purple-50 scale-110' : 'border-transparent hover:bg-gray-100')}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">成就名称 *</Label>
                    <Input {...register('name')} placeholder="例如：学习达人" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">描述 *</Label>
                    <Input {...register('description')} placeholder="例如：连续学习7天" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                    {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">解锁条件 *</Label>
                    <Textarea {...register('condition')} placeholder="详细描述解锁条件" rows={3} className="mt-2 rounded-xl bg-gray-50 border-0 resize-none" />
                    {errors.condition && <p className="text-red-500 text-xs mt-1">{errors.condition.message}</p>}
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 space-y-3">
                <Button type="submit" form="achievement-form" disabled={createMutation.isPending || updateMutation.isPending} className="h-11 w-full rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-base font-semibold text-white shadow-sm hover:from-indigo-600 hover:to-violet-600">
                  {editingAchievement ? '保存修改' : '创建成就'}
                </Button>
                <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={closeDialog}>取消</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border border-slate-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">确定要删除成就「{achievementToDelete?.name}」吗？此操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl h-11">取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-red-500 hover:bg-red-600 rounded-xl h-11">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
