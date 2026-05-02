import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Clock,
  Edit2,
  History,
  Save,
  Send,
  Settings2,
  Target,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import { EmptyPanel, PageToolbar, PageToolbarTitle } from '@/components/parent/PageToolbar';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import {
  getEducationStageLabel,
  targetTypeOptions,
} from '@/lib/education-stage';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getReadinessLayerByText } from '@/lib/readiness-model';
import {
  difficultyReverseMap,
  NO_ABILITY_POINT,
  normalizeTaskEditorFormForStage,
  parentRoleReverseMap,
  ScheduleRule,
  subjectReverseMap,
  taskEditorFormToPayload,
  TaskCategory,
  TaskEditor,
  TaskEditorFormData,
  taskToTaskEditorFormData,
  TaskType,
  TrackingType,
} from '@/components/parent/TaskEditor';

type TaskTags = {
  subject?: string;
  parentRole?: string;
  difficulty?: string;
  scheduleRule?: ScheduleRule;
  weeklyFrequency?: number;
  taskKind?: string;
  level?: string;
  abilityCategory?: string;
  abilityPoint?: string;
  linkedGoal?: string;
  targetType?: string;
  timeBlock?: string;
};

interface Task {
  id: number;
  name: string;
  category: TaskCategory;
  type: TaskType;
  timePerUnit: number;
  scheduleRule?: ScheduleRule;
  weeklyFrequency?: number;
  tags?: TaskTags;
  appliesTo: number[];
  createdAt: string;
  updatedAt: string;
  totalCompleted?: number;
  totalTarget?: number;
  progress?: number;
  initialCompleted?: number;
  initialUnit?: string;
  trackingType?: TrackingType;
  trackingUnit?: string;
  targetValue?: number;
}

const scheduleRuleLabels: Record<ScheduleRule, string> = {
  daily: '每日任务',
  school: '在校日任务',
  flexible: '智能分配',
  weekend: '周末任务',
};

function normalizeTags(rawTags: unknown): TaskTags {
  if (!rawTags || typeof rawTags !== 'object' || Array.isArray(rawTags)) return {};
  return rawTags as TaskTags;
}

function getScheduleRule(task?: Task): ScheduleRule {
  return (task?.scheduleRule || task?.tags?.scheduleRule || 'daily') as ScheduleRule;
}

function getTargetTypeLabel(value?: string) {
  return targetTypeOptions.find((option) => option.value === value)?.label || '未设置';
}

function getSubjectLabel(value?: string) {
  return value ? subjectReverseMap[value] || value : '未设置';
}

function getTaskConfigIssues(task: Task): string[] {
  const tags = normalizeTags(task.tags);
  const issues: string[] = [];
  if (!tags.abilityPoint) issues.push('缺能力点');
  if (!tags.linkedGoal || tags.linkedGoal === '不关联目标') issues.push('未关联目标');
  if (!tags.targetType) issues.push('缺目标类型');
  if (!tags.subject) issues.push('缺学科');
  if (!task.trackingType || task.trackingType === 'simple') issues.push('普通记录');
  return issues;
}

async function fetchTaskDetail(taskId: number): Promise<Task> {
  const { data } = await apiClient.get(`/tasks/${taskId}`);
  return data.data;
}

async function updateTask(taskId: number, updates: any): Promise<Task> {
  const { data } = await apiClient.put(`/tasks/${taskId}`, updates);
  return data.data;
}

async function deleteTask(taskId: number, childId: number): Promise<void> {
  await apiClient.delete(`/tasks/${taskId}`, { params: { childId } });
}

async function pushTaskToDingtalk(taskId: number, childId: number): Promise<void> {
  await apiClient.post(`/dingtalk/tasks/${taskId}/push-to-dingtalk`, { childId });
}

async function updateTaskInitialData(taskId: number, initialCompleted: number, initialUnit: string, childId: number): Promise<Task> {
  const { data } = await apiClient.put(`/tasks/${taskId}`, {
    initialCompleted,
    initialUnit,
    childId,
  });
  return data.data;
}

