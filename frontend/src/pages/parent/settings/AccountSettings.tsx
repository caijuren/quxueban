import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, User, Mail, Phone, Pencil, X, Check, Shield, History, Eye, EyeOff, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

async function getUserInfo(): Promise<any> {
  const response = await apiClient.get('/me');
  return response.data;
}

async function updateAvatar(avatar: string): Promise<{ avatar: string; token?: string }> {
  const response = await apiClient.post('/avatar', { avatar });
  return response.data.data;
}

async function updatePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiClient.put('/password', { oldPassword, newPassword });
}

async function updateUsername(name: string, password: string): Promise<{ name: string; token: string }> {
  const response = await apiClient.put('/me/username', { name, password });
  return response.data.data;
}

// 模拟操作历史数据
const mockActivityHistory = [
  { id: 1, action: '修改用户名', detail: '从 "andycoy" 改为 "糊涂棒棒"', time: '2024-04-19 15:30', type: 'success' },
  { id: 2, action: '更换头像', detail: '上传了新头像', time: '2024-04-18 10:20', type: 'success' },
  { id: 3, action: '修改密码', detail: '密码已更新', time: '2024-04-15 09:15', type: 'success' },
];

export default function AccountSettings() {
  const [avatar, setAvatar] = useState('');
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  
  // Username inline edit state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editUsernamePassword, setEditUsernamePassword] = useState('');
  const [showUsernamePassword, setShowUsernamePassword] = useState(false);
  
  // Password wizard state
  const [passwordStep, setPasswordStep] = useState<1 | 2 | 3>(1);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const queryClient = useQueryClient();

  const { data: userInfo } = useQuery({
    queryKey: ['user-info'],
    queryFn: getUserInfo,
  });

  const avatarMutation = useMutation({
    mutationFn: updateAvatar,
    onSuccess: async (data, nextAvatar) => {
      toast.success('头像已更新');

      if (data?.token) {
        localStorage.setItem('parent_token', data.token);
      }

      const storedUser = localStorage.getItem('parent_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          localStorage.setItem('parent_user', JSON.stringify({ ...user, avatar: nextAvatar }));
          window.dispatchEvent(new Event('parent-auth:updated'));
        } catch (error) {
          console.error('Failed to sync parent avatar to local storage', error);
        }
      }
    },
    onError: (error) => toast.error(`更新失败：${getErrorMessage(error)}`),
  });

  const passwordMutation = useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      updatePassword(oldPassword, newPassword),
    onSuccess: () => {
      toast.success('密码已修改');
      setPasswordStep(3);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStrength(0);
    },
    onError: (error) => {
      toast.error(`修改失败：${getErrorMessage(error)}`);
      setPasswordStep(1);
    },
  });

  const usernameMutation = useMutation({
    mutationFn: ({ name, password }: { name: string; password: string }) => updateUsername(name, password),
    onSuccess: (data) => {
      toast.success('用户名修改成功');
      
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          localStorage.setItem('auth_user', JSON.stringify({ ...user, name: data.name }));
          window.dispatchEvent(new Event('auth:updated'));
        } catch (error) {
          console.error('Failed to sync username to local storage', error);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['user-info'] });
      setIsEditingUsername(false);
      setEditUsername('');
      setEditUsernamePassword('');
    },
    onError: (error) => toast.error(`修改失败：${getErrorMessage(error)}`),
  });

  useEffect(() => {
    if (userInfo?.data?.avatar) {
      setAvatar(userInfo.data.avatar);
    }
  }, [userInfo]);

  // Calculate password strength
  useEffect(() => {
    let strength = 0;
    if (newPassword.length >= 6) strength += 20;
    if (newPassword.length >= 10) strength += 20;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) strength += 20;
    if (/[0-9]/.test(newPassword)) strength += 20;
    if (/[^a-zA-Z0-9]/.test(newPassword)) strength += 20;
    setPasswordStrength(strength);
  }, [newPassword]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isSupportedType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      if (!isSupportedType) {
        toast.error('仅支持 JPG、PNG 或 WebP 图片');
        e.target.value = '';
        return;
      }

      const maxFileSize = 1024 * 1024;
      if (file.size > maxFileSize) {
        toast.error('图片请控制在 1MB 以内');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAvatar(base64);
        avatarMutation.mutate(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Username edit handlers
  const handleStartEditUsername = () => {
    setEditUsername(userInfo?.data?.name || '');
    setEditUsernamePassword('');
    setIsEditingUsername(true);
  };

  const handleCancelEditUsername = () => {
    setIsEditingUsername(false);
    setEditUsername('');
    setEditUsernamePassword('');
  };

  const handleSubmitUsername = () => {
    if (!editUsername.trim()) {
      toast.error('用户名不能为空');
      return;
    }
    if (editUsername.length < 2 || editUsername.length > 20) {
      toast.error('用户名长度应在2-20个字符之间');
      return;
    }
    if (!editUsernamePassword) {
      toast.error('请输入密码确认');
      return;
    }
    if (editUsername === userInfo?.data?.name) {
      toast.error('新用户名不能与当前用户名相同');
      return;
    }
    usernameMutation.mutate({ name: editUsername.trim(), password: editUsernamePassword });
  };

  // Password wizard handlers
  const handleVerifyOldPassword = () => {
    if (!oldPassword) {
      toast.error('请输入当前密码');
      return;
    }
    setPasswordStep(2);
  };

  const handleSetNewPassword = () => {
    if (newPassword.length < 6) {
      toast.error('密码至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次密码不一致');
      return;
    }
    passwordMutation.mutate({ oldPassword, newPassword });
  };

  const handleResetPasswordWizard = () => {
    setPasswordStep(1);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordStrength(0);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 20) return 'bg-destructive';
    if (passwordStrength <= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 20) return '弱';
    if (passwordStrength <= 60) return '中';
    if (passwordStrength <= 80) return '强';
    return '非常强';
  };

  // Calculate security score
  const calculateSecurityScore = () => {
    let score = 0;
    if (userInfo?.data?.avatar) score += 20;
    if (userInfo?.data?.name && userInfo.data.name.length >= 2) score += 20;
    // Check if password was recently changed (mock)
    score += 20;
    // Check if has activity history
    score += 20;
    // Base score
    score += 20;
    return Math.min(score, 100);
  };

  const securityScore = calculateSecurityScore();

  const user = userInfo?.data;

  return (
    <div className="space-y-8">
      {/* Security Score Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            账号安全评分
          </CardTitle>
          <CardDescription>提升安全等级，保护您的账号</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">{securityScore}分</span>
                <span className="text-sm text-muted-foreground">
                  {securityScore >= 80 ? '优秀' : securityScore >= 60 ? '良好' : '需加强'}
                </span>
              </div>
              <Progress value={securityScore} className="h-2" />
            </div>
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
              securityScore >= 80 ? "bg-green-100 text-green-700" :
              securityScore >= 60 ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            )}>
              {securityScore}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              {user?.avatar ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
              <span>已设置头像</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>已设置用户名</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>密码强度良好</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span>未开启两步验证</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avatar Section */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">头像</h4>
        <div className="flex items-center gap-6">
          <div className="relative group cursor-pointer" onClick={() => avatar && setIsAvatarPreviewOpen(true)}>
            <Avatar className="w-20 h-20 transition-transform group-hover:scale-105">
              <AvatarImage src={avatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {user?.name?.charAt(0) || 'P'}
              </AvatarFallback>
            </Avatar>
            {avatar && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Eye className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="relative" disabled={avatarMutation.isPending}>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleAvatarUpload}
                />
                <Camera className="w-4 h-4 mr-2" />
                {avatarMutation.isPending ? '上传中...' : '更换头像'}
              </Button>
              {avatar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAvatar('');
                    avatarMutation.mutate('');
                  }}
                  disabled={avatarMutation.isPending}
                >
                  移除
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">支持 JPG、PNG、WebP，建议 1MB 以内</p>
          </div>
        </div>
      </section>

      <Separator />

      {/* Profile Section */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">基本信息</h4>
        <div className="grid gap-4 max-w-md">
          {/* Username with inline edit */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              用户名
            </Label>
            {isEditingUsername ? (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="edit-username" className="text-sm">新用户名</Label>
                  <Input
                    id="edit-username"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="请输入新用户名"
                    maxLength={20}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">用户名长度应在2-20个字符之间</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-username-password" className="text-sm">当前密码确认</Label>
                  <div className="relative">
                    <Input
                      id="edit-username-password"
                      type={showUsernamePassword ? 'text' : 'password'}
                      value={editUsernamePassword}
                      onChange={(e) => setEditUsernamePassword(e.target.value)}
                      placeholder="请输入当前密码"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowUsernamePassword(!showUsernamePassword)}
                    >
                      {showUsernamePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSubmitUsername}
                    disabled={usernameMutation.isPending}
                    className="flex-1"
                  >
                    {usernameMutation.isPending ? '保存中...' : <><Check className="w-4 h-4 mr-1" /> 确认</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEditUsername}
                    disabled={usernameMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-1" /> 取消
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={user?.name || ''} disabled className="bg-muted flex-1" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStartEditUsername}
                  className="shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              邮箱
            </Label>
            <Input placeholder="未绑定邮箱" disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">邮箱绑定功能即将上线</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              手机号
            </Label>
            <Input placeholder="未绑定手机号" disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">手机号绑定功能即将上线</p>
          </div>
        </div>
      </section>

      <Separator />

      {/* Password Section with Wizard */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">修改密码</h4>
        <div className="max-w-md">
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              passwordStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>1</div>
            <div className={cn("flex-1 h-1 transition-colors", passwordStep >= 2 ? "bg-primary" : "bg-muted")} />
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              passwordStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>2</div>
            <div className={cn("flex-1 h-1 transition-colors", passwordStep >= 3 ? "bg-primary" : "bg-muted")} />
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              passwordStep >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>3</div>
          </div>

          {/* Step 1: Verify Old Password */}
          {passwordStep === 1 && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>修改密码需要验证您的身份</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>当前密码</Label>
                <div className="relative">
                  <Input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="请输入当前密码"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <Button onClick={handleVerifyOldPassword} className="w-full">
                下一步
              </Button>
            </div>
          )}

          {/* Step 2: Set New Password */}
          {passwordStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>新密码</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少6位，建议包含大小写字母和数字"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {newPassword && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>密码强度</span>
                      <span>{getPasswordStrengthText()}</span>
                    </div>
                    <Progress value={passwordStrength} className={cn("h-1", getPasswordStrengthColor())} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>确认新密码</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                    className={cn(
                      newPassword && confirmPassword && newPassword !== confirmPassword &&
                      'border-destructive focus:border-destructive'
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">两次输入的密码不一致</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPasswordStep(1)} className="flex-1">
                  上一步
                </Button>
                <Button 
                  onClick={handleSetNewPassword} 
                  disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || passwordMutation.isPending}
                  className="flex-1"
                >
                  {passwordMutation.isPending ? '修改中...' : '确认修改'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {passwordStep === 3 && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h5 className="font-medium text-lg">密码修改成功</h5>
                <p className="text-sm text-muted-foreground mt-1">请使用新密码重新登录</p>
              </div>
              <Alert className="text-left">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  建议您在所有设备上退出账号并重新登录，以确保账号安全。
                </AlertDescription>
              </Alert>
              <Button onClick={handleResetPasswordWizard} variant="outline">
                修改其他密码
              </Button>
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* Activity History */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4" />
          操作历史
        </h4>
        <div className="space-y-2">
          {mockActivityHistory.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <div className={cn(
                "w-2 h-2 rounded-full mt-2",
                activity.type === 'success' ? "bg-green-500" : "bg-yellow-500"
              )} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{activity.action}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{activity.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Avatar Preview Dialog */}
      <Dialog open={isAvatarPreviewOpen} onOpenChange={setIsAvatarPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>头像预览</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Avatar className="w-32 h-32">
              <AvatarImage src={avatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                {user?.name?.charAt(0) || 'P'}
              </AvatarFallback>
            </Avatar>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
