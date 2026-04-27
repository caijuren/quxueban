import { useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Database,
  Edit3,
  Home,
  Lock,
  LogOut,
  Mail,
  Phone,
  Plus,
  Settings,
  Shield,
  Smartphone,
  Trash2,
  User,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import AccountSettings from './settings/AccountSettings';
import ChildrenManagement from './settings/ChildrenManagement';
import FamilySettings from './settings/FamilySettings';

type UserInfo = {
  id: number;
  name: string;
  role: string;
  avatar?: string;
  familyName?: string;
  familyCode?: string;
};

type FamilySettings = {
  familyName: string;
  familyCode: string;
  memberCount: number;
};

type Child = {
  id: number;
  name: string;
  avatar?: string;
};

async function getUserInfo(): Promise<UserInfo> {
  const response = await apiClient.get('/me');
  return response.data.data;
}

async function getFamilySettings(): Promise<FamilySettings> {
  const response = await apiClient.get('/settings');
  return response.data.data;
}

async function getChildren(): Promise<Child[]> {
  const response = await apiClient.get('/children');
  return response.data.data || [];
}

async function updateUsername(name: string, password: string): Promise<{ name: string; token?: string }> {
  const response = await apiClient.put('/me/username', { name, password });
  return response.data.data;
}

async function updateAvatar(avatar: string): Promise<{ avatar: string; token?: string }> {
  const response = await apiClient.post('/avatar', { avatar });
  return response.data.data;
}

const quickNavItems = [
  { id: 'account', title: '账户信息', desc: '头像、密码与安全设置', icon: UserRound, tone: 'from-violet-500 to-indigo-500', path: '/parent/settings/account-detail' },
  { id: 'family', title: '家庭设置', desc: '家庭成员与权限管理', icon: Home, tone: 'from-sky-400 to-blue-500', path: '/parent/settings/family-detail' },
  { id: 'children', title: '孩子管理', desc: '孩子信息与成长数据', icon: User, tone: 'from-emerald-400 to-teal-500', path: '/parent/settings/children-detail' },
  { id: 'notifications', title: '通知设置', desc: '消息通知与提醒方式', icon: Bell, tone: 'from-amber-400 to-orange-500' },
  { id: 'privacy', title: '数据与隐私', desc: '数据管理与隐私保护', icon: Shield, tone: 'from-rose-400 to-red-500' },
  { id: 'system', title: '系统设置', desc: '通用设置与偏好选项', icon: Settings, tone: 'from-blue-500 to-indigo-500' },
];

const quickActions = [
  { title: '修改密码', desc: '定期更换密码，保护账户安全', icon: Lock, action: 'password' },
  { title: '绑定手机', desc: '绑定手机号，便于找回账户', icon: Smartphone, action: 'phone' },
  { title: '设置两步验证', desc: '开启后登录更安全', icon: Shield, action: 'mfa' },
  { title: '注销账户', desc: '永久删除账户及所有数据', icon: Trash2, action: 'danger', danger: true },
];

function isImageAvatar(value?: string) {
  if (!value) return false;
  return value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
}

function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white p-5 shadow-sm', className)}>
      {children}
    </section>
  );
}

