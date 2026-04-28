import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  Award,
  BookOpen,
  Clock,
  Bell,
  ChevronRight,
  X,
  Download,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { showCopyableError } from '@/lib/error-toast';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { Separator } from '@/components/ui/separator';

interface Child {
  id: number;
  name: string;
  avatar: string;
  role: string;
}

interface ChildStats {
  weeklyStudyTime: number;
  completedTasks: number;
  achievements: number;
  booksRead: number;
  weeklyProgress: number;
  dailyMinutes?: number;
}

interface DingTalkConfig {
  childId: number;
  childName: string;
  webhookUrl: string;
  secret: string;
}

interface SemesterConfig {
  schoolYear: string;
  term: 'first' | 'second';
  grade: string;
  startDate: string;
  endDate: string;
  readingStage: string;
}

type ChildDetailTab = 'overview' | 'basic' | 'learning' | 'interests' | 'push' | 'data' | 'security';

type LocalChildSettings = {
  gender: 'male' | 'female' | 'unset';
  className: string;
  customTags: string[];
  interestTags: string[];
  defaultAbilityLevel: string;
  defaultLearningGoal: string;
  pushEnabled: boolean;
  pushFrequency: string;
  pushTime: string;
  pushContents: string[];
};

const gradeOptions = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三'];
const readingStageSuggestions = ['幼儿园小班', '幼儿园中班', '幼儿园大班', '一年级上', '一年级寒假', '一年级下', '一年级暑假', '二年级上'];
const defaultInterestTags = ['科普百科', '历史文化', '文学阅读', '科学探索', '艺术创作'];
const pushContentOptions = ['学习日报', '任务提醒', '阅读提醒', '成就提醒'];

function getDefaultLocalChildSettings(): LocalChildSettings {
  return {
    gender: 'unset',
    className: '',
    customTags: ['专注力提升', '阅读习惯'],
    interestTags: defaultInterestTags,
    defaultAbilityLevel: 'L3（中级）',
    defaultLearningGoal: '提升阅读理解能力',
    pushEnabled: false,
    pushFrequency: '每日一次',
    pushTime: '18:30',
    pushContents: ['学习日报', '任务提醒', '阅读提醒'],
  };
}

function getDefaultSemesterConfig(): SemesterConfig {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const isSecondTerm = month >= 2 && month <= 7;

  if (isSecondTerm) {
    return {
      schoolYear: `${year - 1}-${year}`,
      term: 'second',
      grade: '一年级',
      startDate: `${year}-02-17`,
      endDate: `${year}-07-05`,
      readingStage: '一年级下',
    };
  }

  return {
    schoolYear: `${year}-${year + 1}`,
    term: 'first',
    grade: '一年级',
    startDate: `${year}-09-01`,
    endDate: `${year + 1}-01-20`,
    readingStage: '一年级上',
  };
}

function isImageAvatar(value?: string) {
  if (!value) return false;
  return value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
}

function ChildAvatarDisplay({
  avatar,
  name,
  size = 'md',
}: {
  avatar?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-12 w-12 text-xl',
    md: 'h-16 w-16 text-2xl',
    lg: 'h-20 w-20 text-3xl',
  };

  const fallbackText = avatar && !isImageAvatar(avatar) ? avatar : (name.charAt(0) || '孩');

  return (
    <div className={cn(
      'flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 font-semibold ring-1 ring-slate-200',
      sizeClasses[size]
    )}>
      {isImageAvatar(avatar) ? (
        <Avatar className={cn('h-full w-full', sizeClasses[size])}>
          <AvatarImage src={avatar} />
          <AvatarFallback className="bg-transparent text-inherit font-semibold">
            {fallbackText}
          </AvatarFallback>
        </Avatar>
      ) : (
        <span>{fallbackText}</span>
      )}
    </div>
  );
}

async function getChildren(): Promise<Child[]> {
  const response = await apiClient.get('/children');
  return response.data.data || [];
}

async function getChildStats(childId: number): Promise<any> {
  const response = await apiClient.get(`/children/${childId}/stats`);
  return response.data;
}

async function getChildDingTalkConfig(childId: number): Promise<any> {
  const response = await apiClient.get(`/children/${childId}/dingtalk-config`);
  return response.data;
}

async function getChildSemesterConfig(childId: number): Promise<any> {
  const response = await apiClient.get(`/children/${childId}/semester`);
  return response.data;
}

async function getChildProfile(childId: number): Promise<any> {
  const response = await apiClient.get(`/children/${childId}/profile`);
  return response.data;
}

async function createChild(data: { name: string; avatar: string }): Promise<any> {
  const response = await apiClient.post('/add-child', data);
  return response.data;
}

async function updateChild(childId: number, data: { name: string; avatar: string }): Promise<void> {
  await apiClient.put(`/children/${childId}`, data);
}

async function deleteChild(childId: number): Promise<void> {
  await apiClient.delete(`/children/${childId}`);
}

async function updateChildDingTalkConfig(childId: number, data: { webhookUrl: string; secret?: string }): Promise<any> {
  const response = await apiClient.put(`/children/${childId}/dingtalk-config`, data);
  return response.data;
}

async function updateChildSemesterConfig(childId: number, data: SemesterConfig): Promise<any> {
  const response = await apiClient.put(`/children/${childId}/semester`, data);
  return response.data;
}

