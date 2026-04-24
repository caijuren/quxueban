import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Plus, Edit, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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

// API functions
async function getChildren(): Promise<any> {
  const response = await apiClient.get('/auth/children');
  return response.data;
}

async function uploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', file);
  
  const response = await apiClient.post('/upload/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data.data.url;
}

async function createChild(data: { name: string; avatar: string }): Promise<any> {
  const response = await apiClient.post('/add-child', {
    name: data.name,
    avatar: data.avatar,
  });
  return response.data;
}

async function updateChild(childId: number, data: { name: string; avatar: string }): Promise<void> {
  await apiClient.put(`/children/${childId}`, data);
}

async function deleteChild(childId: number): Promise<void> {
  await apiClient.delete(`/children/${childId}`);
}

async function getChildStats(childId: number): Promise<any> {
  const response = await apiClient.get(`/children/${childId}/stats`);
  return response.data;
}

export default function ChildManagement() {
  // Child management state
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [editChildOpen, setEditChildOpen] = useState(false);
  const [deleteChildOpen, setDeleteChildOpen] = useState(false);
  const [currentChildId, setCurrentChildId] = useState<number | null>(null);
  const [childName, setChildName] = useState('');
  const [childAvatar, setChildAvatar] = useState('🐶');
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [isUpdatingChild, setIsUpdatingChild] = useState(false);
  const [isDeletingChild, setIsDeletingChild] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [childStats, setChildStats] = useState<Record<number, any>>({});

  // Rename children query for refetching
  const childrenQuery = useQuery({
    queryKey: ['children'],
    queryFn: getChildren,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Load children list - using the renamed childrenQuery
  const { data: childrenData, isLoading: isLoadingChildren } = childrenQuery;

  // Child management mutations
  const createChildMutation = useMutation({
    mutationFn: createChild,
    onSuccess: () => {
      toast.success('孩子添加成功');
      setAddChildOpen(false);
      setChildName('');
      setChildAvatar('🐶');
      setIsCreatingChild(false);
      // Refetch children list
      childrenQuery.refetch();
    },
    onError: (error) => {
      toast.error(`添加孩子失败：${getErrorMessage(error)}`);
      setIsCreatingChild(false);
    }
  });

  const updateChildMutation = useMutation({
    mutationFn: ({ childId, data }: { childId: number; data: { name: string; avatar: string } }) =>
      updateChild(childId, data),
    onSuccess: () => {
      toast.success('孩子信息已更新');
      setEditChildOpen(false);
      setChildName('');
      setChildAvatar('🐶');
      setCurrentChildId(null);
      setIsUpdatingChild(false);
      // Refetch children list
      childrenQuery.refetch();
    },
    onError: (error) => {
      toast.error(`更新孩子信息失败：${getErrorMessage(error)}`);
      setIsUpdatingChild(false);
    }
  });

  const deleteChildMutation = useMutation({
    mutationFn: deleteChild,
    onSuccess: () => {
      toast.success('孩子已删除');
      setDeleteChildOpen(false);
      setCurrentChildId(null);
      setIsDeletingChild(false);
      // Refetch children list
      childrenQuery.refetch();
    },
    onError: (error) => {
      toast.error(`删除孩子失败：${getErrorMessage(error)}`);
      setIsDeletingChild(false);
    }
  });

  // Load child stats
  useEffect(() => {
    if (childrenData?.data) {
      const loadStats = async () => {
        for (const child of childrenData.data) {
          try {
            const statsData = await getChildStats(child.id);
            setChildStats(prev => ({ ...prev, [child.id]: statsData.data }));
          } catch (error) {
            console.error(`Failed to load stats for child ${child.id}:`, error);
          }
        }
      };
      loadStats();
    }
  }, [childrenData]);

  // Child management handlers
  const handleOpenAddChild = () => {
    setChildName('');
    setChildAvatar('🐶');
    setAddChildOpen(true);
  };

  const handleOpenEditChild = (child: any) => {
    setCurrentChildId(child.id);
    setChildName(child.name);
    setChildAvatar(child.avatar || '🐶');
    setEditChildOpen(true);
  };

  const handleOpenDeleteChild = (childId: number) => {
    setCurrentChildId(childId);
    setDeleteChildOpen(true);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast.error('图片大小不能超过2MB');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const avatarUrl = await uploadAvatar(file);
      setChildAvatar(avatarUrl);
      toast.success('头像上传成功');
    } catch (error) {
      toast.error(`上传失败：${getErrorMessage(error)}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCreateChild = () => {
    if (!childName.trim()) {
      toast.error('请输入孩子姓名');
      return;
    }
    
    setIsCreatingChild(true);
    createChildMutation.mutate({ 
      name: childName.trim(), 
      avatar: childAvatar,
    });
  };

  const handleUpdateChild = () => {
    if (!childName.trim()) {
      toast.error('请输入孩子姓名');
      return;
    }
    if (!currentChildId) return;
    
    setIsUpdatingChild(true);
    updateChildMutation.mutate({ 
      childId: currentChildId, 
      data: { 
        name: childName.trim(), 
        avatar: childAvatar 
      } 
    });
  };

  const handleDeleteChild = () => {
    if (!currentChildId) return;
    
    setIsDeletingChild(true);
    deleteChildMutation.mutate(currentChildId);
  };

  return (
    <div className="space-y-4">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="border border-border shadow-sm rounded-lg">
          <CardContent className="px-4 pb-4 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">孩子列表</h3>
              <Button
                onClick={handleOpenAddChild}
                className="h-8 px-3 rounded-lg flex items-center gap-1.5 bg-primary text-primary-foreground"
              >
                <Plus className="w-3.5 h-3.5" />
                添加孩子
              </Button>
            </div>
            {isLoadingChildren ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
                加载孩子信息中...
              </div>
            ) : childrenData?.data && childrenData.data.length > 0 ? (
              <div className="space-y-4">
                {childrenData.data.map((child: any) => {
                  const stats = childStats[child.id] || {
                    weeklyStudyTime: 0,
                    completedTasks: 0,
                    achievements: 0,
                    dailyMinutes: 0,
                    weeklyProgress: 0
                  };
                  return (
                    <div key={child.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-lg">
                            {child.avatar || '👶'}
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{child.name}</h3>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditChild(child)}
                            className="h-8 px-3 rounded-lg"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1.5" />
                            编辑
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleOpenDeleteChild(child.id)}
                            className="h-8 px-3 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            删除
                          </Button>
                        </div>
                      </div>
                      
                      {/* Learning Overview */}
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-primary/10 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground">本周学习</p>
                          <p className="text-lg font-semibold text-primary">{stats.weeklyStudyTime || 0}分钟</p>
                        </div>
                        <div className="bg-success/10 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground">完成任务</p>
                          <p className="text-lg font-semibold text-success">{stats.completedTasks || 0}</p>
                        </div>
                        <div className="bg-accent/10 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground">成就</p>
                          <p className="text-lg font-semibold text-accent">{stats.achievements || 0}</p>
                        </div>
                      </div>
                      
                      {/* Weekly Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-muted-foreground">本周进度</p>
                          <p className="text-sm font-semibold text-primary">{stats.weeklyProgress || 0}%</p>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${stats.weeklyProgress || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">暂无孩子信息</p>
                <p className="text-sm text-muted-foreground/70 mt-1">请先添加孩子账户</p>
                <Button 
                  onClick={handleOpenAddChild}
                  className="mt-4 h-8 px-4 rounded-lg bg-primary text-primary-foreground"
                >
                  添加孩子
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>

      {/* Add Child Dialog */}
      <AlertDialog open={addChildOpen} onOpenChange={setAddChildOpen}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>添加孩子</AlertDialogTitle>
            <AlertDialogDescription>
              为您的孩子创建一个学习档案，设置姓名和头像
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="child-name" className="text-xs text-muted-foreground">姓名</Label>
              <Input
                id="child-name"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="请输入孩子姓名"
                className="h-10 rounded-lg text-sm bg-muted/50 border-0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="child-avatar" className="text-xs text-muted-foreground">头像</Label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-xl">
                  {childAvatar.startsWith('http') ? (
                    <img 
                      src={childAvatar} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    childAvatar
                  )}
                </div>
                <div className="flex-1">
                  <label 
                    htmlFor="avatar-upload"
                    className="block w-full h-10 rounded-lg flex items-center justify-center gap-2 border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>上传头像</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="avatar-upload"
                    />
                  </label>
                </div>
              </div>
              <div className="mt-2">
                <Input
                  id="child-avatar-emoji"
                  value={childAvatar}
                  onChange={(e) => setChildAvatar(e.target.value)}
                  placeholder="或输入一个emoji作为头像，例如：🐶"
                  className="h-10 rounded-lg text-sm bg-muted/50 border-0"
                />
              </div>
            </div>
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateChild}
              disabled={isCreatingChild}
              className="rounded-lg bg-primary text-primary-foreground"
            >
              {isCreatingChild ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></div>
                  创建中...
                </>
              ) : (
                '添加'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Child Dialog */}
      <AlertDialog open={editChildOpen} onOpenChange={setEditChildOpen}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>编辑孩子信息</AlertDialogTitle>
            <AlertDialogDescription>
              修改孩子的姓名和头像
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-child-name" className="text-xs text-muted-foreground">姓名</Label>
              <Input
                id="edit-child-name"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="请输入孩子姓名"
                className="h-10 rounded-lg text-sm bg-muted/50 border-0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-child-avatar" className="text-xs text-muted-foreground">头像</Label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-xl">
                  {childAvatar.startsWith('http') ? (
                    <img 
                      src={childAvatar} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    childAvatar
                  )}
                </div>
                <div className="flex-1">
                  <label 
                    htmlFor="edit-avatar-upload"
                    className="block w-full h-10 rounded-lg flex items-center justify-center gap-2 border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>上传头像</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="edit-avatar-upload"
                    />
                  </label>
                </div>
              </div>
              <div className="mt-2">
                <Input
                  id="edit-child-avatar-emoji"
                  value={childAvatar}
                  onChange={(e) => setChildAvatar(e.target.value)}
                  placeholder="或输入一个emoji作为头像，例如：🐶"
                  className="h-10 rounded-lg text-sm bg-muted/50 border-0"
                />
              </div>
            </div>
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpdateChild}
              disabled={isUpdatingChild}
              className="rounded-lg bg-primary text-primary-foreground"
            >
              {isUpdatingChild ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></div>
                  更新中...
                </>
              ) : (
                '保存'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Child Dialog */}
      <AlertDialog open={deleteChildOpen} onOpenChange={setDeleteChildOpen}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个孩子账户吗？此操作将删除该孩子的所有学习记录、任务和成就，且无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChild}
              disabled={isDeletingChild}
              className="rounded-lg bg-destructive hover:bg-destructive/90 text-white"
            >
              {isDeletingChild ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></div>
                  删除中...
                </>
              ) : (
                '确认删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
