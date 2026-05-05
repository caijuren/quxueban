import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, BookOpen, Calculator, Dumbbell, Languages, BookMarked, Users, Star, ListTodo, Download, Send, RefreshCw, Info, ClipboardList, Activity, AlertTriangle, Clock3, CalendarDays, ArrowRight, CheckCircle2 } from 'lucide-react';
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
import { getReadinessLayerByText, readinessLayers } from '@/lib/readiness-model';
import type { ReadinessLayerId } from '@/lib/readiness-model';
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
  const [searchParams] = useSearchParams();
  const handledAbilityCreateKeyRef = useRef<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [updatePlanDialogOpen, setUpdatePlanDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { selectedChildId, selectedChild } = useSelectedChild();
  const [formData, setFormData] = useState<TaskEditorFormData>(() => createDefaultTaskEditorFormData(selectedChild?.educationStage));
  // 使用localStorage存储当前选中的选项卡
  const [activeTab, setActiveTab] = useState<'all' | 'readiness' | 'subject' | 'type' | 'completion' | 'schedule'>(() => {
    const savedTab = localStorage.getItem('tasksActiveTab');
    return (savedTab as 'all' | 'readiness' | 'subject' | 'type' | 'completion' | 'schedule') || 'all';
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

  useEffect(() => {
    const category = searchParams.get('category');
    const point = searchParams.get('point');
    if (!category || !point) return;
    const key = `${category}::${point}`;
    if (handledAbilityCreateKeyRef.current === key) return;
    handledAbilityCreateKeyRef.current = key;

    setFormData({
      ...createDefaultTaskEditorFormData(selectedEducationStage),
      name: `${point}练习`,
      abilityCategory: category,
      abilityPoint: point,
    });
    setActiveTab('readiness');
    setCreateDialogOpen(true);
  }, [searchParams, selectedEducationStage]);
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
  const getReadinessGroups = () => {
    return readinessLayers.map(layer => {
      const layerTasks = tasks.filter(task => getTaskReadinessLayer(task).id === layer.id);
      return { layer, tasks: layerTasks };
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
  const getTaskReadinessLayer = (task: Task) => getReadinessLayerByText(
    task.tags?.abilityCategory,
    task.tags?.abilityPoint,
    task.tags?.targetType,
    task.category,
    task.name
  );

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
      tone: 'bg-slate-100 text-slate-700',
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
      tone: taskHealthScore >= 70 ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700',
    },
    {
      label: '待关注任务',
      value: incompleteConfigTasks.length,
      helper: '缺少能力、目标或记录配置',
      icon: AlertTriangle,
      tone: 'bg-rose-50 text-rose-600',
    },
  ];

  const layerCounts = readinessLayers.reduce((acc, layer) => {
    acc[layer.id] = tasks.filter(task => getTaskReadinessLayer(task).id === layer.id).length;
    return acc;
  }, {} as Record<ReadinessLayerId, number>);
  const taskPoolStatus = tasks.length === 0
    ? {
        label: '待建立',
        title: '先创建当前孩子的核心任务',
        description: '任务池还没有内容，新建任务后再同步学习计划。',
        tone: 'border-slate-200 bg-slate-50 text-slate-700',
      }
    : incompleteConfigTasks.length > 0
      ? {
          label: '需处理',
          title: `有 ${incompleteConfigTasks.length} 个任务需要补配置`,
          description: '优先补能力点、目标和记录方式，再同步到计划。',
          tone: 'border-amber-200 bg-amber-50 text-amber-800',
        }
      : {
          label: '可维护',
          title: '任务池配置基本完整',
          description: '可以继续新建任务，或同步计划保持本周安排一致。',
          tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        };
  const topAttentionTasks = attentionTasks.filter(task => getTaskConfigIssues(task).length > 0);
  const currentTabCount = (() => {
    if (activeTab === 'readiness') return getReadinessGroups().reduce((sum, group) => sum + group.tasks.length, 0);
    if (activeTab === 'subject') return getSubjectGroups().reduce((sum, group) => sum + group.tasks.length, 0);
    if (activeTab === 'type') return getTypeGroups().reduce((sum, group) => sum + group.tasks.length, 0);
    if (activeTab === 'completion') return getCompletionGroups().reduce((sum, group) => sum + group.tasks.length, 0);
    if (activeTab === 'schedule') return getScheduleGroups().reduce((sum, group) => sum + group.tasks.length, 0);
    return tasks.length;
  })();

  const tabItems: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'all', label: '全部任务' },
    { key: 'readiness', label: '按层级' },
    { key: 'subject', label: '按学科' },
    { key: 'type', label: '按类型' },
    { key: 'completion', label: '完成方式' },
    { key: 'schedule', label: '分配规则' },
  ];

  const renderTaskCard = (task: Task) => {
    const visual = getTaskVisual(task);
    const layer = getTaskReadinessLayer(task);
    const issues = getTaskConfigIssues(task);
    const Icon = visual.Icon;
    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate(`/parent/tasks/${task.id}`)}
        className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1', visual.tone)}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-950">{task.name}</h3>
              <p className="mt-1 truncate text-xs font-medium text-slate-500">{getSubjectLabel(task)}</p>
            </div>
          </div>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1', layer.softTone)}>{layer.label}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-100">
            {getSubjectLabel(task)}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-100">
            {task.category}
          </span>
          {task.tags?.abilityPoint ? (
            <span className="inline-flex min-w-0 max-w-full items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 ring-1 ring-indigo-100">
              <span className="truncate">{task.tags.abilityPoint}</span>
            </span>
          ) : issues.length > 0 ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 ring-1 ring-amber-100">
              待补配置
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50/70 p-3 text-xs text-slate-500">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            <span className="truncate">{getScheduleLabel(task)}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Clock3 className="size-3.5" />
            <span className="truncate">预计 {task.timePerUnit || 30} 分钟</span>
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="truncate text-xs text-slate-500">
            {issues.length > 0 ? issues.slice(0, 2).join(' · ') : getParentRoleLabel(task)}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                handlePushTaskToDingtalk(task.id);
              }}
              className="h-8 rounded-lg bg-white px-2 text-xs text-slate-600"
            >
              <Send className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant={issues.length > 0 ? 'secondary' : 'outline'}
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/parent/tasks/${task.id}`);
              }}
              className="h-8 rounded-lg bg-white px-2.5 text-xs"
            >
              {issues.length > 0 ? '补配置' : '详情'}
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderTaskCollection = (items: Task[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(renderTaskCard)}</div>
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
            <Button onClick={() => setExportDialogOpen(true)} variant="outline" className="h-11 min-w-28 rounded-lg bg-white">
              <Download className="mr-1.5 size-4" />
              导出
            </Button>
            <Button onClick={() => setUpdatePlanDialogOpen(true)} variant="secondary" className="h-11 min-w-28 rounded-lg">
              <RefreshCw className="mr-1.5 size-4" />
              同步计划
            </Button>
            <Button variant="outline" onClick={() => navigate('/parent/task-templates')} className="h-11 min-w-28 rounded-lg bg-white">
              <ClipboardList className="mr-1.5 size-4" />
              任务模板
            </Button>
            <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }} className="h-11 min-w-28 rounded-lg">
              <Plus className="mr-1.5 size-4" />
              新建任务
            </Button>
          </>
        }
      />
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-950">任务池状态</h2>
                <span className={cn('rounded-md border px-2 py-0.5 text-xs font-semibold', taskPoolStatus.tone)}>
                  {taskPoolStatus.label}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-700">{taskPoolStatus.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{taskPoolStatus.description}</p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[520px]">
              {operationalMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', metric.tone)}>
                        <Icon className="size-3.5" />
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{metric.value}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-400">{metric.helper}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr] xl:grid-cols-[1.1fr_1fr]">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">任务结构</h3>
                  <p className="mt-1 text-xs text-slate-500">用于判断任务池是否能支撑计划和记录。</p>
                </div>
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['每日任务', dailyTasks.length],
                  ['智能分配', flexibleTasks.length],
                  ['精细记录', trackedTasks.length],
                  ['平均时长', `${tasks.length ? Math.round(totalMinutes / tasks.length) : 0}m`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-slate-100 bg-white px-3 py-2">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">三层分布</h3>
                  <p className="mt-1 text-xs text-slate-500">作为筛选视角，不抢任务列表主线。</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('readiness')} className="h-8 rounded-lg bg-white">
                  查看
                </Button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {readinessLayers.map((layer) => {
                  const Icon = layer.icon;
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => setActiveTab('readiness')}
                      className="rounded-md border border-slate-100 bg-white px-3 py-2 text-left transition hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md ring-1', layer.softTone)}>
                          <Icon className="size-3.5" />
                        </span>
                        <span className="text-lg font-semibold text-slate-950">{layerCounts[layer.id] || 0}</span>
                      </div>
                      <p className="mt-2 truncate text-xs font-semibold text-slate-800">{layer.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">优先处理</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">先补配置不完整的任务，再做新建和同步。</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <AlertTriangle className="size-4" />
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {topAttentionTasks.length > 0 ? topAttentionTasks.map((task) => {
              const issues = getTaskConfigIssues(task);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(`/parent/tasks/${task.id}`)}
                  className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-amber-200 hover:bg-amber-50/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{task.name}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{issues.slice(0, 3).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                    {getOperationalScore(task)}%
                  </span>
                </button>
              );
            }) : (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                当前没有高优先级配置问题
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">任务工作区</h2>
            <p className="mt-1 text-xs text-slate-500">查看、维护和同步当前孩子的真实任务池。</p>
          </div>
          <span className="w-fit rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            当前 {currentTabCount} / 全部 {tasks.length}
          </span>
        </div>
      </section>

      <FilterBar
      >
            {tabItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  'h-10 shrink-0 rounded-lg px-4 text-sm font-semibold transition-all duration-200',
                  activeTab === item.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
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
              {activeTab === 'readiness' && (
                <div className="space-y-7">
                  {getReadinessGroups().map(group => (
                    <section key={group.layer.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-semibold text-slate-950">{group.layer.label} · {group.layer.english}</h2>
                          <p className="mt-1 text-xs text-slate-500">{group.layer.description}</p>
                        </div>
                        <span className="text-xs font-medium text-slate-400">{group.tasks.length} 个任务</span>
                      </div>
                      {renderTaskCollection(group.tasks)}
                    </section>
                  ))}
                </div>
              )}
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
        <AlertDialogContent className="rounded-lg border border-slate-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-lg font-semibold text-slate-950">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <Trash2 className="size-5" />
              </span>
              删除任务
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              确定要删除任务「{taskToDelete?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="h-11 rounded-lg px-6">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && selectedChildId && deleteMutation.mutate({ id: taskToDelete.id, childId: selectedChildId })}
              className="h-11 rounded-lg bg-destructive px-6 text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto rounded-lg border border-slate-200 shadow-2xl sm:max-w-[760px]">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-slate-950">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plus className="size-5" />
              </span>
              新建任务
            </DialogTitle>
            <DialogDescription className="text-slate-500">
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
        <DialogContent className="rounded-lg border border-slate-200 shadow-2xl sm:max-w-[500px]">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-slate-950">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <RefreshCw className="size-5" />
              </span>
              同步计划
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              根据当前任务池的分配规则，把学习计划更新到一致状态。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className='mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4'>
              <div className='flex items-start gap-3'>
                <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-slate-600'>
                  <Info className='size-4' />
                </div>
                <div className='flex-1'>
                  <div className='mb-1 text-sm font-medium text-slate-900'>同步范围</div>
                  <div className='text-xs leading-5 text-slate-500'>
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
            <Button variant="outline" onClick={() => setUpdatePlanDialogOpen(false)} className="h-11 rounded-lg px-6">
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
              className="h-11 rounded-lg px-6"
            >
              同步更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
