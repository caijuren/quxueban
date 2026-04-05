import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  ArrowRight,
  User,
  X,
  Flame,
  Award,
  Clock,
  Target,
  Camera,
  Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

// Types
interface Child {
  id: number;
  name: string;
  avatar?: string;
  pin: string;
  weeklyProgress: number;
  todayMinutes: number;
  completedTasks: number;
  totalTasks: number;
  streak: number;
  achievements: number;
}

// Schema
const childSchema = z.object({
  name: z.string().min(1, '请输入孩子姓名').max(20, '姓名不能超过20个字符'),
  avatar: z.string().optional(),
  pin: z.string().length(4, 'PIN码必须是4位数字').regex(/^\d+$/, 'PIN码必须是数字')
});

type ChildFormData = z.infer<typeof childSchema>;

// Preset avatar options (emoji)
const presetAvatars = ['🦊', '🐼', '🐨', '🦁', '🐯', '🐰', '🐻', '🐸', '🦄', '🐱'];

// API functions
async function fetchChildren(): Promise<Child[]> {
  const { data } = await apiClient.get('/auth/children');
  return data.data || [];
}

async function addChild(child: ChildFormData): Promise<Child> {
  const { data } = await apiClient.post('/auth/add-child', child);
  return data.data;
}

async function updateChild(id: number, child: ChildFormData): Promise<Child> {
  const { data } = await apiClient.put(`/auth/children/${id}`, child);
  return data.data;
}

async function deleteChild(id: number): Promise<void> {
  await apiClient.delete(`/auth/children/${id}`);
}