function InfoTile({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tone)}>
        <Icon className="size-5" />
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-400">{helper}</p> : null}
    </section>
  );
}

function Chip({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-red-100 bg-red-50 text-red-700',
  };

  return <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-medium', tones[tone])}>{children}</span>;
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const taskId = id ? parseInt(id, 10) : 0;
  const { selectedChildId, selectedChild } = useSelectedChild();
  const selectedEducationStage = selectedChild?.educationStage || 'primary';

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [isEditingInitial, setIsEditingInitial] = useState(false);
  const [initialCompleted, setInitialCompleted] = useState(0);
  const [initialUnit, setInitialUnit] = useState('页');
  const [formData, setFormData] = useState<TaskEditorFormData>(() => taskToTaskEditorFormData({
    name: '',
    category: '校内巩固',
    type: '固定',
    timePerUnit: 30,
  }, selectedEducationStage));

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => fetchTaskDetail(taskId),
    enabled: !!taskId,
  });

  useEffect(() => {
    if (!task) return;

    setInitialCompleted(task.initialCompleted || 0);
    setInitialUnit(task.initialUnit || '页');
    setFormData(taskToTaskEditorFormData(task, selectedEducationStage));
  }, [selectedEducationStage, task]);

  useEffect(() => {
    setFormData((current) => normalizeTaskEditorFormForStage(current, selectedEducationStage));
  }, [selectedEducationStage]);

  const updateTaskMutation = useMutation({
    mutationFn: () => {
      if (!selectedChildId) throw new Error('请先选择孩子');
      if (!task) throw new Error('任务不存在');

      return updateTask(taskId, taskEditorFormToPayload(formData, selectedChildId, task.appliesTo || [selectedChildId]));
    },
    onSuccess: () => {
      toast.success('任务已保存');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsEditingTask(false);
    },
    onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
  });

  const updateInitialDataMutation = useMutation({
    mutationFn: () => {
      if (!selectedChildId) throw new Error('请先选择孩子');
      return updateTaskInitialData(taskId, initialCompleted, initialUnit, selectedChildId);
    },
    onSuccess: () => {
      toast.success('初始数据已保存');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsEditingInitial(false);
    },
    onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: () => {
      if (!selectedChildId) throw new Error('请先选择孩子');
      return deleteTask(taskId, selectedChildId);
    },
    onSuccess: () => {
      toast.success('任务已删除');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/parent/tasks');
    },
    onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
  });

  const pushTaskToDingtalkMutation = useMutation({
    mutationFn: () => {
      if (!selectedChildId) throw new Error('请先选择孩子');
      return pushTaskToDingtalk(taskId, selectedChildId);
    },
    onSuccess: () => toast.success('任务已推送到钉钉'),
    onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
  });

  const handleSaveTask = () => {
    if (!formData.name.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    if (!formData.abilityPoint || formData.abilityPoint === NO_ABILITY_POINT) {
      toast.error('请选择任务关联的能力点');
      return;
    }
    updateTaskMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1360px] space-y-5 pb-24">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="mx-auto max-w-[1360px] pb-24">
        <EmptyPanel
          icon={AlertTriangle}
          title="任务不存在"
          description="该任务可能已经删除，或当前孩子没有访问权限。"
          action={<Button onClick={() => navigate('/parent/tasks')}><ArrowLeft className="size-4" />返回任务列表</Button>}
        />
      </div>
    );
  }

  const tags = normalizeTags(task.tags);
  const issues = getTaskConfigIssues(task);
  const scheduleRule = getScheduleRule(task);
  const readinessLayer = getReadinessLayerByText(
    tags.abilityCategory,
    tags.abilityPoint,
    tags.targetType,
    task.category,
    task.name
  );
  const ReadinessIcon = readinessLayer.icon;

  return (
    <div className="mx-auto max-w-[1360px] space-y-5 pb-24">
      <PageToolbar
        left={
          <PageToolbarTitle
            icon={BookOpen}
            title={task.name}
            description={`${selectedChild?.name || '当前孩子'} · ${getEducationStageLabel(selectedEducationStage)} · 任务详情与编辑`}
          />
        }
        right={
          <>
            <Button variant="outline" className="h-11 rounded-xl bg-white" onClick={() => navigate('/parent/tasks')}>
              <ArrowLeft className="mr-2 size-4" />
              返回
            </Button>
            <Button
              variant="outline"
              onClick={() => pushTaskToDingtalkMutation.mutate()}
              disabled={pushTaskToDingtalkMutation.isPending}
              className="h-11 rounded-xl border-blue-100 bg-white text-blue-600 hover:bg-blue-50"
            >
              <Send className="mr-2 size-4" />
              钉钉
            </Button>
            <Button
              onClick={() => setIsEditingTask((current) => !current)}
              className="h-11 rounded-xl bg-primary text-primary-foreground"
            >
              <Edit2 className="mr-2 size-4" />
              {isEditingTask ? '查看详情' : '编辑任务'}
            </Button>
          </>
        }
      />

      {!isEditingTask ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Chip tone="blue">层级：{readinessLayer.label}</Chip>
                  <Chip>学科：{getSubjectLabel(tags.subject)}</Chip>
                  <Chip>分类：{task.category}</Chip>
                  <Chip>规则：{scheduleRuleLabels[scheduleRule]}</Chip>
                  <Chip tone="green">目标：{getTargetTypeLabel(tags.targetType)}</Chip>
                  {tags.timeBlock ? <Chip tone="green">{tags.timeBlock}</Chip> : null}
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
                  这个任务当前归入{readinessLayer.label}，用于回答“{readinessLayer.question}”。任务详情页承接能力、目标、记录和回流说明。
                </p>
              </div>
              <div className={cn(
                'rounded-lg border px-4 py-3 text-sm',
                issues.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              )}>
                {issues.length > 0 ? `还有 ${issues.length} 项配置可补齐：${issues.join('、')}` : '配置完整'}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg ring-1', readinessLayer.softTone)}>
                  <ReadinessIcon className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">1.9 回流说明：{readinessLayer.label} · {readinessLayer.english}</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{readinessLayer.description}</p>
                </div>
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-3 lg:w-[420px]">
                <div className="rounded-lg bg-white px-3 py-2">
                  <p className="text-slate-400">能力点</p>
                  <p className="mt-1 font-semibold text-slate-900">{tags.abilityPoint || '未设置'}</p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2">
                  <p className="text-slate-400">目标</p>
                  <p className="mt-1 truncate font-semibold text-slate-900">{tags.linkedGoal || '未关联'}</p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2">
                  <p className="text-slate-400">证据</p>
                  <p className="mt-1 font-semibold text-slate-900">{task.trackingType === 'simple' ? '完成记录' : '结构化记录'}</p>
                </div>
              </div>
            </div>
            {readinessLayer.id === 'cognition' ? (
              <div className="mt-4 rounded-lg border border-violet-100 bg-white p-3">
                <p className="text-sm font-semibold text-slate-950">认知层采集建议</p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded-lg bg-violet-50 px-3 py-2">
                    <p className="font-semibold text-violet-700">尝试次数</p>
                    <p className="mt-1 text-slate-500">第几次能正确应用规则</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 px-3 py-2">
                    <p className="font-semibold text-blue-700">提示使用</p>
                    <p className="mt-1 text-slate-500">是否依赖提示完成</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-3 py-2">
                    <p className="font-semibold text-amber-700">主要错因</p>
                    <p className="mt-1 text-slate-500">漏读、规则、计算或推理</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-3 py-2">
                    <p className="font-semibold text-emerald-700">复盘质量</p>
                    <p className="mt-1 text-slate-500">能否复述规则并迁移</p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoTile icon={Clock} label="单次时长" value={`${task.timePerUnit} 分钟`} helper="每次执行建议时长" tone="bg-indigo-50 text-indigo-600" />
            <InfoTile icon={Target} label="分配规则" value={scheduleRuleLabels[scheduleRule]} helper={scheduleRule === 'flexible' ? `每周 ${task.weeklyFrequency || tags.weeklyFrequency || 5} 次` : '按规则自动排入计划'} tone="bg-sky-50 text-sky-600" />
            <InfoTile icon={BarChart3} label="累计进度" value={`${task.totalCompleted || 0} / ${task.totalTarget || 0} ${task.initialUnit || '页'}`} helper="基于累计记录计算" tone="bg-emerald-50 text-emerald-600" />
            <InfoTile icon={Settings2} label="记录方式" value={task.trackingType === 'numeric' ? '数值记录' : task.trackingType === 'progress' ? '进度记录' : '简单记录'} helper={task.trackingUnit || '无需填写单位'} tone="bg-amber-50 text-amber-600" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <FormSection title="任务配置" description="展示当前任务的结构化字段，后续目标引擎会复用这些数据。">
              <div className="grid gap-4 md:grid-cols-2">
                <DetailRow label="任务类型" value={tags.taskKind || '未设置'} />
                <DetailRow label="适用年级" value={tags.level || '未设置'} />
                <DetailRow label="能力分类" value={tags.abilityCategory || '未设置'} />
                <DetailRow label="能力点" value={tags.abilityPoint || '未设置'} />
                <DetailRow label="关联目标" value={tags.linkedGoal || '不关联目标'} />
                <DetailRow label="完成方式" value={tags.parentRole ? parentRoleReverseMap[tags.parentRole] || tags.parentRole : '未设置'} />
                <DetailRow label="难度" value={tags.difficulty ? difficultyReverseMap[tags.difficulty] || tags.difficulty : '未设置'} />
                <DetailRow label="适用孩子" value={`${task.appliesTo?.length || 0} 个`} />
              </div>
            </FormSection>

            <FormSection title="初始数据" description="用于累计型任务的起始完成量。">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500">初始完成量</Label>
                    {isEditingInitial ? (
                      <Input className="mt-2" type="number" value={initialCompleted} onChange={(event) => setInitialCompleted(parseInt(event.target.value, 10) || 0)} />
                    ) : (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">{initialCompleted}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">单位</Label>
                    {isEditingInitial ? (
                      <Select value={initialUnit} onValueChange={setInitialUnit}>
                        <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['页', '题', '道', '篇', '章', '节', '分钟', '次'].map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">{initialUnit}</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditingInitial((current) => !current)}>
                    {isEditingInitial ? '取消' : '编辑初始数据'}
                  </Button>
                  {isEditingInitial ? (
                    <Button onClick={() => updateInitialDataMutation.mutate()} disabled={updateInitialDataMutation.isPending}>
                      <Save className="mr-2 size-4" />
                      保存
                    </Button>
                  ) : null}
                </div>
              </div>
            </FormSection>
          </div>

          <FormSection title="任务历史" description="完成任务后，这里会展示执行历史和累计数据。">
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-500">
              <History className="mx-auto mb-3 size-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">还没有打卡记录</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/parent')}>
                去首页打卡
              </Button>
            </div>
          </FormSection>

          <section className="rounded-lg border border-red-200 bg-red-50/50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-red-700">危险操作</h2>
                <p className="mt-1 text-sm text-red-600/80">删除后任务配置和相关计划不可恢复。</p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 size-4" />
                删除任务
              </Button>
            </div>
          </section>
        </>
      ) : (
        <TaskEditor
          value={formData}
          onChange={setFormData}
          educationStage={selectedEducationStage}
          childName={selectedChild?.name}
          onCancel={() => setIsEditingTask(false)}
          onSubmit={handleSaveTask}
          isSubmitting={updateTaskMutation.isPending}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border border-slate-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-xl font-bold text-red-600">
              <div className="flex size-10 items-center justify-center rounded-xl bg-destructive">
                <Trash2 className="size-5 text-white" />
              </div>
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              确定要删除任务「{task.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="h-11 rounded-xl px-6">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaskMutation.mutate()}
              className="h-11 rounded-xl bg-red-500 px-6 text-white hover:bg-red-600"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