async function updateChildProfile(childId: number, data: LocalChildSettings): Promise<any> {
  const response = await apiClient.put(`/children/${childId}/profile`, data);
  return response.data;
}

async function testChildDingTalkConfig(childId: number): Promise<any> {
  const response = await apiClient.post('/settings/test-webhook', { childId });
  return response.data;
}

type ChildrenManagementProps = {
  dialogOnly?: boolean;
  openChildId?: number | null;
  onOpenChildHandled?: () => void;
};

export default function ChildrenManagement({
  dialogOnly = false,
  openChildId = null,
  onOpenChildHandled,
}: ChildrenManagementProps = {}) {
  const queryClient = useQueryClient();
  const { refreshChildren } = useSelectedChild();
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState<ChildDetailTab>('overview');

  // Form states
  const [childName, setChildName] = useState('');
  const [childAvatar, setChildAvatar] = useState('🐶');
  const [dingtalkWebhookUrl, setDingtalkWebhookUrl] = useState('');
  const [dingtalkSecret, setDingtalkSecret] = useState('');
  const [semesterConfig, setSemesterConfig] = useState<SemesterConfig>(getDefaultSemesterConfig);
  const [localSettings, setLocalSettings] = useState<LocalChildSettings>(getDefaultLocalChildSettings);
  const [newCustomTag, setNewCustomTag] = useState('');
  const [newInterestTag, setNewInterestTag] = useState('');
  const [isSavingBasicInfo, setIsSavingBasicInfo] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);

  const { data: children = [], refetch, isLoading: isChildrenLoading, isError: isChildrenError } = useQuery({
    queryKey: ['children'],
    queryFn: getChildren,
  });

  const { data: statsData } = useQuery({
    queryKey: ['child-stats', selectedChild?.id],
    queryFn: () => getChildStats(selectedChild!.id),
    enabled: !!selectedChild,
  });

  const { data: dingtalkConfigData, refetch: refetchDingTalkConfig } = useQuery({
    queryKey: ['child-dingtalk-config', selectedChild?.id],
    queryFn: () => getChildDingTalkConfig(selectedChild!.id),
    enabled: !!selectedChild,
  });

  const { data: semesterConfigData, refetch: refetchSemesterConfig } = useQuery({
    queryKey: ['child-semester-config', selectedChild?.id],
    queryFn: () => getChildSemesterConfig(selectedChild!.id),
    enabled: !!selectedChild,
  });

  const { data: childProfileData, refetch: refetchChildProfile } = useQuery({
    queryKey: ['child-profile', selectedChild?.id],
    queryFn: () => getChildProfile(selectedChild!.id),
    enabled: !!selectedChild,
  });

  const createMutation = useMutation({
    mutationFn: createChild,
    onSuccess: async () => {
      toast.success('孩子添加成功');
      setIsAddDialogOpen(false);
      resetForm();
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['settings-family'] });
      refreshChildren();
    },
    onError: (error) => showCopyableError(`添加失败：${getErrorMessage(error)}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ childId, data }: { childId: number; data: { name: string; avatar: string } }) =>
      updateChild(childId, data),
    onSuccess: async () => {
      toast.success('信息已更新');
      if (selectedChild) {
        setSelectedChild({ ...selectedChild, name: childName.trim(), avatar: childAvatar });
      }
      setIsEditDialogOpen(false);
      await refetch();
      refreshChildren();
    },
    onError: (error) => showCopyableError(`更新失败：${getErrorMessage(error)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChild,
    onSuccess: async () => {
      toast.success('孩子已删除');
      setIsDeleteDialogOpen(false);
      setIsDetailOpen(false);
      setSelectedChild(null);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['settings-family'] });
      refreshChildren();
    },
    onError: (error) => showCopyableError(`删除失败：${getErrorMessage(error)}`),
  });

  const saveDingTalkMutation = useMutation({
    mutationFn: ({ childId, data }: { childId: number; data: { webhookUrl: string; secret?: string } }) =>
      updateChildDingTalkConfig(childId, data),
    onSuccess: () => {
      toast.success('钉钉配置已保存');
      refetchDingTalkConfig();
    },
    onError: (error) => {
      toast.error(`保存失败：${getErrorMessage(error)}`);
    },
  });

  const testDingTalkMutation = useMutation({
    mutationFn: (childId: number) => testChildDingTalkConfig(childId),
    onSuccess: () => {
      toast.success('测试消息已发送到钉钉');
    },
    onError: (error) => {
      toast.error(`测试失败：${getErrorMessage(error)}`);
    },
  });

  const saveSemesterMutation = useMutation({
    mutationFn: ({ childId, data }: { childId: number; data: SemesterConfig }) =>
      updateChildSemesterConfig(childId, data),
    onSuccess: () => {
      toast.success('学期配置已保存');
      refetchSemesterConfig();
    },
    onError: (error) => {
      toast.error(`保存失败：${getErrorMessage(error)}`);
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: ({ childId, data }: { childId: number; data: LocalChildSettings }) =>
      updateChildProfile(childId, data),
    onSuccess: () => {
      toast.success('孩子档案已保存');
      refetchChildProfile();
      queryClient.invalidateQueries({ queryKey: ['settings-family'] });
    },
    onError: (error) => {
      toast.error(`保存失败：${getErrorMessage(error)}`);
    },
  });

  const resetForm = () => {
    setChildName('');
    setChildAvatar('🐶');
  };

  const updateLocalSettings = (patch: Partial<LocalChildSettings>) => {
    setLocalSettings((current) => ({ ...current, ...patch }));
  };

  const persistLocalSettings = (settings = localSettings) => {
    if (!selectedChild) return;
    saveProfileMutation.mutate({ childId: selectedChild.id, data: settings });
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('头像图片请控制在 1MB 以内');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);
    apiClient.post('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(async ({ data }) => {
      const uploadedAvatar = data?.data?.url || data?.url;
      if (!uploadedAvatar) {
        toast.error('上传成功，但没有返回头像链接');
        return;
      }
      setChildAvatar(uploadedAvatar);
      if (selectedChild) {
        await updateChild(selectedChild.id, {
          name: childName.trim() || selectedChild.name,
          avatar: uploadedAvatar,
        });
        setSelectedChild({ ...selectedChild, name: childName.trim() || selectedChild.name, avatar: uploadedAvatar });
        await refetch();
        await refreshChildren();
        toast.success('头像已上传并更新');
      } else {
        toast.success('头像上传成功');
      }
    }).catch((error) => {
      showCopyableError(getErrorMessage(error) || '头像上传失败');
    });
  };

  const addCustomTag = () => {
    const tag = newCustomTag.trim();
    if (!tag) return;
    if (localSettings.customTags.includes(tag)) {
      toast.error('标签已存在');
      return;
    }
    updateLocalSettings({ customTags: [...localSettings.customTags, tag] });
    setNewCustomTag('');
  };

  const addInterestTag = () => {
    const tag = newInterestTag.trim();
    if (!tag) return;
    if (localSettings.interestTags.includes(tag)) {
      toast.error('兴趣标签已存在');
      return;
    }
    updateLocalSettings({ interestTags: [...localSettings.interestTags, tag] });
    setNewInterestTag('');
  };

  const handleOpenDetail = (child: Child) => {
    setSelectedChild(child);
    setChildName(child.name);
    setChildAvatar(child.avatar || '🐶');
    setLocalSettings(getDefaultLocalChildSettings());
    setNewCustomTag('');
    setNewInterestTag('');
    setActiveDetailTab('overview');
    setIsDetailOpen(true);
  };

  useEffect(() => {
    if (!openChildId || children.length === 0) return;
    const child = children.find((item) => item.id === openChildId);
    if (!child) return;
    handleOpenDetail(child);
    onOpenChildHandled?.();
  }, [openChildId, children, onOpenChildHandled]);

  const handleOpenAdd = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = () => {
    if (selectedChild) {
      setChildName(selectedChild.name);
      setChildAvatar(selectedChild.avatar || '🐶');
      setIsDetailOpen(false);
      setIsEditDialogOpen(true);
    }
  };

  const handleOpenDelete = () => {
    setDeleteConfirmName('');
    setIsDeleteDialogOpen(true);
  };

  const handleCreate = () => {
    if (!childName.trim()) {
      toast.error('请输入孩子姓名');
      return;
    }
    if (childName.trim().length > 20) {
      toast.error('孩子姓名请控制在 20 个字符以内');
      return;
    }
    createMutation.mutate({
      name: childName.trim(),
      avatar: childAvatar,
    });
  };

  const handleUpdate = () => {
    if (!selectedChild) return;
    if (!childName.trim()) {
      toast.error('请输入孩子姓名');
      return;
    }
    if (childName.trim().length > 20) {
      toast.error('孩子姓名请控制在 20 个字符以内');
      return;
    }
    updateMutation.mutate({
      childId: selectedChild.id,
      data: {
        name: childName.trim(),
        avatar: childAvatar,
      },
    });
    saveProfileMutation.mutate({ childId: selectedChild.id, data: localSettings });
  };

  const handleSaveBasicInfo = async () => {
    if (!selectedChild) return;
    if (!childName.trim()) {
      toast.error('请输入孩子姓名');
      return;
    }
    if (childName.trim().length > 20) {
      toast.error('孩子姓名请控制在 20 个字符以内');
      return;
    }

    setIsSavingBasicInfo(true);
    try {
      await updateChild(selectedChild.id, {
        name: childName.trim(),
        avatar: childAvatar,
      });
      await updateChildProfile(selectedChild.id, localSettings);
      await updateChildSemesterConfig(selectedChild.id, semesterConfig);
      setSelectedChild({ ...selectedChild, name: childName.trim(), avatar: childAvatar });
      await Promise.all([
        refetch(),
        refetchChildProfile(),
        refetchSemesterConfig(),
      ]);
      await refreshChildren();
      toast.success('基本信息已保存');
    } catch (error) {
      showCopyableError(`保存失败：${getErrorMessage(error)}`);
    } finally {
      setIsSavingBasicInfo(false);
    }
  };

  const handleExportData = async () => {
    setIsExportingData(true);
    try {
      const response = await apiClient.get('/settings/export', { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || `quxueban-export-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('数据导出已开始下载');
    } catch (error) {
      toast.error(`导出失败：${getErrorMessage(error)}`);
    } finally {
      setIsExportingData(false);
    }
  };

  const handleDelete = () => {
    if (!selectedChild) return;
    if (deleteConfirmName.trim() !== selectedChild.name) {
      toast.error('请输入孩子姓名后再删除');
      return;
    }
    deleteMutation.mutate(selectedChild.id);
  };

  const handleSaveDingTalkConfig = () => {
    if (!selectedChild) return;
    if (localSettings.pushEnabled && !dingtalkWebhookUrl.trim()) {
      toast.error('请输入钉钉 Webhook 地址');
      return;
    }

    saveProfileMutation.mutate({ childId: selectedChild.id, data: localSettings });

    if (!dingtalkWebhookUrl.trim()) {
      toast.success('推送偏好已保存，钉钉 Webhook 待接入');
      return;
    }

    saveDingTalkMutation.mutate({
      childId: selectedChild.id,
      data: {
        webhookUrl: dingtalkWebhookUrl.trim(),
        secret: dingtalkSecret.trim(),
      },
    });
  };

  const handleSaveSemesterConfig = () => {
    if (!selectedChild) return;
    if (!semesterConfig.schoolYear.trim()) {
      toast.error('请输入学年');
      return;
    }
    if (!semesterConfig.grade.trim()) {
      toast.error('请选择年级');
      return;
    }
    if (!semesterConfig.startDate || !semesterConfig.endDate) {
      toast.error('请填写学期开始和结束日期');
      return;
    }
    if (!semesterConfig.readingStage.trim()) {
      toast.error('请输入当前阅读阶段');
      return;
    }
    if (new Date(semesterConfig.startDate) > new Date(semesterConfig.endDate)) {
      toast.error('开始日期不能晚于结束日期');
      return;
    }

    saveSemesterMutation.mutate({
      childId: selectedChild.id,
      data: semesterConfig,
    });
    saveProfileMutation.mutate({ childId: selectedChild.id, data: localSettings });
  };

  const stats: ChildStats = statsData?.data || {
    weeklyStudyTime: 0,
    completedTasks: 0,
    achievements: 0,
    booksRead: 0,
    weeklyProgress: 0,
    dailyMinutes: 0,
  };
  const weeklyProgressValue = Math.max(0, Math.min(stats.weeklyProgress || 0, 100));
  const donutStyle = {
    background: `conic-gradient(#7c3aed ${weeklyProgressValue * 3.6}deg, #ede9fe 0deg)`,
  };
  const dingtalkConfig: DingTalkConfig | null = dingtalkConfigData?.data || null;
  const savedSemesterConfig: SemesterConfig | null = semesterConfigData?.data || null;
  const savedChildProfile: LocalChildSettings | null = childProfileData?.data || null;
  const detailTabs: Array<{ id: ChildDetailTab; label: string; icon: React.ElementType; danger?: boolean }> = [
    { id: 'overview', label: '学习概览', icon: TrendingUp },
    { id: 'basic', label: '基本信息', icon: Edit2 },
    { id: 'learning', label: '学期与学习', icon: BookOpen },
    { id: 'interests', label: '兴趣与能力', icon: Award },
    { id: 'push', label: '推送设置', icon: Bell },
    { id: 'data', label: '学习数据', icon: Clock },
    { id: 'security', label: '账号与安全', icon: Trash2, danger: true },
  ];

  useEffect(() => {
    if (dingtalkConfig) {
      setDingtalkWebhookUrl(dingtalkConfig.webhookUrl || '');
      setDingtalkSecret(dingtalkConfig.secret || '');
      return;
    }

    if (selectedChild) {
      setDingtalkWebhookUrl('');
      setDingtalkSecret('');
    }
  }, [dingtalkConfig, selectedChild]);

  useEffect(() => {
    if (!selectedChild) return;
    setSemesterConfig({ ...getDefaultSemesterConfig(), ...(savedSemesterConfig || {}) });
  }, [savedSemesterConfig, selectedChild]);

  useEffect(() => {
    if (!selectedChild) return;
    setLocalSettings({ ...getDefaultLocalChildSettings(), ...(savedChildProfile || {}) });
  }, [savedChildProfile, selectedChild]);

  return (
    <div className="space-y-6">
      {!dialogOnly ? (
        <>
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-slate-50/70 via-white to-indigo-50/40 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  孩子管理
                </Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  维护孩子档案、学习概览与钉钉配置
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  在这里统一管理孩子信息、查看最近学习情况，并配置每个孩子独立的钉钉推送。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-border/70 bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs text-muted-foreground">当前孩子数</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{children.length}</p>
                </div>
                <Button onClick={handleOpenAdd} className="rounded-xl px-4 shadow-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  添加孩子
                </Button>
              </div>
            </div>
          </div>

          {/* Children List */}
          {isChildrenError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              孩子列表加载失败，请刷新页面或重新登录后再试。
            </div>
          ) : null}

          {isChildrenLoading ? (
            <div className="rounded-2xl border border-border/70 bg-white p-8 text-center text-sm text-muted-foreground">
              正在加载孩子档案...
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {children.map((child) => (
              <div
                key={child.id}
                onClick={() => handleOpenDetail(child)}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-border/70 bg-white p-4 cursor-pointer transition-all duration-200',
                  'hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md hover:shadow-slate-200/70'
                )}
              >
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-400 via-violet-400 to-sky-400 opacity-70" />
                <div className="flex items-start gap-4">
                  <div className="ml-2">
                    <ChildAvatarDisplay avatar={child.avatar} name={child.name} size="md" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-lg font-semibold text-slate-900">{child.name}</h4>
                      <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600">
                        孩子账户
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      查看学习摘要、阅读情况和钉钉配置
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          学习档案
                        </span>
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                          点击查看详情
                        </span>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!isChildrenLoading && !isChildrenError && children.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 py-14 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                  <Plus className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-base font-medium text-slate-800">还没有添加孩子</p>
                <p className="mt-1 text-sm text-muted-foreground">创建孩子账户后，就能开始记录任务、阅读和成长数据。</p>
                <Button onClick={handleOpenAdd} variant="outline" className="mt-5 rounded-xl">
                  添加第一个孩子
                </Button>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent
          className="flex h-[min(700px,88vh)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-[#fcfcff] p-0 shadow-2xl sm:max-w-none"
          style={{ width: 'min(980px, 96vw)', maxWidth: 'min(980px, 96vw)' }}
        >
          <DialogHeader className="h-[104px] shrink-0 border-b border-border/70 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-5 py-4 pr-12 text-left">
            <div className="flex h-full items-start gap-3 overflow-hidden">
              <div className="h-16 w-16 shrink-0">
                <ChildAvatarDisplay avatar={selectedChild?.avatar} name={selectedChild?.name || '孩子'} size="md" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex h-6 items-center gap-2">
                  <DialogTitle className="truncate text-[22px] leading-none tracking-tight">{selectedChild?.name}</DialogTitle>
                </div>
                <DialogDescription className="mt-1 h-4 truncate text-xs text-muted-foreground">
                  当前学期：{semesterConfig.schoolYear} {semesterConfig.term === 'first' ? '上学期' : '下学期'} · 学习数据更新至 2026-04-13
                </DialogDescription>
                <div className="mt-2 flex h-6 flex-wrap gap-2 overflow-hidden">
                  <Badge variant="secondary" className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs">{semesterConfig.grade}</Badge>
                  <Badge variant="secondary" className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">启用中</Badge>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-[190px_minmax(0,1fr)] overflow-hidden bg-[#fbfbff]">
            <aside className="h-full border-r border-border/70 bg-[#fbfbff] px-3 py-3">
              <div className="grid auto-rows-[44px] gap-1">
                {detailTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeDetailTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveDetailTab(tab.id)}
                      className={cn(
                        'flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors',
                        active && !tab.danger && 'bg-violet-50 text-violet-700',
                        !active && !tab.danger && 'text-slate-600 hover:bg-slate-50',
                        tab.danger && (active ? 'bg-red-50 text-red-600' : 'text-red-500 hover:bg-red-50')
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="h-full overflow-hidden bg-[#fbfbff] px-4 py-3">
              {activeDetailTab === 'overview' && (
                <section className="h-full overflow-y-auto rounded-xl border border-border/70 bg-white p-3 shadow-sm">
                  <div className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-900">学习概览</h3>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard icon={Clock} label="本周学习" value={`${stats.weeklyStudyTime || 0}分钟`} color="blue" />
                    <StatCard icon={Clock} label="今日学习" value={`${stats.dailyMinutes || 0}分钟`} color="purple" />
                    <StatCard icon={TrendingUp} label="完成任务" value={stats.completedTasks || 0} color="green" />
                    <StatCard icon={Award} label="获得成就" value={stats.achievements || 0} color="orange" />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_230px]">
                    <div className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">学习趋势图</h4>
                          <p className="mt-1 text-xs text-slate-500">已接入本周/今日真实汇总；日粒度趋势接口待接入</p>
                        </div>
                        <Badge variant="outline" className="rounded-full border-violet-100 bg-violet-50 text-violet-700">真实汇总</Badge>
                      </div>
                      <div className="mt-4 grid h-32 grid-cols-7 items-end gap-2 rounded-xl bg-slate-50 px-3 pb-3 pt-4">
                        {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => {
                          const isToday = index === Math.min(new Date().getDay() || 7, 7) - 1;
                          const height = isToday ? Math.max(18, Math.min(100, (stats.dailyMinutes || 0) * 2)) : 12;
                          return (
                            <div key={day} className="flex h-full flex-col items-center justify-end gap-2">
                              <div
                                className={cn('w-full rounded-t-xl', isToday ? 'bg-violet-500' : 'bg-slate-200')}
                                style={{ height: `${height}%` }}
                              />
                              <span className={cn('text-xs', isToday ? 'font-semibold text-violet-700' : 'text-slate-400')}>{day}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        当前后端仅返回今日学习时长和本周汇总，其他日期暂不展示占位数据。
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">任务完成环形图</h4>
                        <p className="mt-1 text-xs text-slate-500">按本周完成任务数 / 周目标 20 项计算</p>
                      </div>
                      <div className="mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-full" style={donutStyle}>
                        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                          <span className="text-2xl font-bold text-violet-700">{weeklyProgressValue}%</span>
                          <span className="text-xs text-slate-500">本周进度</span>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
                        <div className="rounded-lg bg-violet-50 p-2 text-violet-700">
                          <p className="text-lg font-semibold">{stats.completedTasks || 0}</p>
                          <p className="text-xs">已完成</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                          <p className="text-lg font-semibold">20</p>
                          <p className="text-xs">周目标</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                </section>
              )}

              {activeDetailTab === 'basic' && (
                <section className="h-full overflow-y-auto rounded-xl border border-border/70 bg-white p-3 shadow-sm">
                  <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">基本信息</h3>
                  <div className="grid gap-4 md:grid-cols-[154px_minmax(0,1fr)]">
                    <div className="rounded-xl bg-violet-50 p-4 text-center">
                      <div className="flex justify-center">
                        <ChildAvatarDisplay avatar={childAvatar} name={childName || '孩子'} size="md" />
                      </div>
                      <div className="mt-3 space-y-2">
                        <Label
                          htmlFor="child-avatar-upload"
                          className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg bg-violet-600 px-3 text-xs font-medium text-white hover:bg-violet-700"
                        >
                          上传头像
                        </Label>
                        <input
                          id="child-avatar-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                        />
                        <Input value={childAvatar} onChange={(e) => setChildAvatar(e.target.value)} placeholder="emoji 或图片链接" className="bg-white" />
                      </div>
                    </div>
                    <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 [&_button[role=combobox]]:h-11 [&_input]:h-11">
                      <div className="space-y-2">
                        <Label>姓名</Label>
                        <Input value={childName} onChange={(e) => setChildName(e.target.value)} className="w-full rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label>性别</Label>
                        <Select value={localSettings.gender} onValueChange={(value) => updateLocalSettings({ gender: value as LocalChildSettings['gender'] })}>
                          <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">未设置</SelectItem>
                            <SelectItem value="male">男孩</SelectItem>
                            <SelectItem value="female">女孩</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>年级</Label>
                        <Select value={semesterConfig.grade} onValueChange={(value) => setSemesterConfig({ ...semesterConfig, grade: value })}>
                          <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>{gradeOptions.map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>班级</Label>
                        <Input value={localSettings.className} onChange={(e) => updateLocalSettings({ className: e.target.value })} placeholder="例如：三年级 2 班" className="w-full rounded-xl" />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-blue-900">自定义标签</h4>
                        <p className="mt-1 text-xs text-blue-700/80">用于家长快速标记孩子特点，后续接入服务端同步。</p>
                      </div>
                      <Badge variant="outline" className="border-blue-200 bg-white text-blue-700">已接入后端</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {localSettings.customTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                          {tag}
                          <button
                            type="button"
                            onClick={() => updateLocalSettings({ customTags: localSettings.customTags.filter((item) => item !== tag) })}
                            className="rounded-full p-0.5 hover:bg-blue-200"
                            aria-label={`删除${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input value={newCustomTag} onChange={(e) => setNewCustomTag(e.target.value)} placeholder="添加蓝色自定义标签" onKeyDown={(event) => { if (event.key === 'Enter') addCustomTag(); }} />
                      <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={addCustomTag}>添加</Button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setActiveDetailTab('overview')}>取消</Button>
                    <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSaveBasicInfo} disabled={isSavingBasicInfo}>{isSavingBasicInfo ? '保存中...' : '保存更改'}</Button>
                  </div>
                  </div>
                </section>
              )}

              {activeDetailTab === 'learning' && (
                <section className="h-full overflow-y-auto rounded-xl border border-border/70 bg-white p-3 shadow-sm">
                  <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">当前学期配置</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2"><Label>学年</Label><Input value={semesterConfig.schoolYear} onChange={(e) => setSemesterConfig({ ...semesterConfig, schoolYear: e.target.value })} /></div>
                    <div className="space-y-2"><Label>学期</Label><Select value={semesterConfig.term} onValueChange={(value) => setSemesterConfig({ ...semesterConfig, term: value as SemesterConfig['term'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="first">上学期</SelectItem><SelectItem value="second">下学期</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>年级</Label><Select value={semesterConfig.grade} onValueChange={(value) => setSemesterConfig({ ...semesterConfig, grade: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{gradeOptions.map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>开始日期</Label><DatePicker value={semesterConfig.startDate} onChange={(startDate) => setSemesterConfig({ ...semesterConfig, startDate })} className="w-full" align="start" /></div>
                    <div className="space-y-2"><Label>结束日期</Label><DatePicker value={semesterConfig.endDate} onChange={(endDate) => setSemesterConfig({ ...semesterConfig, endDate })} className="w-full" align="start" /></div>
                    <div className="space-y-2"><Label>阅读阶段</Label><Input value={semesterConfig.readingStage} onChange={(e) => setSemesterConfig({ ...semesterConfig, readingStage: e.target.value })} /></div>
                  </div>
                  <div className="rounded-xl border border-violet-100 bg-violet-50/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-violet-900">学习默认值</h4>
                        <p className="mt-1 text-xs text-violet-700/80">用于后续能力模型、目标和推荐任务的默认承接。</p>
                      </div>
                      <Badge variant="outline" className="border-violet-200 bg-white text-violet-700">已接入后端</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>学习阶段</Label>
                        <Select value={semesterConfig.readingStage} onValueChange={(value) => setSemesterConfig({ ...semesterConfig, readingStage: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{readingStageSuggestions.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>默认能力级别</Label>
                        <Select value={localSettings.defaultAbilityLevel} onValueChange={(value) => updateLocalSettings({ defaultAbilityLevel: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['L1（一年级）', 'L2（二年级）', 'L3（三年级）', 'L4（四年级）', 'L5（五年级）'].map((level) => (
                              <SelectItem key={level} value={level}>{level}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>默认学习目标</Label>
                        <Input value={localSettings.defaultLearningGoal} onChange={(e) => updateLocalSettings({ defaultLearningGoal: e.target.value })} placeholder="例如：提升英语阅读理解" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setActiveDetailTab('overview')}>取消</Button>
                    <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSaveSemesterConfig} disabled={!selectedChild || saveSemesterMutation.isPending}>{saveSemesterMutation.isPending ? '保存中...' : '保存更改'}</Button>
                  </div>
                  </div>
                </section>
              )}

              {activeDetailTab === 'interests' && (
                <section className="h-full overflow-y-auto rounded-xl border border-border/70 bg-white p-3 shadow-sm">
                  <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">兴趣与能力</h3>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/45 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-emerald-900">兴趣标签</h4>
                        <p className="mt-1 text-xs text-emerald-700/80">兴趣标签用于推荐阅读和任务，区别于基本信息里的蓝色自定义标签。</p>
                      </div>
                      <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">已接入后端</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {localSettings.interestTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                          {tag}
                          <button
                            type="button"
                            onClick={() => updateLocalSettings({ interestTags: localSettings.interestTags.filter((item) => item !== tag) })}
                            className="rounded-full p-0.5 hover:bg-emerald-200"
                            aria-label={`删除${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input value={newInterestTag} onChange={(e) => setNewInterestTag(e.target.value)} placeholder="添加兴趣标签" onKeyDown={(event) => { if (event.key === 'Enter') addInterestTag(); }} />
                      <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={addInterestTag}>添加</Button>
                    </div>
                  </div>
                  <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">能力偏好</h4>
                      <Badge variant="outline" className="bg-white">待接入能力模型</Badge>
                    </div>
                    {['阅读理解', '问题解决', '逻辑推理', '表达能力', '信息提取'].map((name, index) => (
                      <div key={name} className="grid grid-cols-[100px_1fr_70px] items-center gap-3 text-sm">
                        <span className="text-slate-700">{name}</span>
                        <div className="h-2 rounded-full bg-white"><div className="h-full rounded-full bg-violet-500" style={{ width: `${40 + index * 10}%` }} /></div>
                        <span className="text-slate-500">待接入</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => persistLocalSettings(localSettings)} disabled={saveProfileMutation.isPending}>{saveProfileMutation.isPending ? '保存中...' : '保存更改'}</Button>
                  </div>
                  </div>
                </section>
              )}

              {activeDetailTab === 'push' && (
                <section className="h-full overflow-y-auto rounded-xl border border-border/70 bg-white p-3 shadow-sm">
                  <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">推送设置</h3>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                        <div>
                          <p className="text-sm font-semibold text-violet-900">钉钉推送开关</p>
                          <p className="mt-1 text-xs text-violet-700/80">开启后发送学习提醒与日报。</p>
                        </div>
                        <Switch checked={localSettings.pushEnabled} onCheckedChange={(checked) => updateLocalSettings({ pushEnabled: checked })} />
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                        <Label>推送内容</Label>
                        <div className="mt-3 space-y-2">
                          {pushContentOptions.map((option) => {
                            const checked = localSettings.pushContents.includes(option);
                            return (
                              <div key={option} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                <span className="text-slate-700">{option}</span>
                                <Switch
                                  checked={checked}
                                  onCheckedChange={() => updateLocalSettings({
                                    pushContents: checked
                                      ? localSettings.pushContents.filter((item) => item !== option)
                                      : [...localSettings.pushContents, option],
                                  })}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2 rounded-xl border border-border/70 bg-white p-3">
                        <Label>推送频率</Label>
                        <Select value={localSettings.pushFrequency} onValueChange={(value) => updateLocalSettings({ pushFrequency: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="每日一次">每日一次</SelectItem>
                            <SelectItem value="每周一次">每周一次</SelectItem>
                            <SelectItem value="仅重要提醒">仅重要提醒</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 rounded-xl border border-border/70 bg-white p-3">
                        <Label>推送时间</Label>
                        <Input type="time" value={localSettings.pushTime} onChange={(e) => updateLocalSettings({ pushTime: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2"><Label>Webhook 地址</Label><Input value={dingtalkWebhookUrl} onChange={(e) => setDingtalkWebhookUrl(e.target.value)} placeholder="请输入钉钉机器人 Webhook 地址" /></div>
                    <div className="space-y-2"><Label>加签 Secret</Label><Input value={dingtalkSecret} onChange={(e) => setDingtalkSecret(e.target.value)} placeholder="可选，若机器人开启加签请填写" /></div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSaveDingTalkConfig} disabled={!selectedChild || saveDingTalkMutation.isPending}>{saveDingTalkMutation.isPending ? '保存中...' : '保存配置'}</Button>
                    <Button variant="outline" onClick={() => selectedChild && testDingTalkMutation.mutate(selectedChild.id)} disabled={!selectedChild || !dingtalkConfig?.webhookUrl || testDingTalkMutation.isPending}>{testDingTalkMutation.isPending ? '测试中...' : '发送测试消息'}</Button>
                  </div>
                  </div>
                </section>
              )}

              {activeDetailTab === 'data' && (
                <section className="h-full overflow-y-auto rounded-xl border border-border/70 bg-white p-3 shadow-sm">
                  <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">学习数据概览</h3>
                  <div className="grid gap-3 md:grid-cols-4">
                    <StatCard icon={Clock} label="累计学习时长" value={`${stats.weeklyStudyTime || 0}分钟`} color="blue" />
                    <StatCard icon={TrendingUp} label="完成任务" value={stats.completedTasks || 0} color="green" />
                    <StatCard icon={BookOpen} label="阅读书籍" value={stats.booksRead || 0} color="purple" />
                    <StatCard icon={Award} label="成就数量" value={stats.achievements || 0} color="orange" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                      <Download className="h-8 w-8 rounded-lg bg-white p-2 text-blue-600 shadow-sm" />
                      <h4 className="mt-3 font-semibold text-blue-900">数据导出</h4>
                      <p className="mt-1 text-sm leading-6 text-blue-700/80">导出家庭设置、孩子、任务、计划、打卡、阅读和成就数据，用于备份和迁移。</p>
                      <Button variant="outline" onClick={handleExportData} disabled={isExportingData} className="mt-3 border-blue-200 bg-white text-blue-700">
                        {isExportingData ? '导出中...' : '导出 JSON'}
                      </Button>
                    </div>
                    <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                      <Database className="h-8 w-8 rounded-lg bg-white p-2 text-orange-600 shadow-sm" />
                      <h4 className="mt-3 font-semibold text-orange-900">数据管理</h4>
                      <p className="mt-1 text-sm leading-6 text-orange-700/80">后续支持归档历史数据、清理测试数据、合并重复记录和迁移孩子档案。</p>
                      <Button variant="outline" disabled className="mt-3 border-orange-200 bg-white text-orange-700">待接入管理</Button>
                    </div>
                  </div>
                  </div>
                </section>
              )}

              {activeDetailTab === 'security' && (
                <section className="h-full overflow-y-auto rounded-xl border border-border/70 bg-white p-3 shadow-sm">
                  <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">账号与安全</h3>
                  <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <Trash2 className="h-9 w-9 rounded-lg bg-white p-2 text-red-500 shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-red-900">删除孩子</h4>
                        <p className="mt-1 text-sm leading-6 text-red-700/80">删除后该孩子的学习记录和配置将无法恢复，请谨慎操作。</p>
                      </div>
                      <Button className="bg-red-500 hover:bg-red-600" onClick={handleOpenDelete}>进入删除确认</Button>
                    </div>
                  </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="rounded-3xl border border-border/70 p-0 overflow-hidden">
          <DialogHeader className="border-b border-border/70 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-6 py-5 text-left">
            <DialogTitle>添加孩子</DialogTitle>
            <DialogDescription>创建一个新的学习档案，后续即可关联任务、图书和学习报告。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="请输入孩子姓名"
              />
            </div>
            <div className="space-y-2">
              <Label>头像</Label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  {childAvatar}
                </div>
                <Input
                  value={childAvatar}
                  onChange={(e) => setChildAvatar(e.target.value)}
                  placeholder="输入emoji或图片链接"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-border/70 bg-slate-50/80 px-6 py-4">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-3xl border border-border/70 p-0 overflow-hidden">
          <DialogHeader className="border-b border-border/70 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-6 py-5 text-left">
            <DialogTitle>编辑孩子信息</DialogTitle>
            <DialogDescription>调整姓名和头像，这些信息会同步到导航、首页和各个学习模块。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="请输入孩子姓名"
              />
            </div>
            <div className="space-y-2">
              <Label>头像</Label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  {childAvatar}
                </div>
                <Input
                  value={childAvatar}
                  onChange={(e) => setChildAvatar(e.target.value)}
                  placeholder="输入emoji或图片链接"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-border/70 bg-slate-50/80 px-6 py-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，该孩子的所有学习记录、任务和成就都将被清除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-child-confirm" className="text-sm font-medium">
              请输入“{selectedChild?.name || '孩子姓名'}”确认删除
            </Label>
            <Input
              id="delete-child-confirm"
              value={deleteConfirmName}
              onChange={(event) => setDeleteConfirmName(event.target.value)}
              placeholder={selectedChild?.name || '孩子姓名'}
              disabled={deleteMutation.isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleteMutation.isPending || deleteConfirmName.trim() !== selectedChild?.name}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'border-blue-100 bg-blue-50/80 text-blue-700',
    green: 'border-emerald-100 bg-emerald-50/80 text-emerald-700',
    orange: 'border-orange-100 bg-orange-50/80 text-orange-700',
    purple: 'border-violet-100 bg-violet-50/80 text-violet-700',
  };

  return (
    <div className={cn('rounded-xl border p-2.5 shadow-sm', colorClasses[color])}>
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 shadow-sm">
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-1.5 text-xs font-medium opacity-90">{label}</p>
    </div>
  );
}
