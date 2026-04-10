import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bell,
  Trash2,
  AlertTriangle,
  Send,
  Save,
  Users,
  MessageCircle,
  ExternalLink,
  Shield,
  Home,
  CheckCircle2,
  Circle,
  User,
  Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

// API functions
async function getFamilySettings(): Promise<any> {
  const response = await apiClient.get('/settings');
  return response.data;
}

async function updateFamilySettings(data: { familyName: string; dailyTimeLimit: number }): Promise<void> {
  await apiClient.put('/settings', data);
}

async function deleteFamilyData(): Promise<void> {
  await apiClient.delete('/settings/family-data');
}

async function getChildren(): Promise<any> {
  const response = await apiClient.get('/auth/children');
  return response.data;
}

async function getChildDingtalkConfig(childId: number): Promise<any> {
  const response = await apiClient.get(`/children/${childId}/dingtalk-config`);
  return response.data;
}

async function updateChildDingtalkConfig(childId: number, webhookUrl: string, secret?: string): Promise<void> {
  await apiClient.put(`/children/${childId}/dingtalk-config`, { webhookUrl, secret });
}

async function testChildWebhook(childId: number): Promise<void> {
  await apiClient.post('/settings/test-webhook', { childId });
}

async function getUserInfo(): Promise<any> {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

async function updateAvatar(avatar: string): Promise<void> {
  await apiClient.post('/auth/avatar', { avatar });
}

async function updatePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiClient.put('/auth/password', { oldPassword, newPassword });
}