function IconBadge({ icon: Icon, className }: { icon: React.ElementType; className?: string }) {
  return (
    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernamePassword, setUsernamePassword] = useState('');

  const { data: user } = useQuery({ queryKey: ['settings-user-info'], queryFn: getUserInfo });
  const { data: family } = useQuery({ queryKey: ['settings-family'], queryFn: getFamilySettings });
  const { data: children = [] } = useQuery({ queryKey: ['children'], queryFn: getChildren });

  const avatarMutation = useMutation({
    mutationFn: updateAvatar,
    onSuccess: (data, nextAvatar) => {
      if (data?.token) localStorage.setItem('parent_token', data.token);
      const storedUser = localStorage.getItem('parent_user');
      if (storedUser) {
        try {
          localStorage.setItem('parent_user', JSON.stringify({ ...JSON.parse(storedUser), avatar: nextAvatar }));
          window.dispatchEvent(new Event('parent-auth:updated'));
        } catch {
          // Local storage sync is best-effort only.
        }
      }
      queryClient.invalidateQueries({ queryKey: ['settings-user-info'] });
      toast.success('头像已更新');
    },
    onError: (error) => toast.error(`更新失败：${getErrorMessage(error)}`),
  });

  const usernameMutation = useMutation({
    mutationFn: ({ name, password }: { name: string; password: string }) => updateUsername(name, password),
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('parent_token', data.token);
      }
      queryClient.invalidateQueries({ queryKey: ['settings-user-info'] });
      setUsernameDialogOpen(false);
      setUsernameInput('');
      setUsernamePassword('');
      toast.success('用户名已更新');
    },
    onError: (error) => toast.error(`修改失败：${getErrorMessage(error)}`),
  });

  const securityScore = useMemo(() => {
    let score = 40;
    if (user?.avatar) score += 20;
    if (user?.name) score += 20;
    if (children.length > 0) score += 10;
    if (family?.familyCode) score += 10;
    return Math.min(score, 100);
  }, [children.length, family?.familyCode, user?.avatar, user?.name]);

  const openUsernameDialog = () => {
    setUsernameInput(user?.name || '');
    setUsernamePassword('');
    setUsernameDialogOpen(true);
  };

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('仅支持 JPG、PNG 或 WebP 图片');
      event.target.value = '';
      return;
    }

    if (file.size > 1024 * 1024) {
      toast.error('图片请控制在 1MB 以内');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => avatarMutation.mutate(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const submitUsername = () => {
    if (!usernameInput.trim()) {
      toast.error('请输入用户名');
      return;
    }
    if (!usernamePassword) {
      toast.error('请输入当前密码确认');
      return;
    }
    usernameMutation.mutate({ name: usernameInput.trim(), password: usernamePassword });
  };

  const handleQuickAction = (action: string) => {
    if (action === 'password') {
      toast.info('请在账户详细设置中修改密码');
      navigate('/parent/settings/account-detail');
      return;
    }
    if (action === 'danger') {
      toast.error('注销账户属于危险操作，发布前会单独收口确认');
      return;
    }
    toast.info('该设置会在设置中心后续阶段接入');
  };

  const primaryChildren = children.slice(0, 3);
  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'P';
  const detailMode = location.pathname.includes('/account-detail')
    ? 'account'
    : location.pathname.includes('/family-detail')
      ? 'family'
      : location.pathname.includes('/children-detail')
        ? 'children'
        : null;

  if (detailMode) {
    const detailTitle = detailMode === 'account' ? '账户信息' : detailMode === 'family' ? '家庭设置' : '孩子管理';
    const DetailComponent = detailMode === 'account' ? AccountSettings : detailMode === 'family' ? FamilySettings : ChildrenManagement;

    return (
      <div className="mx-auto max-w-[1280px] space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-normal">{detailTitle}</h1>
            <p className="mt-2 text-sm text-slate-500">从设置总览进入的详细配置页面</p>
          </div>
          <Button variant="outline" className="rounded-lg" onClick={() => navigate('/parent/settings/account')}>
            返回总览
          </Button>
        </div>
        <DetailComponent />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-5 text-slate-950">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">设置</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">管理您的账户、家庭和个性化设置</p>
        </div>
        <button className="relative flex h-10 w-10 items-center justify-center self-start rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm">
          <Bell className="h-4 w-4" />
        </button>
      </header>

      <SectionCard>
        <h2 className="text-lg font-bold">快速导航</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {quickNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.path) navigate(item.path);
                  else toast.info('该设置会在设置中心后续阶段接入');
                }}
                className={cn(
                  'min-h-32 rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                  'border-slate-200'
                )}
              >
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-sm', item.tone)}>
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-base font-bold text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">账户信息</h2>
          <button onClick={() => navigate('/parent/settings/account-detail')} className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-primary">
            查看全部
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-8 xl:grid-cols-[520px_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:justify-start">
            <div className="relative">
              <Avatar className="h-24 w-24 bg-indigo-50 text-3xl shadow-sm">
                {isImageAvatar(user?.avatar) ? <AvatarImage src={user?.avatar} /> : null}
                <AvatarFallback className="bg-indigo-50 text-3xl font-bold text-indigo-600">
                  {isImageAvatar(user?.avatar) ? userInitial : user?.avatar || userInitial}
                </AvatarFallback>
              </Avatar>
              <label className="absolute -right-1 top-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-primary">
                <Edit3 className="h-4 w-4" />
                <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} />
              </label>
            </div>
            <div className="text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <p className="text-lg font-bold">{user?.name || '家长'}</p>
                <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">家长</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">加入时间：2026-04-26</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
            <div className="space-y-4">
              {[
                ['用户名', user?.name || '未设置', UserRound],
                ['邮箱', `${user?.name || 'user'}@example.com`, Mail],
                ['手机号码', '138 **** 5678', Phone],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-500">{String(label)}</span>
                  <div className="flex gap-2">
                    <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800">
                      <Icon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">{String(value)}</span>
                    </div>
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg" onClick={label === '用户名' ? openUsernameDialog : undefined}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-indigo-50/70 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="font-bold">账户安全评分</p>
                  <p className="mt-1 text-sm text-slate-500">提升安全等级，保护您的账户</p>
                </div>
              </div>
              <div className="mt-7 flex items-end justify-between">
                <p className="text-4xl font-bold">{securityScore}<span className="text-lg text-slate-500">/100</span></p>
                <span className="text-sm font-semibold text-slate-500">{securityScore >= 80 ? '优秀' : securityScore >= 60 ? '良好' : '需加强'}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-indigo-100">
                <div className="h-full rounded-full bg-indigo-600" style={{ width: `${securityScore}%` }} />
              </div>
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                {[
                  [Boolean(user?.avatar), '已设置头像'],
                  [Boolean(user?.name), '已设置用户名'],
                  [true, '密码强度良好'],
                  [false, '未开启两步验证'],
                ].map(([ok, label]) => (
                  <div key={String(label)} className="flex items-center gap-2">
                    {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    <span className="font-medium text-slate-600">{String(label)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">家庭成员</h2>
            <p className="mt-1 text-sm text-slate-500">管理家庭成员与权限</p>
          </div>
          <button onClick={() => navigate('/parent/settings/children-detail')} className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-primary">
            管理成员
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MemberCard name={user?.name || '家长'} subtitle="账户所有者" avatar={user?.avatar || userInitial} badge="家长" tone="border-rose-100" />
          {primaryChildren.map((child) => (
            <MemberCard key={child.id} name={child.name} subtitle="孩子账户" avatar={child.avatar || child.name.charAt(0)} badge="孩子" />
          ))}
          <button onClick={() => navigate('/parent/settings/children-detail')} className="flex min-h-[90px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600">
            <div className="text-center">
              <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white">
                <Plus className="h-5 w-5" />
              </span>
              <p className="mt-2 text-sm font-semibold">添加成员</p>
            </div>
          </button>
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
        <SectionCard>
          <h2 className="text-lg font-bold">最近操作</h2>
          <p className="mt-1 text-sm text-slate-500">操作日志会在审计能力完成后展示。</p>
          <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            暂无可展示的真实操作记录
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="text-lg font-bold">快捷操作</h2>
          <div className="mt-5 space-y-3">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  onClick={() => handleQuickAction(item.action)}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-lg p-4 text-left transition-colors',
                    item.danger ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-slate-50 hover:bg-slate-100'
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', item.danger ? 'text-red-600' : 'text-slate-600')} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.title}</p>
                    <p className={cn('mt-1 text-sm', item.danger ? 'text-red-600/80' : 'text-slate-500')}>{item.desc}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <MiniSettingsCard icon={Bell} title="通知设置" desc="消息提醒和钉钉通知会在通知中心统一配置。" />
        <MiniSettingsCard icon={Database} title="数据与隐私" desc="导出、清理和隐私设置保留在发布前专项确认。" />
        <MiniSettingsCard icon={LogOut} title="系统设置" desc="语言、显示偏好和通用设置后续统一收口。" />
      </div>

      <Dialog open={usernameDialogOpen} onOpenChange={setUsernameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改用户名</DialogTitle>
            <DialogDescription>修改用户名需要输入当前密码确认。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input value={usernameInput} onChange={(event) => setUsernameInput(event.target.value)} placeholder="输入新用户名" />
            <Input type="password" value={usernamePassword} onChange={(event) => setUsernamePassword(event.target.value)} placeholder="输入当前密码" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsernameDialogOpen(false)}>取消</Button>
            <Button onClick={submitUsername} disabled={usernameMutation.isPending}>
              {usernameMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberCard({
  name,
  subtitle,
  avatar,
  badge,
  tone,
}: {
  name: string;
  subtitle: string;
  avatar?: string;
  badge: string;
  tone?: string;
}) {
  const isImage = isImageAvatar(avatar);
  return (
    <div className={cn('flex min-h-[90px] items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm', tone)}>
      <Avatar className="h-12 w-12 bg-indigo-50">
        {isImage ? <AvatarImage src={avatar} /> : null}
        <AvatarFallback className="bg-indigo-50 text-lg font-bold text-indigo-600">{isImage ? name.charAt(0) : avatar || name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-bold text-slate-900">{name}</p>
          <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">{badge}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function MiniSettingsCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <IconBadge icon={Icon} className="bg-slate-50 text-slate-600" />
      <h3 className="mt-4 font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
    </section>
  );
}
