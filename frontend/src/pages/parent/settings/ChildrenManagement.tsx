import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const gradeOptions = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三'];
const readingStageSuggestions = ['幼儿园小班', '幼儿园中班', '幼儿园大班', '一年级上', '一年级寒假', '一年级下', '一年级暑假', '二年级上'];

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

async function getChildren(): Promise<any> {
  const response = await apiClient.get('/children');
  return response.data;
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

async function testChildDingTalkConfig(childId: number): Promise<any> {
  const response = await apiClient.post('/settings/test-webhook', { childId });
  return response.data;
}

export default function ChildrenManagement() {
  const { refreshChildren } = useSelectedChild();
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form states
  const [childName, setChildName] = useState('');
  const [childAvatar, setChildAvatar] = useState('🐶');
  const [dingtalkWebhookUrl, setDingtalkWebhookUrl] = useState('');
  const [dingtalkSecret, setDingtalkSecret] = useState('');
  const [semesterConfig, setSemesterConfig] = useState<SemesterConfig>(getDefaultSemesterConfig);

  const { data: childrenData, refetch } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: createChild,
    onSuccess: () => {
      toast.success('孩子添加成功');
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
      refreshChildren();
    },
    onError: (error) => {
      toast.error(`添加失败：${getErrorMessage(error)}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ childId, data }: { childId: number; data: { name: string; avatar: string } }) =>
      updateChild(childId, data),
    onSuccess: () => {
      toast.success('信息已更新');
      setIsEditDialogOpen(false);
      refetch();
      refreshChildren();
    },
    onError: (error) => {
      toast.error(`更新失败：${getErrorMessage(error)}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChild,
    onSuccess: () => {
      toast.success('孩子已删除');
      setIsDeleteDialogOpen(false);
      setIsDetailOpen(false);
      refetch();
      refreshChildren();
    },
    onError: (error) => {
      toast.error(`删除失败：${getErrorMessage(error)}`);
    },
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

  const resetForm = () => {
    setChildName('');
    setChildAvatar('🐶');
  };

  const handleOpenDetail = (child: Child) => {
    setSelectedChild(child);
    setIsDetailOpen(true);
  };

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
    setIsDeleteDialogOpen(true);
  };

  const handleCreate = () => {
    if (!childName.trim()) {
      toast.error('请输入孩子姓名');
      return;
    }
    createMutation.mutate({
      name: childName.trim(),
      avatar: childAvatar,
    });
  };

  const handleUpdate = () => {
    if (!childName.trim() || !selectedChild) return;
    updateMutation.mutate({
      childId: selectedChild.id,
      data: {
        name: childName.trim(),
        avatar: childAvatar,
      },
    });
  };

  const handleDelete = () => {
    if (selectedChild) {
      deleteMutation.mutate(selectedChild.id);
    }
  };

  const handleSaveDingTalkConfig = () => {
    if (!selectedChild) return;
    if (!dingtalkWebhookUrl.trim()) {
      toast.error('请输入钉钉 Webhook 地址');
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
  };

  const children: Child[] = childrenData?.data || [];
  const stats: ChildStats = statsData?.data || {
    weeklyStudyTime: 0,
    completedTasks: 0,
    achievements: 0,
    booksRead: 0,
    weeklyProgress: 0,
  };
  const dingtalkConfig: DingTalkConfig | null = dingtalkConfigData?.data || null;
  const savedSemesterConfig: SemesterConfig | null = semesterConfigData?.data || null;

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

  return (
    <div className="space-y-6">
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

        {children.length === 0 && (
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

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[min(860px,94vw)] max-h-[84vh] overflow-y-auto rounded-3xl border border-border/70 bg-[#fcfcff] p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/70 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-5 py-5 pr-14 text-left">
            <div className="flex items-start gap-4">
              <ChildAvatarDisplay avatar={selectedChild?.avatar} name={selectedChild?.name || '孩子'} size="lg" />
              <div className="flex-1">
                <DialogTitle className="text-[28px] leading-none tracking-tight">{selectedChild?.name}</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  查看学习概览、钉钉配置与账号信息
                </DialogDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full bg-white/80 px-3 py-1">
                    成长档案
                  </Badge>
                  <Badge variant="outline" className="rounded-full bg-white/70 px-3 py-1">
                    可配置钉钉推送
                  </Badge>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-5 py-5">
            {/* Learning Overview */}
            <section className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">学习概览</h3>
                <p className="mt-1 text-sm text-muted-foreground">快速查看这个孩子最近的学习与阅读情况。</p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  icon={Clock}
                  label="本周学习"
                  value={`${stats.weeklyStudyTime || 0}分钟`}
                  color="blue"
                />
                <StatCard
                  icon={TrendingUp}
                  label="完成任务"
                  value={stats.completedTasks || 0}
                  color="green"
                />
                <StatCard
                  icon={Award}
                  label="获得成就"
                  value={stats.achievements || 0}
                  color="orange"
                />
                <StatCard
                  icon={BookOpen}
                  label="阅读书籍"
                  value={stats.booksRead || 0}
                  color="purple"
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">本周进度</span>
                  <span className="font-semibold text-slate-900">{stats.weeklyProgress || 0}%</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all"
                    style={{ width: `${stats.weeklyProgress || 0}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">根据本周任务完成和学习记录自动更新。</p>
              </div>
            </section>

            <Separator />

            {/* Semester Config */}
            <section className="space-y-4 rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-medium">当前学期配置</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    成长仪表盘的“本学期”会使用这里的开始和结束日期统计数据。
                  </p>
                </div>
                {savedSemesterConfig ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    已配置
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    使用默认建议
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>学年</Label>
                  <Input
                    value={semesterConfig.schoolYear}
                    onChange={(e) => setSemesterConfig({ ...semesterConfig, schoolYear: e.target.value })}
                    placeholder="例如 2025-2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label>学期</Label>
                  <Select
                    value={semesterConfig.term}
                    onValueChange={(value) => setSemesterConfig({ ...semesterConfig, term: value as SemesterConfig['term'] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择学期" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first">上学期</SelectItem>
                      <SelectItem value="second">下学期</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>年级</Label>
                  <Select
                    value={semesterConfig.grade}
                    onValueChange={(value) => setSemesterConfig({ ...semesterConfig, grade: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择年级" />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeOptions.map((grade) => (
                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>开始日期</Label>
	                  <DatePicker value={semesterConfig.startDate} onChange={(startDate) => setSemesterConfig({ ...semesterConfig, startDate })} className="w-full" align="start" />
                </div>
                <div className="space-y-2">
                  <Label>结束日期</Label>
	                  <DatePicker value={semesterConfig.endDate} onChange={(endDate) => setSemesterConfig({ ...semesterConfig, endDate })} className="w-full" align="start" />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="space-y-1">
                  <Label>当前阅读阶段</Label>
                  <p className="text-xs text-muted-foreground">
                    添加阅读记录时会默认带入这个阶段，用于后续按年级、假期或幼儿园阶段分析阅读。
                  </p>
                </div>
                <Input
                  value={semesterConfig.readingStage}
                  onChange={(e) => setSemesterConfig({ ...semesterConfig, readingStage: e.target.value })}
                  placeholder="例如：一年级上 / 一年级暑假 / 幼儿园大班下"
                  className="bg-white"
                />
                <div className="flex flex-wrap gap-2">
                  {readingStageSuggestions.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setSemesterConfig({ ...semesterConfig, readingStage: stage })}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition',
                        semesterConfig.readingStage === stage
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-indigo-100 bg-white text-indigo-700 hover:border-indigo-300'
                      )}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleSaveSemesterConfig}
                  disabled={!selectedChild || saveSemesterMutation.isPending}
                  className="rounded-xl shadow-sm"
                >
                  {saveSemesterMutation.isPending ? '保存中...' : '保存学期配置'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  示例：{semesterConfig.readingStage || `${semesterConfig.grade}${semesterConfig.term === 'first' ? '上' : '下'}`} · {semesterConfig.startDate} 至 {semesterConfig.endDate}
                </p>
              </div>
            </section>

            <Separator />

            {/* DingTalk Config */}
            <section className="space-y-4 rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium">钉钉推送配置</h4>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    为这个孩子配置专属钉钉机器人，方便推送任务、周计划和学习汇总。
                  </p>
                </div>
                {dingtalkConfig?.webhookUrl ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    已配置
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    未配置
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label>Webhook 地址</Label>
                <Input
                  value={dingtalkWebhookUrl}
                  onChange={(e) => setDingtalkWebhookUrl(e.target.value)}
                  placeholder="请输入钉钉机器人 Webhook 地址"
                />
              </div>

              <div className="space-y-2">
                <Label>加签 Secret</Label>
                <Input
                  value={dingtalkSecret}
                  onChange={(e) => setDingtalkSecret(e.target.value)}
                  placeholder="可选，若机器人开启加签请填写"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleSaveDingTalkConfig}
                  disabled={!selectedChild || saveDingTalkMutation.isPending}
                  className="rounded-xl shadow-sm"
                >
                  {saveDingTalkMutation.isPending ? '保存中...' : '保存配置'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedChild) {
                      testDingTalkMutation.mutate(selectedChild.id);
                    }
                  }}
                  disabled={!selectedChild || !dingtalkConfig?.webhookUrl || testDingTalkMutation.isPending}
                  className="rounded-xl"
                >
                  {testDingTalkMutation.isPending ? '测试中...' : '发送测试消息'}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                测试消息会发送到当前孩子绑定的钉钉机器人中，用来确认配置是否可用。
              </p>
            </section>

            <Separator />

            {/* Account Actions */}
            <section className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">账号操作</h3>
                <p className="mt-1 text-sm text-muted-foreground">管理孩子资料、密码与账号状态。</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                  <h4 className="font-medium text-slate-900">编辑资料</h4>
                  <p className="mt-1 text-sm text-muted-foreground">修改姓名、头像和基础信息。</p>
                  <Button variant="outline" className="mt-4 rounded-xl" onClick={handleOpenEdit}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    编辑资料
                  </Button>
                </div>
                <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                  <h4 className="font-medium text-slate-900">登录说明</h4>
                  <p className="mt-1 text-sm text-muted-foreground">当前已移除孩子端独立登录，这里不再需要设置 PIN 或密码。</p>
                  <Button variant="outline" className="mt-4 rounded-xl" disabled>
                    暂不需要
                  </Button>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 shadow-sm">
                  <h4 className="font-medium text-red-700">删除孩子</h4>
                  <p className="mt-1 text-sm text-red-600/80">删除后该孩子的学习记录和配置将无法恢复。</p>
                  <Button variant="outline" className="mt-4 rounded-xl border-red-200 text-red-700 hover:bg-red-100" onClick={handleOpenDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除孩子
                  </Button>
                </div>
              </div>
            </section>
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
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
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
    <div className={cn('rounded-xl border p-3 shadow-sm', colorClasses[color])}>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 shadow-sm">
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-3xl font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-2 text-xs font-medium opacity-90">{label}</p>
    </div>
  );
}
