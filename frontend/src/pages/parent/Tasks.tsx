import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, BookOpen, Calculator, Dumbbell, GraduationCap, Languages, BookMarked, Users, Star, ListTodo, Download, Send, RefreshCw, Info, ClipboardList, Activity, AlertTriangle, Clock3, BarChart3, CalendarDays, ArrowRight, CheckCircle2, TrendingUp } from 'lucide-react';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ExportDialog } from '@/components/ExportDialog';
import { middleSubjectOptions, targetTypeOptions } from '@/lib/education-stage';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { EmptyPanel, FilterBar, PageToolbar, PageToolbarTitle } from '@/components/parent/PageToolbar';
import {
  createDefaultTaskEditorFormData,
  NO_ABILITY_POINT,
  normalizeTaskEditorFormForStage,
  ScheduleRule,
  subjectMap,
  taskEditorFormToPayload,
  TaskCategory,
  TaskEditor,
  TaskEditorFormData,
  TaskType,
} from '@/components/parent/TaskEditor';

const getWeekNo = (date: Date) => {
  return `${getISOWeekYear(date)}-${String(getISOWeek(date)).padStart(2, '0')}`;
};

// 映射对象
const subjectReverseMap: Record<string, string> = {
  'chinese': '语文',
  'math': '数学',
  'english': '英语',
  'sports': '体育',
  'physics': '物理',
  'chemistry': '化学',
  'biology': '生物',
  'history': '历史',
  'geography': '地理',
  'politics': '道法'
};
const parentRoleReverseMap: Record<string, string> = {
  'independent': '独立完成',
  'accompany': '家长陪伴',
  'parent-led': '家长主导'
};

export interface Task {
  id: number;
  name: string;
  category: TaskCategory;
  type: TaskType;
  timePerUnit: number;
  scheduleRule?: ScheduleRule;
  weeklyFrequency?: number;
  tags?: {
    subject?: string;
    difficulty?: string;
    parentRole?: string;
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
  appliesTo?: number[];
  // 精细化记录字段
  trackingType?: 'simple' | 'numeric' | 'progress';
  trackingUnit?: string;
  targetValue?: number;
}

type TaskTags = NonNullable<Task['tags']>;

const tagConfig: Record<string, { icon: any; color: string }> = {
  '校内巩固': { icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
  '校内拔高': { icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
  '课外课程': { icon: Star, color: 'bg-orange-100 text-orange-600' },
  '英语阅读': { icon: BookMarked, color: 'bg-purple-100 text-purple-600' },
  '中文阅读': { icon: BookMarked, color: 'bg-pink-100 text-pink-600' },
  '体育运动': { icon: Dumbbell, color: 'bg-green-100 text-green-600' },
  '语文': { icon: Languages, color: 'bg-red-100 text-red-600' },
  '数学': { icon: Calculator, color: 'bg-blue-100 text-blue-600' },
  '英语': { icon: Languages, color: 'bg-purple-100 text-purple-600' },
  '体育': { icon: Dumbbell, color: 'bg-green-100 text-green-600' },
  '独立完成': { icon: Users, color: 'bg-cyan-100 text-cyan-600' },
  '家长陪伴': { icon: Users, color: 'bg-cyan-100 text-cyan-600' },
  '家长主导': { icon: Users, color: 'bg-cyan-100 text-cyan-600' },
};

const primarySubjectOptions = ['语文', '数学', '英语', '体育'];

const normalizeTaskTags = (rawTags: unknown): TaskTags => {
  let tags: Record<string, unknown> = {};

  if (rawTags && typeof rawTags === 'object' && !Array.isArray(rawTags)) {
    tags = rawTags as Record<string, unknown>;
  } else if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        tags = parsed as Record<string, unknown>;
      }
    } catch {
      tags = {};
    }
  }

  const legacyMetadata = tags.metadata && typeof tags.metadata === 'object' && !Array.isArray(tags.metadata)
    ? tags.metadata as Record<string, unknown>
    : {};
  const merged = { ...legacyMetadata, ...tags };

