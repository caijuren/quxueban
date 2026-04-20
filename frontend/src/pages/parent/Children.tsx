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
  pin: z.string().length(4, 'PIN码必须是4位数字').regex(/^\d+$/, 'PIN码必须是数字'),
  age: z.string().optional(),
  grade: z.string().optional(),
  gender: z.string().optional(),
  birthday: z.string().optional(),
  interests: z.array(z.string()).optional(),
  personality: z.string().optional()
});

type ChildFormData = z.infer<typeof childSchema>;

// Preset avatar options (emoji)
const presetAvatars = ['🦊', '🐼', '🐨', '🦁', '🐯', '🐰', '🐻', '🐸', '🦄', '🐱'];

// API functions
async function fetchChildren(): Promise<Child[]> {
  try {
    const { data } = await apiClient.get('/auth/children');
    // 确保返回的数据是数组
    if (Array.isArray(data.data)) {
      return data.data;
    }
    console.error('Invalid data structure from API:', data);
    return [];
  } catch (error) {
    console.error('Error fetching children:', error);
    return [];
  }
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
  const [currentChildId, setCurrentChildId] = useState<number | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ChildFormData>({
    resolver: zodResolver(childSchema),
    defaultValues: { name: '', avatar: '🦊', pin: '' }
  });

  const { data: fetchedChildren, isLoading, error: queryError } = useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    retry: 2,
    retryDelay: 1000,
  });

  // 确保children始终是一个数组
  const children = Array.isArray(fetchedChildren) ? fetchedChildren : [];

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
    setCurrentChildId(null);
    setSelectedAvatar('🦊');
    setCustomAvatar(null);
    setAvatarMode('preset');
    reset({ name: '', avatar: '🦊', pin: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (child: Child) => {
    setEditingChild(child);
    setCurrentChildId(child.id);
    const avatar = child.avatar || '🦊';
    const isCustom = avatar.startsWith('data:') || avatar.startsWith('http');
    setAvatarMode(isCustom ? 'custom' : 'preset');
    if (isCustom) {
      setCustomAvatar(avatar);
      setSelectedAvatar('🦊');
    } else {
      setSelectedAvatar(avatar);
      setCustomAvatar(null);
    }
    reset({ name: child.name, avatar: avatar, pin: child.pin });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingChild(null);
    setCustomAvatar(null);
    setCurrentChildId(null);
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
    if (editingChild) {
      // 编辑模式：检查 ID 匹配
      const currentChild = editingChild;
      if (!currentChild || currentChild.id !== currentChildId) {
        console.error('Child ID mismatch, aborting update');
        return;
      }
      
      const avatar = avatarMode === 'custom' ? customAvatar : selectedAvatar;
      const submitData = { ...data, avatar: avatar || '🦊' };
      
      updateMutation.mutate({ id: currentChild.id, data: submitData });
    } else {
      // 创建模式：直接提交
      const avatar = avatarMode === 'custom' ? customAvatar : selectedAvatar;
      const submitData = { ...data, avatar: avatar || '🦊' };
      
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = () => childToDelete && deleteMutation.mutate(childToDelete.id);
  const switchToChildView = (childId: number) => navigate(`/parent/children/${childId}`);

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
    <div className="space-y-6">
      {/* Page Control Bar */}
      <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Action Buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              onClick={openCreateDialog}
              className="h-10 rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm"
            >
              <Plus className="size-4 mr-1.5" />
              <span className="text-sm">添加孩子</span>
            </Button>
          </div>
        </div>
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
          {Array.isArray(children) && children.map((child, index) => (
            <motion.div key={child.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="overflow-hidden border-0 shadow-lg shadow-gray-200/50 rounded-3xl hover:shadow-xl transition-all duration-300">
                <div className="h-2 bg-primary" />
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
                        <div className="text-center p-3 rounded-2xl bg-primary/5 border border-primary/10">
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
                        <Button size="sm" className="flex-1 gap-1 rounded-xl h-10 bg-primary text-primary-foreground" onClick={() => switchToChildView(child.id)}>
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
      {!isLoading && (!Array.isArray(children) || children.length === 0) && (
        <Card className="border-0 shadow-lg rounded-3xl">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <User className="size-10 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">还没有添加孩子</h3>
            <p className="text-gray-500 mt-1">点击上方按钮添加第一个孩子</p>
            <Button onClick={openCreateDialog} className="mt-4 rounded-xl bg-primary text-primary-foreground">添加孩子</Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <AnimatePresence>
        {dialogOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={closeDialog} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-4 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[520px] lg:max-h-[85vh] bg-white rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">{editingChild ? '编辑孩子档案' : '添加孩子'}</h2>
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
                            ? "bg-primary/10 text-primary"
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
                            ? "bg-primary/10 text-primary"
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

                  {/* 年龄/年级 */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">年龄/年级 *</Label>
                    <select {...register('age')} className="mt-2 w-full rounded-xl h-12 bg-gray-50 border-0 px-4 text-gray-700">
                      <option value="">请选择</option>
                      <option value="3">3岁</option>
                      <option value="4">4岁</option>
                      <option value="5">5岁</option>
                      <option value="6">6岁</option>
                      <option value="7">7岁</option>
                      <option value="8">8岁</option>
                      <option value="9">9岁</option>
                      <option value="10">10岁</option>
                      <option value="11">11岁</option>
                      <option value="12">12岁</option>
                      <option value="grade1">小学一年级</option>
                      <option value="grade2">小学二年级</option>
                      <option value="grade3">小学三年级</option>
                      <option value="grade4">小学四年级</option>
                      <option value="grade5">小学五年级</option>
                      <option value="grade6">小学六年级</option>
                    </select>
                  </div>

                  {/* 性别 */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">性别</Label>
                    <div className="mt-2 flex gap-6">
                      <label className="flex items-center gap-2">
                        <input type="radio" {...register('gender')} value="male" className="text-purple-500" />
                        <span className="text-gray-700">男孩</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" {...register('gender')} value="female" className="text-purple-500" />
                        <span className="text-gray-700">女孩</span>
                      </label>
                    </div>
                  </div>

                  {/* 生日 */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">生日</Label>
                    <Input type="date" {...register('birthday')} className="mt-2 rounded-xl h-12 bg-gray-50 border-0 px-4" />
                  </div>

                  {/* 兴趣爱好 */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">兴趣爱好</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['科幻', '恐龙', '绘画', '足球', '音乐', '舞蹈', '阅读', '数学', '科学', '手工'].map((interest) => {
                        const field = register('interests') as any;
                        return (
                          <label key={interest} className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full text-sm">
                            <input 
                              type="checkbox" 
                              checked={field.value?.includes(interest) || false}
                              onChange={(e) => {
                                const currentValue = field.value || [];
                                if (e.target.checked) {
                                  field.onChange([...currentValue, interest]);
                                } else {
                                  field.onChange(currentValue.filter((item: string) => item !== interest));
                                }
                              }}
                              className="text-purple-500" 
                            />
                            <span className="text-gray-700">{interest}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 个性描述 */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">个性描述</Label>
                    <textarea {...register('personality')} placeholder="例如：活泼开朗，喜欢问为什么..." className="mt-2 w-full rounded-xl h-24 bg-gray-50 border-0 px-4 py-3 resize-none" />
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 space-y-3">
                <Button
                  type="submit"
                  form="child-form"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full h-12 rounded-xl text-base font-semibold bg-primary text-primary-foreground shadow-sm"
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