export default function SettingsPage() {
  const [familyName, setFamilyName] = useState('我的家庭');
  const [dailyTimeLimit, setDailyTimeLimit] = useState(210);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [childWebhooks, setChildWebhooks] = useState<Record<number, string>>({});
  const [childSecrets, setChildSecrets] = useState<Record<number, string>>({});
  const [originalChildWebhooks, setOriginalChildWebhooks] = useState<Record<number, string>>({});
  const [originalChildSecrets, setOriginalChildSecrets] = useState<Record<number, string>>({});
  const [savingChildId, setSavingChildId] = useState<number | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  
  // Account settings state
  const [avatar, setAvatar] = useState<string>('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  // Load current settings
  const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['family-settings'],
    queryFn: getFamilySettings,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Load children list
  const { data: childrenData, isLoading: isLoadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: getChildren,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Load user info
  const { data: userInfoData, isLoading: isLoadingUserInfo } = useQuery({
    queryKey: ['user-info'],
    queryFn: getUserInfo,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Load settings
  useEffect(() => {
    if (settingsData?.data) {
      const { familyName: name, settings } = settingsData.data;
      setFamilyName(name || '我的家庭');
      setDailyTimeLimit(settings?.dailyTimeLimit || 210);
    }
  }, [settingsData]);

  // Load user info
  useEffect(() => {
    if (userInfoData?.data) {
      setAvatar(userInfoData.data.avatar || '');
    }
  }, [userInfoData]);

  // Load child dingtalk configs
  useEffect(() => {
    if (childrenData?.data) {
      childrenData.data.forEach(async (child: any) => {
        try {
          const configData = await getChildDingtalkConfig(child.id);
          const webhook = configData.data.webhookUrl || '';
          const secret = configData.data.secret || '';
          setChildWebhooks(prev => ({ ...prev, [child.id]: webhook }));
          setChildSecrets(prev => ({ ...prev, [child.id]: secret }));
          setOriginalChildWebhooks(prev => ({ ...prev, [child.id]: webhook }));
          setOriginalChildSecrets(prev => ({ ...prev, [child.id]: secret }));
        } catch (error) {
          console.error(`Failed to load dingtalk config for child ${child.id}:`, error);
        }
      });
    }
  }, [childrenData]);

  // Update family settings mutation
  const updateFamilyMutation = useMutation({
    mutationFn: updateFamilySettings,
    onSuccess: () => {
      toast.success('家庭设置已保存');
    },
    onError: (error) => {
      toast.error(`保存失败：${getErrorMessage(error)}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFamilyData,
    onSuccess: () => {
      toast.success('数据已删除');
      setDeleteConfirmOpen(false);
      setDeleteConfirmText('');
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  // Update child dingtalk config mutation
  const updateChildWebhookMutation = useMutation({
    mutationFn: ({ childId, webhookUrl, secret }: { childId: number; webhookUrl: string; secret?: string }) =>
      updateChildDingtalkConfig(childId, webhookUrl, secret),
    onSuccess: (_, variables) => {
      toast.success(`${getChildName(variables.childId)}的钉钉配置已保存`);
      // Update original values after successful save
      setOriginalChildWebhooks(prev => ({ ...prev, [variables.childId]: variables.webhookUrl }));
      setOriginalChildSecrets(prev => ({ ...prev, [variables.childId]: variables.secret || '' }));
      setSavingChildId(null);
    },
    onError: (error, variables) => {
      toast.error(`保存失败：${getErrorMessage(error)}`, {
        description: `无法为「${getChildName(variables.childId)}」保存钉钉配置`,
        duration: 5000,
      });
      setSavingChildId(null);
    }
  });

  // Test child webhook mutation
  const testChildWebhookMutation = useMutation({
    mutationFn: testChildWebhook,
    onSuccess: (_, childId) => {
      toast.success(`测试消息已发送至「${getChildName(childId)}」的钉钉群`);
    },
    onError: (error, childId) => {
      toast.error(`测试失败：${getErrorMessage(error)}`, {
        description: `无法发送消息到「${getChildName(childId)}」的钉钉群，请检查Webhook地址和密钥是否正确`,
        duration: 5000,
      });
    }
  });

  // Update avatar mutation
  const updateAvatarMutation = useMutation({
    mutationFn: updateAvatar,
    onSuccess: () => {
      toast.success('头像已更新');
      setAvatarChanged(false);
    },
    onError: (error) => {
      toast.error(`更新头像失败：${getErrorMessage(error)}`);
    }
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      updatePassword(oldPassword, newPassword),
    onSuccess: () => {
      toast.success('密码已修改，请妥善保管');
      setPasswordChanged(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      toast.error(`修改密码失败：${getErrorMessage(error)}`);
    }
  });

  const getChildName = (childId: number) => {
    const child = childrenData?.data?.find((c: any) => c.id === childId);
    return child?.name || '孩子';
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAvatar(base64);
        setAvatarChanged(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar('');
    setAvatarChanged(true);
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    
    try {
      // Save family settings
      await updateFamilyMutation.mutateAsync({ familyName, dailyTimeLimit });
      
      // Save all child configs that have changed
      if (childrenData?.data) {
        for (const child of childrenData.data) {
          const currentWebhook = childWebhooks[child.id] || '';
          const currentSecret = childSecrets[child.id] || '';
          const originalWebhook = originalChildWebhooks[child.id] || '';
          const originalSecret = originalChildSecrets[child.id] || '';
          
          // Only save if changed
          if (currentWebhook !== originalWebhook || currentSecret !== originalSecret) {
            await updateChildWebhookMutation.mutateAsync({ 
              childId: child.id, 
              webhookUrl: currentWebhook, 
              secret: currentSecret 
            });
          }
        }
      }
      
      // Save account settings
      if (avatarChanged) {
        await updateAvatarMutation.mutateAsync(avatar);
      }
      
      if (passwordChanged) {
        // Validate password
        if (newPassword.length < 8) {
          throw new Error('密码长度至少8位');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('两次输入的密码不一致');
        }
        await updatePasswordMutation.mutateAsync({ oldPassword, newPassword });
      }
      
      toast.success('所有设置已保存');
    } catch (error) {
      console.error('Save all error:', error);
      toast.error(`保存失败：${getErrorMessage(error)}`);
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDeleteData = () => {
    if (deleteConfirmText !== '删除') { 
      toast.error('请输入"删除"确认'); 
      return; 
    }
    deleteMutation.mutate();
  };

  const handleSaveChildWebhook = (childId: number) => {
    const webhookUrl = childWebhooks[childId] || '';
    const secret = childSecrets[childId] || '';
    setSavingChildId(childId);
    updateChildWebhookMutation.mutate({ childId, webhookUrl, secret });
  };

  const handleTestChildWebhook = (childId: number) => {
    const webhookUrl = childWebhooks[childId] || '';
    if (!webhookUrl || webhookUrl.trim() === '') { 
      toast.error(`请先为「${getChildName(childId)}」配置钉钉Webhook地址后再测试`, {
        description: '在上方输入框中填写Webhook地址并保存',
        duration: 4000,
      }); 
      return; 
    }
    testChildWebhookMutation.mutate(childId);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const getConfiguredCount = () => {
    if (!childrenData?.data) return 0;
    return childrenData.data.filter((child: any) => {
      const webhook = childWebhooks[child.id];
      return webhook && webhook.trim() !== '';
    }).length;
  };

  const hasChanges = () => {
    // Check family settings changes
    if (settingsData?.data) {
      const { familyName: originalName, settings } = settingsData.data;
      const originalTimeLimit = settings?.dailyTimeLimit || 210;
      if (familyName !== (originalName || '我的家庭')) return true;
      if (dailyTimeLimit !== originalTimeLimit) return true;
    }
    
    // Check child config changes
    if (childrenData?.data) {
      for (const child of childrenData.data) {
        const currentWebhook = childWebhooks[child.id] || '';
        const currentSecret = childSecrets[child.id] || '';
        const originalWebhook = originalChildWebhooks[child.id] || '';
        const originalSecret = originalChildSecrets[child.id] || '';
        if (currentWebhook !== originalWebhook || currentSecret !== originalSecret) return true;
      }
    }
    
    // Check account settings changes
    if (avatarChanged || passwordChanged) return true;
    
    return false;
  };

  return (
    <div className="-mx-6 px-6 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="text-gray-500 mt-1">管理家庭信息和钉钉通知配置</p>
      </div>

      <div className="space-y-6">
        {/* Family Info Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900">家庭信息</h2>
          </div>
          
          <Card className="border border-gray-200 rounded-2xl shadow-sm bg-gray-50/50">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="familyName" className="text-sm font-medium text-gray-700">家庭名称</Label>
                <Input 
                  id="familyName" 
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="例如：快乐学习之家" 
                  className="h-11 rounded-xl bg-white"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">每日学习时长上限</Label>
                  <span className="text-lg font-bold text-purple-600">{formatTime(dailyTimeLimit)}</span>
                </div>
                <Slider
                  value={[dailyTimeLimit]}
                  onValueChange={([value]) => setDailyTimeLimit(value)}
                  min={60} max={480} step={15}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">建议：低年级1.5-2小时，高年级3-4小时</p>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Notification Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">钉钉群通知</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">启用钉钉通知</span>
              <Switch 
                checked={notificationsEnabled} 
                onCheckedChange={setNotificationsEnabled} 
                className="data-[state=checked]:bg-purple-500"
              />
            </div>
          </div>
          
          <Card className="border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              {!notificationsEnabled && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
                  钉钉通知已关闭，开启后才能配置和发送通知
                </div>
              )}
              
              {isLoadingChildren ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-purple-500 rounded-full animate-spin mx-auto mb-3"></div>
                  加载孩子列表中...
                </div>
              ) : childrenData?.data && childrenData.data.length > 0 ? (
                <div className="space-y-4">
                  {childrenData.data.map((child: any, index: number) => (
                    <div key={child.id}>
                      {index > 0 && <Separator className="my-4" />}
                      <div className="space-y-4">
                        {/* Child Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-lg">
                              {child.avatar || '👶'}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{child.name}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {childWebhooks[child.id] ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                    <span className="text-xs text-green-600">已配置</span>
                                  </>
                                ) : (
                                  <>
                                    <Circle className="w-3.5 h-3.5 text-gray-300" />
                                    <span className="text-xs text-gray-400">未配置</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          {childWebhooks[child.id] && (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                              <MessageCircle className="w-3 h-3 mr-1" />
                              已启用
                            </Badge>
                          )}
                        </div>

                        {/* Config Fields */}
                        <div className="space-y-3 pl-1">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500">Webhook 地址</Label>
                            <Input 
                              value={childWebhooks[child.id] || ''} 
                              onChange={(e) => setChildWebhooks(prev => ({ ...prev, [child.id]: e.target.value }))}
                              placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." 
                              className="h-10 rounded-lg text-sm"
                              disabled={!notificationsEnabled}
                              type="password"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-gray-500">加签密钥（可选）</Label>
                              <span className="text-xs text-gray-400">如开启加签需填写</span>
                            </div>
                            <Input 
                              value={childSecrets[child.id] || ''} 
                              onChange={(e) => setChildSecrets(prev => ({ ...prev, [child.id]: e.target.value }))}
                              placeholder="SECxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                              className="h-10 rounded-lg text-sm"
                              disabled={!notificationsEnabled}
                              type="password"
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-1">
                            <a 
                              href="https://open.dingtalk.com/document/robots/custom-robot-access" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1 transition-colors"
                            >
                              如何获取？
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            
                            <div className="flex gap-2">
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => handleTestChildWebhook(child.id)} 
                                disabled={!notificationsEnabled || !childWebhooks[child.id] || testChildWebhookMutation.isPending} 
                                className="h-8 px-3 rounded-lg"
                              >
                                <Send className="w-3.5 h-3.5 mr-1.5" />
                                测试
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => handleSaveChildWebhook(child.id)} 
                                disabled={!notificationsEnabled || savingChildId === child.id} 
                                variant={savingChildId === child.id ? "outline" : "default"}
                                className="h-8 px-3 rounded-lg"
                              >
                                {savingChildId === child.id ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></div>
                                    保存中
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3.5 h-3.5 mr-1.5" />
                                    保存
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500">暂无孩子信息</p>
                  <p className="text-sm text-gray-400 mt-1">请先添加孩子账户</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>

        {/* Account Settings Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-gray-900">账户设置</h2>
          </div>
          
          <Card className="border border-gray-200 rounded-2xl shadow-sm bg-gray-50/50">
            <CardContent className="p-6 space-y-6">
              {/* Avatar Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">头像设置</h3>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-2xl font-medium shadow-lg">
                      {avatar ? (
                        <img src={avatar} alt="头像" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        userInfoData?.data?.name?.charAt(0) || 'P'
                      )}
                    </div>
                    <button
                      onClick={handleRemoveAvatar}
                      className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors"
                      title="移除头像"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-lg"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="avatar-upload"
                        onChange={handleAvatarUpload}
                      />
                      <label htmlFor="avatar-upload" className="cursor-pointer flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        上传新头像
                      </label>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveAvatar}
                      className="rounded-lg"
                    >
                      移除头像
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">支持 JPG、PNG 格式，最大 2MB</p>
                </div>
              </div>

              {/* Password Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">密码修改</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="old-password" className="text-sm font-medium text-gray-700">当前密码</Label>
                    <Input 
                      id="old-password"
                      type="password"
                      value={oldPassword}
                      onChange={(e) => {
                        setOldPassword(e.target.value);
                        setPasswordChanged(true);
                      }}
                      placeholder="请输入当前密码"
                      className="h-11 rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">新密码</Label>
                    <Input 
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordChanged(true);
                      }}
                      placeholder="请输入新密码"
                      className="h-11 rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">确认新密码</Label>
                    <Input 
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordChanged(true);
                      }}
                      placeholder="请再次输入新密码"
                      className="h-11 rounded-xl bg-white"
                    />
                  </div>
                  <p className="text-xs text-gray-400">密码需包含字母和数字，长度至少8位</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Danger Zone Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-600">危险区域</h2>
          </div>
          
          <Card className="border border-red-200 rounded-2xl shadow-sm bg-red-50/50">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">删除所有数据</h3>
                  <p className="text-sm text-gray-500 mt-1">永久删除所有家庭成员、任务、计划和学习记录。此操作不可撤销！</p>
                </div>
                <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="shrink-0 rounded-lg bg-red-500 hover:bg-red-600">
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      删除数据
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-red-600">确认删除所有数据？</AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作将永久删除所有数据，包括：
                        <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                          <li>所有孩子账户和学习记录</li>
                          <li>所有任务和周计划</li>
                          <li>所有图书和阅读记录</li>
                          <li>所有成就和解锁记录</li>
                        </ul>
                        <p className="mt-3 font-medium text-red-600">此操作无法撤销！</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                      <Label htmlFor="confirmDelete">请输入"删除"确认</Label>
                      <Input 
                        id="confirmDelete" 
                        value={deleteConfirmText} 
                        onChange={(e) => setDeleteConfirmText(e.target.value)} 
                        placeholder="删除" 
                        className="mt-2 h-11 rounded-lg"
                      />
                    </div>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel onClick={() => setDeleteConfirmText('')} className="rounded-lg">
                        取消
                      </AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteData} 
                        disabled={deleteMutation.isPending || deleteConfirmText !== '删除'} 
                        className="bg-red-500 hover:bg-red-600 rounded-lg"
                      >
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </div>

      {/* Global Save Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {hasChanges() ? (
              <span className="text-purple-600 font-medium">有未保存的更改</span>
            ) : (
              <span>所有更改已保存</span>
            )}
          </div>
          <Button 
            onClick={handleSaveAll}
            disabled={isSavingAll || !hasChanges()}
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25"
          >
            {isSavingAll ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存设置
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
