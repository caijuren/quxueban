import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Edit3,
  GraduationCap,
  HelpCircle,
  Home,
  KeyRound,
  Monitor,
  Plus,
  Settings,
  Shield,
  Smartphone,
  SquarePen,
  Upload,
  User,
  UserRound,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { showCopyableError } from '@/lib/error-toast';
import { cn } from '@/lib/utils';
import AccountSettings from './settings/AccountSettings';
import ChildrenManagement from './settings/ChildrenManagement';
import FamilySettings from './settings/FamilySettings';
import { PageToolbar, PageToolbarTitle } from '@/components/parent/PageToolbar';
import { useSelectedChild } from '@/contexts/SelectedChildContext';

type UserInfo = {
  id: number;
  name: string;
  role: string;
  avatar?: string;
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
  grade?: string;
};

type SettingStatus = '已接入' | '部分接入' | '待接入';

type ChildStats = {
  weeklyStudyTime: number;
  completedTasks: number;
  achievements: number;
  dailyMinutes: number;
  weeklyProgress: number;
};

type DingTalkConfig = {
  childId: number;
  childName: string;
  webhookUrl: string;
  secret: string;
};

type SemesterConfig = {
  schoolYear: string;
  term: 'first' | 'second';
  grade: string;
  startDate: string;
  endDate: string;
  readingStage: string;
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

async function updateAvatar(avatar: string): Promise<{ avatar: string; token?: string }> {
  const response = await apiClient.post('/avatar', { avatar });
  return response.data.data;
}

async function uploadAvatarFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await apiClient.post('/upload/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const avatarUrl = response.data?.data?.url || response.data?.url;
  if (!avatarUrl) {
    throw new Error('头像上传成功，但没有返回头像链接');
  }
  return avatarUrl;
}

async function updateDisplayName(name: string, password: string): Promise<{ name: string; token?: string }> {
  const response = await apiClient.put('/me/username', { name, password });
  return response.data.data;
}

async function getChildStats(childId: number): Promise<ChildStats> {
  const response = await apiClient.get(`/children/${childId}/stats`);
  return response.data.data;
}

async function getChildDingTalkConfig(childId: number): Promise<DingTalkConfig | null> {
  const response = await apiClient.get(`/children/${childId}/dingtalk-config`);
  return response.data.data || null;
}

async function updateChildDingTalkConfig(childId: number, data: { webhookUrl: string; secret?: string }): Promise<DingTalkConfig> {
  const response = await apiClient.put(`/children/${childId}/dingtalk-config`, data);
  return response.data.data;
}

async function getChildSemesterConfig(childId: number): Promise<SemesterConfig | null> {
  const response = await apiClient.get(`/children/${childId}/semester`);
  return response.data.data || null;
}

async function updateChildSemesterConfig(childId: number, data: SemesterConfig): Promise<SemesterConfig> {
  const response = await apiClient.put(`/children/${childId}/semester`, data);
  return response.data.data;
}

const settingDomains = [
  {
    title: '账户与安全',
    desc: '管理您的账户信息、登录安全与设备',
    icon: UserRound,
    color: 'violet',
    status: '已接入' as SettingStatus,
    path: '/parent/settings/account-detail',
    items: ['账户信息', '安全设置', '密码修改'],
  },
  {
    title: '家庭与权限',
    desc: '管理家庭信息、成员与权限设置',
    icon: Home,
    color: 'emerald',
    status: '部分接入' as SettingStatus,
    path: '/parent/settings/family-detail',
    items: ['家庭信息', '家庭码', '成员数量'],
  },
  {
    title: '孩子管理',
    desc: '管理孩子档案、学习设置与推送',
    icon: User,
    color: 'orange',
    status: '已接入' as SettingStatus,
    path: '/parent/settings/children-detail',
    items: ['孩子列表', '档案信息', '学期设置'],
  },
  {
    title: '通知与推送',
    desc: '管理消息推送、提醒设置与日志',
    icon: Bell,
    color: 'blue',
    status: '部分接入' as SettingStatus,
    path: '/parent/settings/children-detail',
    items: ['钉钉配置', '推送测试', '待接入：推送频率'],
  },
  {
    title: '数据与隐私',
    desc: '管理数据导出、备份与隐私设置',
    icon: Shield,
    color: 'rose',
    status: '待接入' as SettingStatus,
    items: ['待接入：数据导出', '待接入：备份与恢复', '待接入：隐私设置'],
  },
  {
    title: '系统偏好',
    desc: '个性化配置您的系统使用体验',
    icon: Settings,
    color: 'purple',
    status: '待接入' as SettingStatus,
    items: ['待接入：界面偏好', '待接入：默认设置', '待接入：统计口径'],
  },
];

const quickActions = [
  { title: '添加孩子', desc: '添加新的孩子档案', icon: Plus, action: 'children', status: '已接入' as SettingStatus, color: 'violet' },
  { title: '邀请家长', desc: '邀请其他家长加入', icon: Users, action: 'family', status: '待接入' as SettingStatus, color: 'violet' },
  { title: '导出数据', desc: '导出家庭学习数据', icon: Upload, action: 'export', status: '待接入' as SettingStatus, color: 'violet' },
  { title: '备份数据', desc: '备份重要数据', icon: Database, action: 'backup', status: '待接入' as SettingStatus, color: 'violet' },
  { title: '账户安全', desc: '检查账户安全状态', icon: Shield, action: 'account', status: '已接入' as SettingStatus, color: 'rose' },
  { title: '帮助中心', desc: '获取帮助与支持', icon: HelpCircle, action: 'help', status: '已接入' as SettingStatus, color: 'violet' },
];

const gradeOptions = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三'];

function getDefaultSemesterConfig(): SemesterConfig {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const secondTerm = month >= 2 && month <= 7;

  return {
    schoolYear: secondTerm ? `${year - 1}-${year}` : `${year}-${year + 1}`,
    term: secondTerm ? 'second' : 'first',
    grade: '一年级',
    startDate: secondTerm ? `${year}-02-17` : `${year}-09-01`,
    endDate: secondTerm ? `${year}-07-05` : `${year + 1}-01-20`,
    readingStage: secondTerm ? '一年级下' : '一年级上',
  };
}

function isImageAvatar(value?: string) {
  if (!value) return false;
  return value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
}

function getInitial(name?: string) {
  return name?.charAt(0)?.toUpperCase() || 'P';
}

function StatusPill({ status }: { status: SettingStatus }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        status === '已接入' && 'bg-emerald-50 text-emerald-700',
        status === '部分接入' && 'bg-amber-50 text-amber-700',
        status === '待接入' && 'bg-slate-100 text-slate-500'
      )}
    >
      {status}
    </span>
  );
}