  const abilityPoint = typeof merged.abilityPoint === 'string' && merged.abilityPoint.trim() !== NO_ABILITY_POINT
    ? merged.abilityPoint.trim()
    : undefined;

  return {
    subject: typeof merged.subject === 'string' ? merged.subject : undefined,
    difficulty: typeof merged.difficulty === 'string' ? merged.difficulty : undefined,
    parentRole: typeof merged.parentRole === 'string' ? merged.parentRole : undefined,
    scheduleRule: ['daily', 'school', 'weekend', 'flexible'].includes(String(merged.scheduleRule))
      ? merged.scheduleRule as ScheduleRule
      : undefined,
    weeklyFrequency: Number(merged.weeklyFrequency) > 0 ? Number(merged.weeklyFrequency) : undefined,
    taskKind: typeof merged.taskKind === 'string' ? merged.taskKind : undefined,
    level: typeof merged.level === 'string' ? merged.level : undefined,
    abilityCategory: typeof merged.abilityCategory === 'string' ? merged.abilityCategory : undefined,
    abilityPoint,
    linkedGoal: typeof merged.linkedGoal === 'string' ? merged.linkedGoal : undefined,
    targetType: typeof merged.targetType === 'string' ? merged.targetType : undefined,
    timeBlock: typeof merged.timeBlock === 'string' ? merged.timeBlock : undefined,
  };
};

const normalizeTask = (task: Task): Task => {
  const tags = normalizeTaskTags(task.tags);
  return {
    ...task,
    tags,
    scheduleRule: task.scheduleRule || tags.scheduleRule || 'daily',
    weeklyFrequency: task.weeklyFrequency || tags.weeklyFrequency,
  };
};

async function fetchTasks(childId?: number): Promise<Task[]> {
  // 强制传递childId，确保数据隔离
  if (!childId) {
    return [];
  }
  const params = { childId };
  const r = await apiClient.get('/tasks', { params });
  return (r.data.data || []).map(normalizeTask);
}
async function deleteTask(id: number, childId: number): Promise<void> {
  await apiClient.delete('/tasks/' + id, { params: { childId } });
}
async function pushTaskToDingtalk(taskId: number, childId: number): Promise<void> {
  await apiClient.post(`/dingtalk/tasks/${taskId}/push-to-dingtalk`, { childId });
}