export default function ChildrenPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [childToDelete, setChildToDelete] = useState<Child | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🦊');
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [avatarMode, setAvatarMode] = useState<'preset' | 'custom'>('preset');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ChildFormData>({
    resolver: zodResolver(childSchema),
    defaultValues: { name: '', avatar: '🦊', pin: '' }
  });

  const { data: children = [], isLoading, error: queryError } = useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    retry: 2,
    retryDelay: 1000,
  });

  // Show error toast if query fails
  useEffect(() => {
    if (queryError) {
      toast.error('获取孩子列表失败，请刷新重试');
      console.error('Query error:', queryError);
    }
  }, [queryError]);

  const createMutation = useMutation({
    mutationFn: addChild,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      toast.success('孩子添加成功');
      closeDialog();
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ChildFormData }) => updateChild(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      toast.success('信息更新成功');
      closeDialog();
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChild,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      toast.success('孩子删除成功');
      setDeleteDialogOpen(false);
      setChildToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const openCreateDialog = () => {
    setEditingChild(null);
    setSelectedAvatar('🦊');
    setCustomAvatar(null);
    setAvatarMode('preset');
    reset({ name: '', avatar: '🦊', pin: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (child: Child) => {
    setEditingChild(child);
    const avatar = child.avatar || '🦊';
    const isCustom = avatar.startsWith('data:') || avatar.startsWith('http');
    setAvatarMode(isCustom ? 'custom' : 'preset');
    if (isCustom) {
      setCustomAvatar(avatar);
    } else {
      setSelectedAvatar(avatar);
    }
    reset({ name: child.name, avatar: avatar, pin: child.pin });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingChild(null);
    setCustomAvatar(null);
    reset();
  };

  const selectPresetAvatar = (avatar: string) => {
    setSelectedAvatar(avatar);
    setCustomAvatar(null);
    setAvatarMode('preset');
    setValue('avatar', avatar);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCustomAvatar(base64);
      setAvatarMode('custom');
      setValue('avatar', base64);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (data: ChildFormData) => {
    const avatar = avatarMode === 'custom' ? customAvatar : selectedAvatar;
    const submitData = { ...data, avatar: avatar || '🦊' };
    
    if (editingChild) {
      updateMutation.mutate({ id: editingChild.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = () => childToDelete && deleteMutation.mutate(childToDelete.id);
  const switchToChildView = (_childId: number) => navigate('/child');

  const renderAvatar = (child: Child) => {
    const avatar = child.avatar || '👶';
    if (avatar.startsWith('data:') || avatar.startsWith('http')) {
      return (
        <img 
          src={avatar} 
          alt={child.name} 
          className="size-20 rounded-2xl object-cover shadow-lg shadow-purple-500/20"
        />
      );
    }
    return (
      <div className="size-20 rounded-2xl bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-4xl shadow-lg shadow-purple-500/20">
        {avatar}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">孩子管理</h1>
          <p className="text-gray-500 mt-1">管理孩子的账户和查看学习进度</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl shadow-lg shadow-purple-500/25">
          <Plus className="size-4" />
          <span>添加孩子</span>
        </Button>
      </div>

      {/* Children Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="border-0 shadow-lg rounded-3xl">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="size-20 rounded-2xl" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children?.map((child, index) => (
            <motion.div key={child.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="overflow-hidden border-0 shadow-lg shadow-gray-200/50 rounded-3xl hover:shadow-xl transition-all duration-300">
                <div className="h-2 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500" />
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    {renderAvatar(child)}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-900">{child.name}</h3>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(child)} className="w-9 h-9 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full">
                            <Edit2 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setChildToDelete(child); setDeleteDialogOpen(true); }} className="w-9 h-9 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100">
                          <Flame className="size-4 text-orange-500 mx-auto mb-1" />
                          <p className="text-lg font-bold text-gray-900">{child.streak}</p>
                          <p className="text-xs text-gray-500">连续学习</p>
                        </div>
                        <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100">
                          <Award className="size-4 text-purple-500 mx-auto mb-1" />
                          <p className="text-lg font-bold text-gray-900">{child.achievements}</p>
                          <p className="text-xs text-gray-500">成就</p>
                        </div>
                        <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
                          <Clock className="size-4 text-blue-500 mx-auto mb-1" />
                          <p className="text-lg font-bold text-gray-900">{child.todayMinutes}</p>
                          <p className="text-xs text-gray-500">今日分钟</p>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-500 flex items-center gap-1"><Target className="size-4" />本周进度</span>
                          <span className="font-bold text-gray-900">{child.weeklyProgress}%</span>
                        </div>
                        <Progress value={child.weeklyProgress} className="h-2 bg-gray-100" />
                        <p className="text-xs text-gray-400 mt-1">已完成 {child.completedTasks}/{child.totalTasks} 任务</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" className="flex-1 gap-1 rounded-xl h-10" onClick={() => switchToChildView(child.id)}>
                          <Eye className="size-4" />查看详情
                        </Button>
                        <Button size="sm" className="flex-1 gap-1 rounded-xl h-10 bg-gradient-to-r from-purple-500 to-blue-500 text-white" onClick={() => switchToChildView(child.id)}>
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

      {/* Empty State */}
      {!isLoading && (!children || children.length === 0) && (
        <Card className="border-0 shadow-lg rounded-3xl">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <User className="size-10 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">还没有添加孩子</h3>
            <p className="text-gray-500 mt-1">点击上方按钮添加第一个孩子</p>
            <Button onClick={openCreateDialog} className="mt-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white">添加孩子</Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <AnimatePresence>
        {dialogOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={closeDialog} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-4 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[520px] lg:max-h-[85vh] bg-white rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">{editingChild ? '编辑孩子信息' : '添加孩子'}</h2>
                <Button variant="ghost" size="icon" onClick={closeDialog} className="rounded-full"><X className="size-5" /></Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto p-6">
                <form id="child-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Avatar Selection */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-3 block">选择头像</Label>
                    
                    {/* Avatar Mode Toggle */}
                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setAvatarMode('preset')}
                        className={cn(
                          "flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all",
                          avatarMode === 'preset'
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        预设头像
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvatarMode('custom')}
                        className={cn(
                          "flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all",
                          avatarMode === 'custom'
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        自定义上传
                      </button>
                    </div>

                    {avatarMode === 'preset' ? (
                      <div className="flex flex-wrap gap-2">
                        {presetAvatars.map((avatar) => (
                          <button
                            key={avatar}
                            type="button"
                            onClick={() => selectPresetAvatar(avatar)}
                            className={cn(
                              'size-14 rounded-xl text-3xl flex items-center justify-center transition-all border-2',
                              selectedAvatar === avatar && avatarMode === 'preset'
                                ? 'border-purple-500 bg-purple-50 scale-110'
                                : 'border-transparent hover:bg-gray-100'
                            )}
                          >
                            {avatar}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Preview */}
                        {customAvatar && (
                          <div className="flex justify-center">
                            <img
                              src={customAvatar}
                              alt="预览"
                              className="size-24 rounded-2xl object-cover shadow-lg"
                            />
                          </div>
                        )}
                        
                        {/* Upload Button */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-12 rounded-xl border-dashed border-2 gap-2"
                        >
                          {customAvatar ? <Camera className="size-4" /> : <Upload className="size-4" />}
                          {customAvatar ? '更换头像' : '上传头像'}
                        </Button>
                        <p className="text-xs text-gray-400 text-center">支持 JPG、PNG 格式，最大 2MB</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">姓名 *</Label>
                    <Input {...register('name')} placeholder="输入孩子的姓名" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">PIN 码 *</Label>
                    <Input type="password" maxLength={4} {...register('pin')} placeholder="4位数字PIN码" className="mt-2 rounded-xl h-12 bg-gray-50 border-0 text-center tracking-[0.5em] text-lg" />
                    {errors.pin && <p className="text-red-500 text-xs mt-1">{errors.pin.message}</p>}
                    <p className="text-xs text-gray-400 mt-2">PIN码用于孩子登录时的身份验证，建议使用简单易记的4位数字</p>
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 space-y-3">
                <Button
                  type="submit"
                  form="child-form"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25"
                >
                  {editingChild ? '保存修改' : '添加孩子'}
                </Button>
                <Button type="button" variant="outline" className="w-full h-12 rounded-xl" onClick={closeDialog}>取消</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">确定要删除「{childToDelete?.name}」的账户吗？这将删除所有相关的学习数据，此操作无法撤销。</AlertDialogDescription>
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