function DomainIcon({ icon: Icon, color }: { icon: React.ElementType; color: string }) {
  const colorClass: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    orange: 'bg-orange-100 text-orange-600',
    blue: 'bg-blue-100 text-blue-600',
    rose: 'bg-rose-100 text-rose-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', colorClass[color])}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

function DomainTitle({ children, color }: { children: ReactNode; color: string }) {
  const colorClass: Record<string, string> = {
    violet: 'text-violet-600',
    emerald: 'text-emerald-600',
    orange: 'text-orange-600',
    blue: 'text-blue-600',
    rose: 'text-rose-600',
    purple: 'text-purple-600',
  };

  return <h2 className={cn('mt-7 text-lg font-bold', colorClass[color])}>{children}</h2>;
}

function DomainBullet({ color, pending }: { color: string; pending?: boolean }) {
  const colorClass: Record<string, string> = {
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500',
  };

  return <span className={cn('h-1.5 w-1.5 rounded-full', pending ? 'bg-slate-300' : colorClass[color])} />;
}

function SoftIcon({ icon: Icon, color }: { icon: React.ElementType; color: string; pending?: boolean }) {
  const colorClass: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', colorClass[color])}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

function SoftTitle({ children, color }: { children: ReactNode; color: string; pending?: boolean }) {
  const colorClass: Record<string, string> = {
    violet: 'text-violet-700',
    emerald: 'text-emerald-700',
    orange: 'text-orange-700',
    blue: 'text-blue-700',
    rose: 'text-rose-700',
    purple: 'text-purple-700',
  };

  return <span className={cn('text-sm font-semibold', colorClass[color])}>{children}</span>;
}

function OverviewPanel({
  title,
  desc,
  children,
  onOpen,
}: {
  title: string;
  desc: string;
  children: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{desc}</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          aria-label={onOpen ? `打开${title}` : title}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function MetricColumn({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0 border-slate-200 md:border-l md:pl-6">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4 min-h-16 text-sm text-slate-600">{children}</div>
    </div>
  );
}

function PendingButton({ children }: { children: ReactNode }) {
  return (
    <Button variant="outline" size="sm" className="h-8 rounded-lg bg-slate-50 text-slate-400" disabled>
      {children}
      <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">待接入</span>
    </Button>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { selectedChildId: globalSelectedChildId, selectChild } = useSelectedChild();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [childDetailOpenId, setChildDetailOpenId] = useState<number | null>(null);
  const [childAddRequest, setChildAddRequest] = useState(0);
  const [dingtalkDialogOpen, setDingtalkDialogOpen] = useState(false);
  const [learningDialogOpen, setLearningDialogOpen] = useState(false);
  const [dingtalkWebhookUrl, setDingtalkWebhookUrl] = useState('');
  const [dingtalkSecret, setDingtalkSecret] = useState('');
  const [semesterForm, setSemesterForm] = useState<SemesterConfig>(getDefaultSemesterConfig);

  const { data: user, isLoading: isUserLoading, isError: isUserError } = useQuery({ queryKey: ['settings-user-info'], queryFn: getUserInfo });
  const { data: family, isLoading: isFamilyLoading, isError: isFamilyError } = useQuery({ queryKey: ['settings-family'], queryFn: getFamilySettings });
  const { data: children = [], isLoading: isChildrenLoading, isError: isChildrenError } = useQuery({ queryKey: ['children'], queryFn: getChildren });

  const currentChild = children.find((child) => child.id === (selectedChildId ?? globalSelectedChildId)) || children[0];

  const { data: childStats } = useQuery({
    queryKey: ['settings-child-stats', currentChild?.id],
    queryFn: () => getChildStats(currentChild!.id),
    enabled: Boolean(currentChild?.id),
  });

  const { data: dingtalkConfig } = useQuery({
    queryKey: ['settings-child-dingtalk', currentChild?.id],
    queryFn: () => getChildDingTalkConfig(currentChild!.id),
    enabled: Boolean(currentChild?.id),
  });

  const { data: semesterConfig } = useQuery({
    queryKey: ['settings-child-semester', currentChild?.id],
    queryFn: () => getChildSemesterConfig(currentChild!.id),
    enabled: Boolean(currentChild?.id),
  });

  const avatarMutation = useMutation({
    mutationFn: updateAvatar,
    onSuccess: (data, nextAvatar) => {
      if (data?.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('parent_token', data.token);
      }
      const storedUser = localStorage.getItem('auth_user') || localStorage.getItem('parent_user');
      if (storedUser) {
        try {
          const nextUser = { ...JSON.parse(storedUser), avatar: nextAvatar };
          localStorage.setItem('auth_user', JSON.stringify(nextUser));
          localStorage.setItem('parent_user', JSON.stringify(nextUser));
          window.dispatchEvent(new Event('auth:updated'));
          window.dispatchEvent(new Event('parent-auth:updated'));
        } catch {
          // Local storage sync is best-effort only.
        }
      }
      queryClient.invalidateQueries({ queryKey: ['settings-user-info'] });
      toast.success('头像已更新');
    },
    onError: (error) => showCopyableError(`更新失败：${getErrorMessage(error)}`),
  });

  const uploadProfileAvatarMutation = useMutation({
    mutationFn: uploadAvatarFile,
    onSuccess: (avatarUrl) => {
      setProfileAvatar(avatarUrl);
      toast.success('头像上传成功，请保存');
    },
    onError: (error) => showCopyableError(`上传失败：${getErrorMessage(error)}`),
  });

  const displayNameMutation = useMutation({
    mutationFn: ({ name, password }: { name: string; password: string }) => updateDisplayName(name, password),
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('parent_token', data.token);
      }
      const storedUser = localStorage.getItem('auth_user') || localStorage.getItem('parent_user');
      if (storedUser) {
        try {
          const nextUser = { ...JSON.parse(storedUser), name: data.name };
          localStorage.setItem('auth_user', JSON.stringify(nextUser));
          localStorage.setItem('parent_user', JSON.stringify(nextUser));
          window.dispatchEvent(new Event('auth:updated'));
          window.dispatchEvent(new Event('parent-auth:updated'));
        } catch {
          // Local storage sync is best-effort only.
        }
      }
      queryClient.invalidateQueries({ queryKey: ['settings-user-info'] });
      setProfileDialogOpen(false);
      setProfilePassword('');
      toast.success('显示名称已更新');
    },
    onError: (error) => toast.error(`保存失败：${getErrorMessage(error)}`),
  });

  const saveDingTalkMutation = useMutation({
    mutationFn: ({ childId, data }: { childId: number; data: { webhookUrl: string; secret?: string } }) => updateChildDingTalkConfig(childId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-child-dingtalk', currentChild?.id] });
      setDingtalkDialogOpen(false);
      toast.success('钉钉配置已保存');
    },
    onError: (error) => toast.error(`保存失败：${getErrorMessage(error)}`),
  });

  const saveSemesterMutation = useMutation({
    mutationFn: ({ childId, data }: { childId: number; data: SemesterConfig }) => updateChildSemesterConfig(childId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-child-semester', currentChild?.id] });
      setLearningDialogOpen(false);
      toast.success('学习设置已保存');
    },
    onError: (error) => toast.error(`保存失败：${getErrorMessage(error)}`),
  });

  const securityScore = useMemo(() => {
    let score = 40;
    if (user?.avatar) score += 20;
    if (user?.name) score += 20;
    if (children.length > 0) score += 10;
    if (family?.familyCode) score += 10;
    return Math.min(score, 100);
  }, [children.length, family?.familyCode, user?.avatar, user?.name]);

  const userInitial = getInitial(user?.name);
  const isLoading = isUserLoading || isFamilyLoading || isChildrenLoading;
  const hasLoadError = isUserError || isFamilyError || isChildrenError;
  const detailMode = location.pathname.includes('/account-detail')
    ? 'account'
    : location.pathname.includes('/family-detail')
      ? 'family'
      : location.pathname.includes('/children-detail')
        ? 'children'
        : null;

  useEffect(() => {
    if (globalSelectedChildId && children.some((child) => child.id === globalSelectedChildId)) {
      setSelectedChildId(globalSelectedChildId);
      return;
    }
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, globalSelectedChildId, selectedChildId]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileAvatar(user.avatar || '');
    }
  }, [user]);

  useEffect(() => {
    if (dingtalkDialogOpen) {
      setDingtalkWebhookUrl(dingtalkConfig?.webhookUrl || '');
      setDingtalkSecret(dingtalkConfig?.secret || '');
    }
  }, [dingtalkConfig, dingtalkDialogOpen]);

  useEffect(() => {
    if (learningDialogOpen) {
      setSemesterForm({ ...getDefaultSemesterConfig(), ...(semesterConfig || {}) });
    }
  }, [learningDialogOpen, semesterConfig]);

  const handleProfileAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
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

    uploadProfileAvatarMutation.mutate(file);
    event.target.value = '';
  };

  const openProfileDialog = () => {
    setProfileName(user?.name || '');
    setProfileAvatar(user?.avatar || '');
    setProfilePassword('');
    setProfileDialogOpen(true);
  };

  const submitProfile = () => {
    if (!profileName.trim()) {
      toast.error('请输入显示名称');
      return;
    }
    if (profileName.trim().length < 2 || profileName.trim().length > 20) {
      toast.error('显示名称长度应在 2-20 个字符之间');
      return;
    }
    if (profileName.trim() !== user?.name) {
      if (!profilePassword) {
        toast.error('修改显示名称需要输入当前密码');
        return;
      }
    }
    if (profileAvatar !== (user?.avatar || '')) {
      avatarMutation.mutate(profileAvatar || '👤');
    }
    if (profileName.trim() !== user?.name) {
      displayNameMutation.mutate({ name: profileName.trim(), password: profilePassword });
      return;
    }
    setProfileDialogOpen(false);
  };

  const openDingTalkDialog = () => {
    if (!currentChild) {
      toast.error('请先添加孩子');
      return;
    }
    setDingtalkDialogOpen(true);
  };

  const submitDingTalk = () => {
    if (!currentChild) return;
    if (!dingtalkWebhookUrl.trim()) {
      toast.error('请输入钉钉 Webhook 地址');
      return;
    }
    saveDingTalkMutation.mutate({
      childId: currentChild.id,
      data: {
        webhookUrl: dingtalkWebhookUrl.trim(),
        secret: dingtalkSecret.trim(),
      },
    });
  };

  const openLearningDialog = () => {
    if (!currentChild) {
      toast.error('请先添加孩子');
      return;
    }
    setLearningDialogOpen(true);
  };

  const openChildDetailDialog = () => {
    if (!currentChild) {
      toast.error('请先添加孩子');
      return;
    }
    setChildDetailOpenId(currentChild.id);
  };

  const openAddChildDialog = () => {
    setChildAddRequest((value) => value + 1);
  };

  const submitLearningSettings = () => {
    if (!currentChild) return;
    if (!semesterForm.schoolYear.trim() || !semesterForm.grade.trim() || !semesterForm.readingStage.trim()) {
      toast.error('请完整填写学年、年级和阅读阶段');
      return;
    }
    if (!semesterForm.startDate || !semesterForm.endDate) {
      toast.error('请填写开始日期和结束日期');
      return;
    }
    if (new Date(semesterForm.startDate) > new Date(semesterForm.endDate)) {
      toast.error('开始日期不能晚于结束日期');
      return;
    }
    saveSemesterMutation.mutate({ childId: currentChild.id, data: semesterForm });
  };

  const copyFamilyCode = async () => {
    if (!family?.familyCode) {
      toast.error('暂无可复制的家庭码');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(family.familyCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = family.familyCode;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) throw new Error('copy failed');
      }
      toast.success('家庭码已复制');
    } catch {
      toast.error('复制失败，请手动复制家庭码');
    }
  };

  const handleDomainClick = (path: string | undefined, status: SettingStatus) => {
    if (path) {
      navigate(path);
      return;
    }
    toast.info(`${status}，后续开发完成后会接入`);
  };

  const handleQuickAction = (action: string, status: SettingStatus) => {
    if (status === '待接入') {
      toast.info('该功能待接入，后续开发完成后会开放');
      return;
    }
    if (action === 'account') navigate('/parent/settings/account-detail');
    if (action === 'children') openAddChildDialog();
    if (action === 'family') navigate('/parent/settings/family-detail');
    if (action === 'help') navigate('/parent/help');
  };

  if (detailMode) {
    const detailTitle = detailMode === 'account' ? '账户信息' : detailMode === 'family' ? '家庭设置' : '孩子管理';
    const DetailComponent = detailMode === 'account' ? AccountSettings : detailMode === 'family' ? FamilySettings : ChildrenManagement;

    return (
      <div className="mx-auto max-w-[1360px] space-y-5">
        <PageToolbar
          left={
            <PageToolbarTitle
              icon={Settings}
              title={detailTitle}
              description="从设置总览进入的详细配置页面"
            />
          }
          right={
            <Button variant="outline" className="h-11 rounded-xl bg-white" onClick={() => navigate('/parent/settings/account')}>
              返回总览
            </Button>
          }
        />
        <DetailComponent />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1360px] space-y-5 pt-1 text-slate-950">
      {isLoading ? <div className="text-sm text-slate-500">加载中...</div> : null}

      {hasLoadError ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          设置数据加载不完整，请刷新页面或重新登录后再试。
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {settingDomains.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => handleDomainClick(item.path, item.status)}
              className={cn(
                'group flex min-h-[250px] flex-col rounded-xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                item.status === '待接入' ? 'border-slate-200 opacity-80' : 'border-slate-200'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <DomainIcon icon={Icon} color={item.color} />
                <StatusPill status={item.status} />
              </div>
              <DomainTitle color={item.color}>{item.title}</DomainTitle>
              <p className="mt-2 min-h-11 text-sm leading-6 text-slate-500">{item.desc}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {item.items.map((entry) => (
                  <li key={entry} className="flex items-center gap-2">
                    <DomainBullet color={item.color} pending={entry.includes('待接入')} />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between pt-6">
                <span className={cn('text-lg', item.status === '待接入' ? 'text-slate-300' : 'text-indigo-600')}>→</span>
                <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
              </div>
            </button>
          );
        })}
      </div>

      <OverviewPanel title="账户概览" desc="快速查看您的账户状态和安全信息" onOpen={() => navigate('/parent/settings/account-detail')}>
        <div className="grid gap-6 md:grid-cols-[240px_1fr_1fr_1fr_1fr]">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 bg-indigo-50 text-2xl shadow-sm">
              {isImageAvatar(user?.avatar) ? <AvatarImage src={user?.avatar} /> : null}
              <AvatarFallback className="bg-indigo-100 text-2xl font-bold text-indigo-700">
                {isImageAvatar(user?.avatar) ? userInitial : user?.avatar || userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-bold text-slate-950">{user?.name || '家长'}</p>
                <span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">家长</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">显示名称：{user?.name || '未设置'}</p>
              <Button variant="outline" size="sm" className="mt-4 h-8 rounded-lg bg-slate-50" onClick={openProfileDialog}>
                编辑资料
              </Button>
            </div>
          </div>

          <MetricColumn title="安全评分">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 rounded-full bg-emerald-50 p-1.5 text-emerald-600" />
              <div>
                <p className="text-3xl font-bold text-slate-950">{securityScore}<span className="text-base text-slate-400"> 分</span></p>
                <div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-emerald-50">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${securityScore}%` }} />
                </div>
              </div>
            </div>
          </MetricColumn>

          <MetricColumn title="已绑定">
            <div className="space-y-3">
              <p className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-slate-400" /> 待接入：手机号</p>
              <p className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-emerald-500" /> 密码已设置</p>
            </div>
          </MetricColumn>

          <MetricColumn title="登录设备" action={<PendingButton>管理设备</PendingButton>}>
            <p className="flex items-center gap-2"><Monitor className="h-4 w-4 text-slate-400" /> 待接入设备管理</p>
          </MetricColumn>

          <MetricColumn title="最近登录" action={<PendingButton>查看全部记录</PendingButton>}>
            <p className="font-semibold text-slate-700">待接入</p>
            <p className="mt-1 text-xs text-slate-400">登录时间与设备记录后续接入</p>
          </MetricColumn>
        </div>
      </OverviewPanel>

      <OverviewPanel title="家庭概览" desc="快速查看您的家庭信息和成员状态" onOpen={() => navigate('/parent/settings/family-detail')}>
        <div className="grid gap-6 md:grid-cols-[260px_1fr_1fr_1fr]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Home className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="max-w-[150px] truncate text-base font-bold text-slate-950">{family?.familyName || '当前家庭'}</p>
                <StatusPill status="已接入" />
              </div>
              <p className="mt-1 text-sm text-slate-500">家庭成员：{family?.memberCount || children.length + 1} 人</p>
            </div>
          </div>

          <MetricColumn title="家庭码" action={<Button variant="outline" size="sm" className="h-8 rounded-lg bg-violet-50 text-violet-700" onClick={copyFamilyCode}>复制</Button>}>
            <p className="font-mono text-lg font-bold tracking-wider text-slate-950">{family?.familyCode || '------'}</p>
            <p className="mt-1 text-xs text-slate-400">用于邀请家人加入当前家庭</p>
          </MetricColumn>

          <MetricColumn title="家庭成员" action={<Button variant="outline" size="sm" className="h-8 rounded-lg bg-violet-50 text-violet-700" onClick={() => navigate('/parent/settings/family-detail')}>管理成员</Button>}>
            <div className="flex gap-2">
              <Avatar className="h-8 w-8 border-2 border-white bg-violet-100">
                {isImageAvatar(user?.avatar) ? <AvatarImage src={user?.avatar} /> : null}
                <AvatarFallback>{isImageAvatar(user?.avatar) ? userInitial : user?.avatar || userInitial}</AvatarFallback>
              </Avatar>
              {children.slice(0, 3).map((child) => (
                <Avatar key={child.id} className="h-8 w-8 border-2 border-white bg-indigo-100">
                  {isImageAvatar(child.avatar) ? <AvatarImage src={child.avatar} /> : null}
                  <AvatarFallback>{isImageAvatar(child.avatar) ? getInitial(child.name) : child.avatar || getInitial(child.name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-500">{children.length + 1} 位成员</p>
          </MetricColumn>

          <MetricColumn title="权限设置" action={<PendingButton>管理权限</PendingButton>}>
            <div className="space-y-2">
              <p className="flex justify-between"><span>管理员</span><span>1 人</span></p>
              <p className="flex justify-between"><span>孩子</span><span>{children.length} 人</span></p>
              <p className="flex justify-between"><span>只读成员</span><span>待接入</span></p>
            </div>
          </MetricColumn>
        </div>
      </OverviewPanel>

      <OverviewPanel title="孩子概览" desc="快速查看孩子的学习状态" onOpen={openChildDetailDialog}>
        <div className="grid gap-6 md:grid-cols-[260px_1fr_1fr_1fr]">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 bg-indigo-50 text-2xl shadow-sm">
              {isImageAvatar(currentChild?.avatar) ? <AvatarImage src={currentChild?.avatar} /> : null}
              <AvatarFallback className="bg-indigo-100 text-2xl font-bold text-indigo-700">
                {isImageAvatar(currentChild?.avatar) ? getInitial(currentChild?.name) : currentChild?.avatar || '孩'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="min-w-0 truncate text-lg font-bold text-slate-950">{currentChild?.name || '暂无孩子'}</p>
                {children.length > 1 ? (
                  <button
                    type="button"
                    className="mt-0.5 flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-500 shadow-sm hover:bg-violet-50 hover:text-violet-700"
                    onClick={() => {
                      const index = children.findIndex((child) => child.id === currentChild?.id);
                      const next = children[(index + 1) % children.length];
                      if (next) {
                        setSelectedChildId(next.id);
                        selectChild(next.id);
                      }
                    }}
                    aria-label="切换孩子"
                  >
                    切换
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">当前学期：{semesterConfig?.schoolYear || '待配置'}</p>
              <p className="mt-1 text-sm text-slate-500">年级：{semesterConfig?.grade || currentChild?.grade || '待配置'}</p>
              <Button variant="outline" size="sm" className="mt-4 h-8 rounded-lg bg-slate-50" onClick={openChildDetailDialog}>
                查看详情
              </Button>
            </div>
          </div>

          <MetricColumn title="学习状态" action={<Button variant="outline" size="sm" className="h-8 rounded-lg bg-violet-50 text-violet-700" onClick={() => navigate('/parent')}>查看学习概览</Button>}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">学习时长</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{childStats?.weeklyStudyTime || 0}<span className="ml-1 text-sm text-slate-400">分钟</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-400">本周完成任务</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{childStats?.completedTasks || 0}<span className="ml-1 text-sm text-slate-400">个</span></p>
              </div>
            </div>
          </MetricColumn>

          <MetricColumn title="推送状态" action={<Button variant="outline" size="sm" className="h-8 rounded-lg bg-violet-50 text-violet-700" onClick={openDingTalkDialog}>管理推送</Button>}>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span>钉钉推送</span>
                <Switch checked={Boolean(dingtalkConfig?.webhookUrl)} onCheckedChange={openDingTalkDialog} />
              </div>
              <p className="flex items-center justify-between gap-3"><span>推送频率</span><span>{dingtalkConfig?.webhookUrl ? '每日' : '关闭'}</span></p>
              <p className="flex items-center justify-between gap-3"><span>推送时间</span><span>{dingtalkConfig?.webhookUrl ? '18:30' : '关闭'}</span></p>
            </div>
          </MetricColumn>

          <MetricColumn title="学习设置" action={<Button variant="outline" size="sm" className="h-8 rounded-lg bg-violet-50 text-violet-700" onClick={openLearningDialog}>管理学习设置</Button>}>
            <div className="space-y-2">
              <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-slate-400" /> 阅读阶段</span><span>{semesterConfig?.readingStage || '待配置'}</span></p>
              <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-slate-400" /> 能力级别</span><span>待接入</span></p>
              <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" /> 开始日期</span><span>{semesterConfig?.startDate || '待配置'}</span></p>
            </div>
          </MetricColumn>
        </div>
      </OverviewPanel>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-950">快捷操作</h2>
          <p className="mt-1 text-sm text-slate-500">常用功能快速入口</p>
        </div>
        <div className="grid gap-3 px-5 py-5 md:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => handleQuickAction(item.action, item.status)}
                className={cn(
                  'flex min-h-20 items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50',
                  item.status === '待接入' && 'text-slate-400'
                )}
              >
                <SoftIcon icon={Icon} color={item.color} pending={item.status === '待接入'} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <SoftTitle color={item.color} pending={item.status === '待接入'}>{item.title}</SoftTitle>
                    {item.status === '待接入' ? <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">待接入</span> : null}
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">{item.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <ChildrenManagement
        dialogOnly
        openChildId={childDetailOpenId}
        openAddRequest={childAddRequest}
        onOpenChildHandled={() => setChildDetailOpenId(null)}
      />

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SquarePen className="h-5 w-5 text-violet-600" />
              编辑资料
            </DialogTitle>
            <DialogDescription>修改头像和显示名称。修改显示名称需要输入当前密码确认。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Avatar className="h-16 w-16 bg-indigo-50 text-2xl shadow-sm">
                {isImageAvatar(profileAvatar) ? <AvatarImage src={profileAvatar} /> : null}
                <AvatarFallback className="bg-indigo-100 text-2xl font-bold text-indigo-700">
                  {isImageAvatar(profileAvatar) ? getInitial(profileName) : profileAvatar || getInitial(profileName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">头像</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="relative h-8 overflow-hidden rounded-lg bg-white" disabled={uploadProfileAvatarMutation.isPending}>
                    {uploadProfileAvatarMutation.isPending ? '上传中...' : '上传头像'}
                    <input className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileAvatarUpload} disabled={uploadProfileAvatarMutation.isPending} />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg" onClick={() => setProfileAvatar('👤')}>
                    恢复默认
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-profile-name">显示名称</Label>
              <Input id="settings-profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={20} placeholder="请输入显示名称" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-profile-password">当前密码</Label>
              <Input id="settings-profile-password" type="password" value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} placeholder="修改显示名称时需要填写" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>取消</Button>
            <Button onClick={submitProfile} disabled={avatarMutation.isPending || displayNameMutation.isPending || uploadProfileAvatarMutation.isPending}>
              {avatarMutation.isPending || displayNameMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dingtalkDialogOpen} onOpenChange={setDingtalkDialogOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>钉钉推送配置</DialogTitle>
            <DialogDescription>{currentChild?.name || '当前孩子'} 的钉钉机器人配置。保存后推送状态会自动更新。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="settings-dingtalk-webhook">Webhook 地址</Label>
              <Input id="settings-dingtalk-webhook" value={dingtalkWebhookUrl} onChange={(event) => setDingtalkWebhookUrl(event.target.value)} placeholder="请输入钉钉机器人 Webhook 地址" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-dingtalk-secret">加签 Secret</Label>
              <Input id="settings-dingtalk-secret" value={dingtalkSecret} onChange={(event) => setDingtalkSecret(event.target.value)} placeholder="可选，若机器人开启加签请填写" />
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
              推送频率和推送时间目前使用默认口径，后续会独立接入可配置项。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDingtalkDialogOpen(false)}>取消</Button>
            <Button onClick={submitDingTalk} disabled={saveDingTalkMutation.isPending}>
              {saveDingTalkMutation.isPending ? '保存中...' : '保存配置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={learningDialogOpen} onOpenChange={setLearningDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>学习设置</DialogTitle>
            <DialogDescription>配置 {currentChild?.name || '当前孩子'} 的学期、年级和阅读阶段。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="settings-semester-year">学年</Label>
              <Input id="settings-semester-year" value={semesterForm.schoolYear} onChange={(event) => setSemesterForm({ ...semesterForm, schoolYear: event.target.value })} placeholder="例如 2025-2026" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-semester-term">学期</Label>
              <select
                id="settings-semester-term"
                value={semesterForm.term}
                onChange={(event) => setSemesterForm({ ...semesterForm, term: event.target.value as SemesterConfig['term'] })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="first">上学期</option>
                <option value="second">下学期</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-semester-grade">年级</Label>
              <select
                id="settings-semester-grade"
                value={semesterForm.grade}
                onChange={(event) => setSemesterForm({ ...semesterForm, grade: event.target.value, readingStage: event.target.value })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-reading-stage">阅读阶段</Label>
              <select
                id="settings-reading-stage"
                value={semesterForm.readingStage || semesterForm.grade}
                onChange={(event) => setSemesterForm({ ...semesterForm, grade: event.target.value, readingStage: event.target.value })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-semester-start">开始日期</Label>
              <Input id="settings-semester-start" type="date" value={semesterForm.startDate} onChange={(event) => setSemesterForm({ ...semesterForm, startDate: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-semester-end">结束日期</Label>
              <Input id="settings-semester-end" type="date" value={semesterForm.endDate} onChange={(event) => setSemesterForm({ ...semesterForm, endDate: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLearningDialogOpen(false)}>取消</Button>
            <Button onClick={submitLearningSettings} disabled={saveSemesterMutation.isPending}>
              {saveSemesterMutation.isPending ? '保存中...' : '保存学习设置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
