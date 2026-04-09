import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserProfileModal({ open, onOpenChange }: UserProfileModalProps) {
  const { user, updateAuth } = useAuth();
  const [avatar, setAvatar] = useState<string>(user?.avatar || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAvatar(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // 验证密码
      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error('密码至少6位');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('两次输入的密码不一致');
        }
        // 调用修改密码接口
        const passwordResponse = await fetch('/api/user/password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ oldPassword, newPassword }),
        });
        if (!passwordResponse.ok) {
          throw new Error('修改密码失败');
        }
      }

      // 上传头像
      if (avatar !== user?.avatar) {
        const avatarResponse = await fetch('/api/user/avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ avatar }),
        });
        if (!avatarResponse.ok) {
          throw new Error('上传头像失败');
        }
      }

      // 更新本地用户信息
      if (updateAuth && user) {
        updateAuth({ token: localStorage.getItem('auth_token') || '', user: { ...user, avatar } });
      }

      toast.success('保存成功');
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || '保存失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>个人设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* 头像设置 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">头像设置</h3>
            <div className="flex items-center gap-4">
              <Avatar className="size-20">
                <AvatarImage src={avatar} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white text-xl font-medium">
                  {user?.name?.charAt(0) || 'P'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="avatar-upload"
                    onChange={handleAvatarUpload}
                  />
                  <label htmlFor="avatar-upload" className="cursor-pointer w-full">
                    上传头像
                  </label>
                </Button>
                <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式</p>
              </div>
            </div>
          </div>

          {/* 密码修改 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">密码修改</h3>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="old-password">原密码</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入原密码"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password">确认新密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