export default function TasksPage() {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [updatePlanDialogOpen, setUpdatePlanDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { selectedChildId, selectedChild } = useSelectedChild();
  const [formData, setFormData] = useState<TaskEditorFormData>(() => createDefaultTaskEditorFormData(selectedChild?.educationStage));
  // 使用localStorage存储当前选中的选项卡
  const [activeTab, setActiveTab] = useState<'all' | 'subject' | 'type' | 'completion' | 'schedule'>(() => {
    const savedTab = localStorage.getItem('tasksActiveTab');
    return (savedTab as 'all' | 'subject' | 'type' | 'completion' | 'schedule') || 'all';
  });

  // 当选项卡变化时，保存到localStorage
  useEffect(() => {
    localStorage.setItem('tasksActiveTab', activeTab);
  }, [activeTab]);

  const queryClient = useQueryClient();
  const selectedEducationStage = selectedChild?.educationStage || 'primary';
  const currentSubjectOptions = useMemo(
    () => selectedEducationStage === 'middle' ? middleSubjectOptions : primarySubjectOptions,
    [selectedEducationStage]
  );

  useEffect(() => {
    setFormData((current) => normalizeTaskEditorFormForStage(current, selectedEducationStage));
  }, [selectedEducationStage]);
  const { data: tasks = [], isLoading } = useQuery({ 
    queryKey: ['tasks', selectedChildId], 
    queryFn: () => fetchTasks(selectedChildId || undefined),
    enabled: !!selectedChildId // 只有在选择了孩子时才查询
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, childId }: { id: number; childId: number }) => deleteTask(id, childId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('删除成功');
      setDeleteDialogOpen(false);
    },
    onError: (e: any) => toast.error(getErrorMessage(e))
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiClient.post('/tasks', data);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('创建成功');
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(getErrorMessage(e))
  });

  // Push task to DingTalk mutation
  const pushTaskToDingtalkMutation = useMutation({
    mutationFn: ({ taskId, childId }: { taskId: number; childId: number }) =>
      pushTaskToDingtalk(taskId, childId),
    onSuccess: () => toast.success('任务已推送至钉钉'),
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const resetForm = () => {
    setFormData(createDefaultTaskEditorFormData(selectedEducationStage));
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    if (!formData.abilityPoint || formData.abilityPoint === NO_ABILITY_POINT) {
      toast.error('请选择任务关联的能力点');
      return;
    }
    createMutation.mutate(taskEditorFormToPayload(formData, selectedChildId));
  };

  const getSubjectGroups = () => {
    return currentSubjectOptions.map(subject => {
      const subjectKey = Object.keys(subjectReverseMap).find(key => subjectReverseMap[key] === subject) || subject;
      const subjectTasks = tasks.filter(task => {
        const taskSubject = task.tags?.subject;
        if (taskSubject) {
          return taskSubject === subject || taskSubject === subjectKey;
        }
        return false;
      });
      return { subject, tasks: subjectTasks };
    }).filter(group => group.tasks.length > 0);
  };

  const getTypeGroups = () => {
    const types = ['校内巩固', '校内拔高', '课外课程', '英语阅读', '中文阅读', '体育运动'];
    return types.map(type => {
      const typeTasks = tasks.filter(task => task.category === type);
      return { type, tasks: typeTasks };
    }).filter(group => group.tasks.length > 0);
  };

  const getCompletionGroups = () => {
    const parentRoleReverseMap: Record<string, string> = {
      'independent': '独立完成',
      'accompany': '家长陪伴',
      'parent-led': '家长主导'
    };
    const completionTypes = ['独立完成', '家长陪伴', '家长主导'];
    return completionTypes.map(type => {
      const typeKey = Object.keys(parentRoleReverseMap).find(key => parentRoleReverseMap[key] === type) || type;
      const typeTasks = tasks.filter(task => {
        const taskRole = task.tags?.parentRole;
        if (taskRole) {
          return taskRole === type || taskRole === typeKey;
        }
        return false;
      });
      return { type, tasks: typeTasks };
    }).filter(group => group.tasks.length > 0);
  };

  const getScheduleGroups = () => {
    const scheduleRuleMap: Record<ScheduleRule, string> = {
      'daily': '每日任务',
      'school': '在校日任务',
      'weekend': '周末任务',
      'flexible': '智能分配'
    };
    const scheduleRules: ScheduleRule[] = ['daily', 'school', 'weekend', 'flexible'];
    return scheduleRules.map(rule => {
      const ruleTasks = tasks.filter(task => (task.scheduleRule || 'daily') === rule);
      return { rule: scheduleRuleMap[rule], tasks: ruleTasks };
    }).filter(group => group.tasks.length > 0);
  };

  const handlePushTaskToDingtalk = (taskId: number) => {
    if (!selectedChildId) {
      toast.error('请先选择一个孩子');
      return;
    }
    pushTaskToDingtalkMutation.mutate({ taskId, childId: selectedChildId });
  };

  const renderTags = (task: Task) => {
    const parentRoleReverseMap: Record<string, string> = {
      'independent': '独立完成',
      'accompany': '家长陪伴',
      'parent-led': '家长主导'
    };
    const tags: string[] = [task.category];
    if (task.tags?.subject) {
      const subject = subjectReverseMap[task.tags.subject as string] || task.tags.subject;
      tags.push(subject);
    }
    if (task.tags?.parentRole) {
      const parentRole = parentRoleReverseMap[task.tags.parentRole as string] || task.tags.parentRole;
      tags.push(parentRole);
    }
    if (task.tags?.level) tags.push(task.tags.level);
    if (task.tags?.abilityPoint) tags.push(task.tags.abilityPoint);
    if (task.tags?.targetType) tags.push(targetTypeOptions.find((item) => item.value === task.tags?.targetType)?.label || task.tags.targetType);
    if (task.tags?.timeBlock) tags.push(task.tags.timeBlock);
    if (task.tags?.linkedGoal && task.tags.linkedGoal !== '不关联目标') tags.push(task.tags.linkedGoal);
    return tags.map(tag => {
      const config = tagConfig[tag];
      const Icon = config?.icon || BookOpen;
      return (
        <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
          <Icon className="w-3 h-3" />
          {tag}
        </span>
      );
    });
  };

  const scheduleLabelMap: Record<ScheduleRule, string> = {
    daily: '每日任务',
    school: '在校日',
    weekend: '周末任务',
    flexible: '智能分配',
  };

  const getTaskVisual = (task: Task) => {
    const config = tagConfig[task.category];
    const Icon = config?.icon || BookOpen;
    const toneMap: Record<TaskCategory, string> = {
      '校内巩固': 'bg-blue-50 text-blue-600 ring-blue-100',
      '校内拔高': 'bg-violet-50 text-violet-600 ring-violet-100',
      '课外课程': 'bg-orange-50 text-orange-600 ring-orange-100',
      '英语阅读': 'bg-purple-50 text-purple-600 ring-purple-100',
      '中文阅读': 'bg-pink-50 text-pink-600 ring-pink-100',
      '体育运动': 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    };
    const barMap: Record<TaskCategory, string> = {
      '校内巩固': 'bg-blue-500',
      '校内拔高': 'bg-violet-500',
      '课外课程': 'bg-orange-500',
      '英语阅读': 'bg-purple-500',
      '中文阅读': 'bg-pink-500',
      '体育运动': 'bg-emerald-500',
    };
    return { Icon, tone: toneMap[task.category], bar: barMap[task.category] };
  };

  const getSubjectLabel = (task: Task) => task.tags?.subject ? subjectReverseMap[task.tags.subject] || task.tags.subject : '未标学科';
  const getParentRoleLabel = (task: Task) => task.tags?.parentRole ? parentRoleReverseMap[task.tags.parentRole] || task.tags.parentRole : '未设方式';
  const getScheduleLabel = (task: Task) => scheduleLabelMap[(task.scheduleRule || task.tags?.scheduleRule || 'daily') as ScheduleRule] || '每日任务';

  const getOperationalScore = (task: Task) => {
    let score = 42;
    if (task.tags?.subject) score += 12;
    if (task.tags?.parentRole) score += 10;
    if (task.tags?.difficulty) score += 8;
    if (task.tags?.level) score += 6;
    if (task.tags?.abilityPoint) score += 8;
    if (task.tags?.linkedGoal && task.tags.linkedGoal !== '不关联目标') score += 8;
    if (task.scheduleRule || task.tags?.scheduleRule) score += 10;
    if (task.trackingType && task.trackingType !== 'simple') score += 8;
    if (task.targetValue) score += 10;
    return Math.min(score, 96);
  };

  const getTaskConfigIssues = (task: Task) => {
    const issues: string[] = [];
    if (!task.tags?.abilityPoint) issues.push('缺能力点');
    if (!task.tags?.linkedGoal || task.tags.linkedGoal === '不关联目标') issues.push('未关联目标');
    if (!task.tags?.subject) issues.push('缺学科');
    if (!task.scheduleRule && !task.tags?.scheduleRule) issues.push('缺计划规则');
    if (!task.trackingType || task.trackingType === 'simple') issues.push('普通记录');
    return issues;
  };

  const totalMinutes = tasks.reduce((sum, task) => sum + (Number(task.timePerUnit) || 0), 0);
  const dailyTasks = tasks.filter(task => (task.scheduleRule || task.tags?.scheduleRule || 'daily') === 'daily');
  const flexibleTasks = tasks.filter(task => (task.scheduleRule || task.tags?.scheduleRule) === 'flexible');
  const trackedTasks = tasks.filter(task => task.trackingType && task.trackingType !== 'simple');
  const incompleteConfigTasks = tasks.filter(task => getTaskConfigIssues(task).length > 0);
  const taskHealthScore = tasks.length > 0
    ? Math.round(tasks.reduce((sum, task) => sum + getOperationalScore(task), 0) / tasks.length)
    : 0;
  const attentionTasks = [...tasks]
    .sort((a, b) => {
      const issueDiff = getTaskConfigIssues(b).length - getTaskConfigIssues(a).length;
      if (issueDiff !== 0) return issueDiff;
      return getOperationalScore(a) - getOperationalScore(b);
    })
    .slice(0, Math.min(3, tasks.length));
  const operationalMetrics = [
    {
      label: '启用任务',
      value: tasks.length,
      helper: '当前孩子任务池',
      icon: ClipboardList,
      tone: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: '任务健康度',
      value: `${taskHealthScore}%`,
      helper: '基于配置完整度预估',
      icon: Activity,
      tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: '本周预计负载',
      value: `${Math.round(totalMinutes / 60)}h`,
      helper: `${totalMinutes} 分钟任务池容量`,
      icon: Clock3,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      label: '待关注任务',
      value: incompleteConfigTasks.length,
      helper: '缺少能力、目标或记录配置',
      icon: AlertTriangle,
      tone: 'bg-rose-50 text-rose-600',
    },
  ];

  const trendPoints = [56, 63, 59, 68, 72, 70, Math.max(taskHealthScore, 48)];
  const trendPath = trendPoints.map((point, index) => {
    const x = 14 + index * 26;
    const y = 72 - point * 0.52;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const tabItems: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'all', label: '全部任务' },
    { key: 'subject', label: '按学科' },
    { key: 'type', label: '按类型' },
    { key: 'completion', label: '完成方式' },
    { key: 'schedule', label: '分配规则' },
  ];

  const renderTaskCard = (task: Task) => {
    const visual = getTaskVisual(task);
    const score = getOperationalScore(task);
    const issues = getTaskConfigIssues(task);
    const Icon = visual.Icon;
    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate(`/parent/tasks/${task.id}`)}
        className="group min-h-[172px] cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1', visual.tone)}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-950">{task.name}</h3>
              <p className="mt-1 truncate text-xs font-medium text-slate-500">{task.category} · {getSubjectLabel(task)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/parent/tasks/${task.id}`);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-100 transition-colors hover:bg-slate-50 hover:text-slate-700 lg:opacity-0 lg:group-hover:opacity-100"
            aria-label="进入任务详情"
            title="进入详情"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">运营健康度</span>
            <span className="font-semibold text-slate-900">{score}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={cn('h-full rounded-full transition-all', visual.bar)} style={{ width: `${score}%` }} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-slate-50 px-2.5 py-2">
            <p className="text-slate-400">预计时长</p>
            <p className="mt-1 font-semibold text-slate-800">{task.timePerUnit || 30} 分钟</p>
          </div>
          <div className="rounded-md bg-slate-50 px-2.5 py-2">
            <p className="text-slate-400">分配规则</p>
            <p className="mt-1 font-semibold text-slate-800">{getScheduleLabel(task)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            <CalendarDays className="size-3" />
            <span className="truncate">{getParentRoleLabel(task)}</span>
          </span>
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            issues.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
          )}>
            {issues.length > 0 ? <AlertTriangle className="size-3" /> : <TrendingUp className="size-3" />}
            {issues.length > 0 ? `${issues.length} 项待补` : '配置完整'}
          </span>
        </div>
        {issues.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {issues.slice(0, 3).map((issue) => (
              <span key={issue} className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                {issue}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  const renderTaskCollection = (items: Task[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map(renderTaskCard)}</div>
  );

	  return (
	    <div className="mx-auto max-w-[1360px] space-y-5" ref={pageRef}>
      <PageToolbar
        left={
          <PageToolbarTitle
            icon={ListTodo}
            title="任务管理"
            description={`${selectedChild?.name || '当前孩子'}的任务池、能力关联和计划同步状态`}
          />
        }
        right={
          <>
            <Button onClick={() => setExportDialogOpen(true)} className="h-11 min-w-28 rounded-xl bg-emerald-500 text-white shadow-sm hover:bg-emerald-600">
              <Download className="mr-1.5 size-4" />
              导出
            </Button>
            <Button onClick={() => setUpdatePlanDialogOpen(true)} className="h-11 min-w-28 rounded-xl bg-blue-500 text-white shadow-sm hover:bg-blue-600">
              <RefreshCw className="mr-1.5 size-4" />
              同步计划
            </Button>
            <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }} className="h-11 min-w-28 rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90">
              <Plus className="mr-1.5 size-4" />
              新建任务
            </Button>
          </>
        }
      />
	      <section className="space-y-5">

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_190px]">
            {operationalMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-lg bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', metric.tone)}>
                      <Icon className="size-5" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">运营</span>
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-600">{metric.label}</p>
                  <p className="mt-1 text-3xl font-semibold text-slate-950">{metric.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{metric.helper}</p>
                </div>
              );
            })}
            <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">健康趋势</p>
                  <p className="mt-1 text-xs text-slate-500">基于配置完整度估算</p>
                </div>
                <BarChart3 className="size-5 text-indigo-500" />
              </div>
              <svg viewBox="0 0 180 86" className="mt-4 h-20 w-full">
                <path d={`${trendPath} L 170 82 L 14 82 Z`} fill="#6366f1" opacity="0.12" />
                <path d={trendPath} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {trendPoints.map((point, index) => (
                  <circle key={`${point}-${index}`} cx={14 + index * 26} cy={72 - point * 0.52} r="3" fill="#6366f1" />
                ))}
              </svg>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">任务池结构</h2>
                <p className="mt-1 text-xs text-slate-500">先用配置字段呈现，后续接入计划引用和打卡表现。</p>
              </div>
              <CheckCircle2 className="size-5 text-emerald-500" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md bg-indigo-50 px-3 py-3">
                <p className="text-xs text-indigo-600">每日任务</p>
                <p className="mt-1 text-xl font-semibold text-indigo-950">{dailyTasks.length}</p>
              </div>
              <div className="rounded-md bg-sky-50 px-3 py-3">
                <p className="text-xs text-sky-600">智能分配</p>
                <p className="mt-1 text-xl font-semibold text-sky-950">{flexibleTasks.length}</p>
              </div>
              <div className="rounded-md bg-emerald-50 px-3 py-3">
                <p className="text-xs text-emerald-600">精细记录</p>
                <p className="mt-1 text-xl font-semibold text-emerald-950">{trackedTasks.length}</p>
              </div>
              <div className="rounded-md bg-amber-50 px-3 py-3">
                <p className="text-xs text-amber-600">平均时长</p>
                <p className="mt-1 text-xl font-semibold text-amber-950">{tasks.length ? Math.round(totalMinutes / tasks.length) : 0}m</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">需要关注</h2>
                <p className="mt-1 text-xs text-slate-500">优先补齐配置不完整的任务。</p>
              </div>
              <AlertTriangle className="size-5 text-amber-500" />
            </div>
            <div className="mt-4 space-y-2">
              {attentionTasks.length > 0 ? attentionTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(`/parent/tasks/${task.id}`)}
                  className="flex w-full items-start justify-between gap-3 rounded-md border border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-slate-700">{task.name}</span>
                    <span className="mt-1 block truncate text-[11px] text-slate-400">
                      {getTaskConfigIssues(task).slice(0, 2).join(' · ') || '配置完整'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-amber-600">{getOperationalScore(task)}%</span>
                </button>
              )) : (
                <div className="rounded-md bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">暂无任务</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <FilterBar>
            {tabItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  'h-10 shrink-0 rounded-lg px-4 text-sm font-semibold transition-all duration-200',
                  activeTab === item.key
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                )}
              >
                {item.label}
              </button>
            ))}
      </FilterBar>

      {/* Task Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : (
        <div>
          {tasks.length === 0 ? (
            <EmptyPanel
              icon={ListTodo}
              title="还没有任务"
              description="先创建几个任务，运营看板和学习计划就会开始有内容。"
              action={<Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}><Plus className="size-4" />新建任务</Button>}
            />
          ) : (
            <>
              {activeTab === 'all' && renderTaskCollection(tasks)}
              {activeTab === 'subject' && (
                <div className="space-y-7">
                  {getSubjectGroups().map(group => (
                    <section key={group.subject} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-950">{group.subject}</h2>
                        <span className="text-xs font-medium text-slate-400">{group.tasks.length} 个任务</span>
                      </div>
                      {renderTaskCollection(group.tasks)}
                    </section>
                  ))}
                </div>
              )}
              {activeTab === 'type' && (
                <div className="space-y-7">
                  {getTypeGroups().map(group => (
                    <section key={group.type} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-950">{group.type}</h2>
                        <span className="text-xs font-medium text-slate-400">{group.tasks.length} 个任务</span>
                      </div>
                      {renderTaskCollection(group.tasks)}
                    </section>
                  ))}
                </div>
              )}
              {activeTab === 'completion' && (
                <div className="space-y-7">
                  {getCompletionGroups().map(group => (
                    <section key={group.type} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-950">{group.type}</h2>
                        <span className="text-xs font-medium text-slate-400">{group.tasks.length} 个任务</span>
                      </div>
                      {renderTaskCollection(group.tasks)}
                    </section>
                  ))}
                </div>
              )}
              {activeTab === 'schedule' && (
                <div className="space-y-7">
                  {getScheduleGroups().map(group => (
                    <section key={group.rule} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-950">{group.rule}</h2>
                        <span className="text-xs font-medium text-slate-400">{group.tasks.length} 个任务</span>
                      </div>
                      {renderTaskCollection(group.tasks)}
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        targetRef={pageRef}
        title="导出任务配置"
        filename="任务配置"
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-red-600 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 ml-[52px]">
              确定要删除任务「{taskToDelete?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl h-11 px-6">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && selectedChildId && deleteMutation.mutate({ id: taskToDelete.id, childId: selectedChildId })}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-11 px-6"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[86vh] overflow-y-auto rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              新建任务
            </DialogTitle>
            <DialogDescription>
              先定义任务怎么安排，再补齐能力点和记录方式。能力点必填，后续会用于能力分析和任务推荐。
            </DialogDescription>
          </DialogHeader>
          <TaskEditor
            value={formData}
            onChange={setFormData}
            educationStage={selectedEducationStage}
            childName={selectedChild?.name}
            onCancel={() => setCreateDialogOpen(false)}
            onSubmit={handleCreate}
            isSubmitting={createMutation.isPending}
            submitLabel="创建"
            submittingLabel="创建中..."
          />
        </DialogContent>
      </Dialog>

      {/* Update Plan Dialog */}
      <Dialog open={updatePlanDialogOpen} onOpenChange={setUpdatePlanDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
              更新计划
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className='p-4 bg-blue-50 rounded-xl mb-4'>
              <div className='flex items-start gap-3'>
                <div className='w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0'>
                  <Info className='w-4 h-4 text-blue-600' />
                </div>
                <div className='flex-1'>
                  <div className='text-sm font-medium text-blue-800 mb-1'>提示</div>
                  <div className='text-xs text-blue-700'>
                    此操作将根据任务的最新分配规则更新计划，确保计划与任务设置保持一致。
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">选择周</Label>
              <Select defaultValue="current">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择要更新的周" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">当前周</SelectItem>
                  <SelectItem value="next">下一周</SelectItem>
                  <SelectItem value="all">所有计划</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">选择任务</Label>
              <Select defaultValue="all">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择要更新的任务" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有任务</SelectItem>
                  {tasks.map(task => (
                    <SelectItem key={task.id} value={task.id.toString()}>{task.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={() => setUpdatePlanDialogOpen(false)} className="h-11 px-6 rounded-xl">
              取消
            </Button>
            <Button 
              onClick={async () => {
                try {
                  if (!selectedChildId) {
                    toast.error('请先选择一个孩子');
                    return;
                  }
                  
                  const currentDate = new Date();
                  const weekNo = getWeekNo(currentDate);

                  // 调用API更新计划
                  await apiClient.post('/tasks/publish', {
                    childIds: [selectedChildId],
                    weekNo,
                  });
                  
                  toast.success('计划同步成功');
                  setUpdatePlanDialogOpen(false);
                  
                  // 刷新任务列表
                  queryClient.invalidateQueries({ queryKey: ['tasks'] });
                  // 刷新计划数据
                  queryClient.invalidateQueries({ queryKey: ['weekly-plan'] });
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              }} 
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            >
              同步更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
