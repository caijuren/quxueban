import { useState } from 'react';
import { AlertTriangle, Trash2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function DangerZone() {
  const { logout } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('请输入 DELETE 以确认注销');
      return;
    }

    setIsDeleting(true);
    try {
      await apiClient.delete('/settings/account');
      toast.success('账户已注销');
      // Clear local storage and logout
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('selected_child_id');
      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      toast.error(`注销失败：${getErrorMessage(error)}`);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Delete Account */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-destructive uppercase tracking-wider">危险操作</h4>
        <div className="flex items-start gap-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h5 className="font-medium text-destructive">注销账户</h5>
            <p className="text-sm text-muted-foreground mt-1">
              永久删除您的账户和所有相关数据。此操作不可撤销！
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              <li>所有家庭成员数据将被删除</li>
              <li>所有学习记录和任务数据将被删除</li>
              <li>此操作无法撤销</li>
            </ul>
            <Button
              onClick={() => setIsDeleteDialogOpen(true)}
              variant="outline"
              size="sm"
              className="mt-4 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              注销账户
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      {/* Logout */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">账户操作</h4>
        <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h5 className="font-medium">退出登录</h5>
            <p className="text-sm text-muted-foreground mt-1">
              退出当前账户，返回登录页面
            </p>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      </section>

      {/* Delete Account Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              确认注销账户？
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                此操作将<span className="text-destructive font-medium">永久删除</span>您的账户和所有相关数据，包括：
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>所有家庭成员信息</li>
                <li>所有学习记录和任务数据</li>
                <li>所有图书和阅读记录</li>
                <li>所有成就和统计数据</li>
              </ul>
              <p className="text-destructive font-medium">
                此操作无法撤销！
              </p>
              <div className="pt-2">
                <p className="text-sm text-muted-foreground mb-2">
                  请输入 <code className="bg-muted px-1 py-0.5 rounded">DELETE</code> 以确认：
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="输入 DELETE"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText('')}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting || confirmText !== 'DELETE'}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  注销中...
                </>
              ) : (
                '确认注销'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
