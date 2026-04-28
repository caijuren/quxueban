import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { showCopyableError } from '@/lib/error-toast';

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserProfileModal({ open, onOpenChange }: UserProfileModalProps) {
  const { user, updateUser } = useAuth();
  const [avatar, setAvatar] = useState<string>(user?.avatar || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('头像图片请控制在 2MB 以内');
      return;
    }

    setAvatarFile(file);
    setAvatar(URL.createObjectURL(file));
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
        const passwordResponse = await fetch('/api/password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          },
          body: JSON.stringify({ oldPassword, newPassword }),
        });
        if (!passwordResponse.ok) {
          const errorData = await passwordResponse.json();
          throw new Error(errorData.message || '修改密码失败');
        }
      }

      let nextAvatar = avatar;

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);

        const uploadResponse = await fetch('/api/upload/avatar', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => null);
          throw new Error(errorData?.message || '头像文件上传失败');
        }

        const uploadData = await uploadResponse.json();
        nextAvatar = uploadData?.data?.url || uploadData?.url;
        if (!nextAvatar) {
          throw new Error('头像上传成功，但没有返回头像链接');
        }
      }

      // 保存头像 URL
      if (avatar !== user?.avatar) {
        const avatarResponse = await fetch('/api/avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          },
          body: JSON.stringify({ avatar: nextAvatar }),
        });
        if (!avatarResponse.ok) {
          const errorData = await avatarResponse.json();
          throw new Error(errorData.message || '上传头像失败');
        }
      }

      // 更新本地用户信息
      if (updateUser && user) {
        updateUser({ avatar: nextAvatar });
      }

      setAvatar(nextAvatar);
      setAvatarFile(null);
      toast.success('保存成功');
      onOpenChange(false);
    } catch (error) {
      showCopyableError((error as Error).message || '保存失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm border border-border rounded-lg shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-center text-foreground">个人设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* 头像设置 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">头像设置</h3>
            <div className="flex flex-col items-center gap-3">
              <Avatar className="size-20 ring-2 ring-white shadow-sm">
                <AvatarImage src={avatar} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white text-xl font-medium">
                  {user?.name?.charAt(0) || 'P'}
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                variant="secondary"
                className="w-full max-w-xs py-1.5"
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

          {/* 密码修改 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">密码修改</h3>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="old-password" className="text-xs">原密码</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入原密码"
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-password" className="text-xs">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password" className="text-xs">确认新密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between border-t border-border pt-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="px-3 text-sm">
            取消
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="px-4 text-sm bg-primary hover:bg-primary/90">
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
