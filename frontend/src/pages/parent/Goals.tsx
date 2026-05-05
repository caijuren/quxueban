import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  Lightbulb,
  ArrowRight,
  PencilLine,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageToolbar } from '@/components/parent/PageToolbar';
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
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { defaultReadinessTemplate, getReadinessLayerByText, readinessLayers } from '@/lib/readiness-model';
import {
  defaultGoalDirection,
  getGoalGaps,
  getGoalNextAction,
  getGoalReadinessState,
  goalDirectionOptions,
  inferGoalDirection,
  inferGoalType,
  normalizeReadinessGoal,
} from '@/lib/readiness-goals';
import type { GoalGap, GoalReadinessState } from '@/lib/readiness-goals';

type GoalStatus = 'on-track' | 'attention' | 'strong';

type GoalItem = {
  id?: string;
  title: string;
  description: string;
  level: string;
  abilityCategory: string;
  abilityPoint: string;
  goalDirection?: string;
  goalType?: string;
  goalCycle?: string;
  successCriteria?: string;
  linkedTasks: string[];
  linkedTaskIds?: number[];
  reviewCadence: string;
  progress: number;
  target: string;
  current: string;
  suggestion: string;
  status: GoalStatus;
  reviewNotes?: GoalReviewNote[];
};

type GoalReviewNote = {
  id: string;
  date: string;
  summary: string;
  adjustment: string;
};

type GoalSection = {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tone: string;
  items: GoalItem[];
};

type AbilityOption = {
  categoryId: string;
  categoryLabel: string;
  point: string;
  desc: string;
  tasks: string[];
};

type GoalDraft = GoalItem & {
  source: 'ability-model';
};

type AbilityModelRow = {
  point: string;
  desc?: string;
  tasks?: string[];
};

type AbilityModel = Record<string, AbilityModelRow[]>;

type LinkedTaskOption = {
  id: number;
  name: string;
  category?: string;
  scheduleRule?: string;
  weeklyFrequency?: number | null;
  tags?: {
    abilityCategory?: string;
    abilityPoint?: string;
    linkedGoal?: string;
  };
};

type GoalStatusSummary = {
  total: number;
  strong: number;
  onTrack: number;
  attention: number;
  linked: number;
};

const statusStyles: Record<GoalStatus, { label: string; className: string }> = {
  strong: { label: '领先', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  'on-track': { label: '稳定', className: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  attention: { label: '需关注', className: 'bg-amber-50 text-amber-700 border-amber-100' },
};

const goalTypeOptions = ['能力提升目标', '习惯养成目标', '学科训练目标', '阅读目标', '体育健康目标'];
const goalCycleOptions = ['本周', '本月', '本学期', '四周周期', '自定义周期'];

const goalSections: GoalSection[] = [
  {
    title: '学科目标',
    subtitle: '语文、数学、英语等学科目标与资源建议',
    icon: BookOpen,
    tone: 'bg-indigo-50 text-indigo-600',
    items: [
      {
        title: '语文阅读理解',
        description: '从能力模型的“学科能力/阅读理解”承接，提升信息提取和表达能力。',
        level: 'L3 三年级',
        abilityCategory: '学科能力',
        abilityPoint: '阅读理解',
        linkedTasks: ['章节精读', '三句话复述', '关键词提取'],
        reviewCadence: '每周复盘',
        progress: 72,
        target: '每周 4 次',
        current: '已完成 11/16 次',
        suggestion: '建议继续使用章节复述卡，每次阅读后让孩子讲 3 个关键情节。',
        status: 'on-track',
      },
      {
        title: '数学计算稳定性',
        description: '从能力模型的“学科能力/数学能力”承接，控制基础计算错误率。',
        level: 'L3 三年级',
        abilityCategory: '学科能力',
        abilityPoint: '数学能力',
        linkedTasks: ['限时口算', '错因标记', '二次检查'],
        reviewCadence: '每周复盘',
        progress: 58,
        target: '正确率 90%',
        current: '当前 82%',
        suggestion: '建议增加 10 分钟限时口算，并记录错因分类。',
        status: 'attention',
      },
      {
        title: '英语自然拼读',
        description: '从能力模型的“学科能力/英语能力”承接，巩固常见字母组合和短句朗读。',
        level: 'L2 二年级',
        abilityCategory: '学科能力',
        abilityPoint: '英语能力',
        linkedTasks: ['自然拼读卡', '绘本跟读', '短句朗读'],
        reviewCadence: '双周复盘',
        progress: 81,
        target: '掌握 20 组',
        current: '已掌握 16 组',
        suggestion: '建议搭配绘本朗读，优先复习易混淆发音。',
        status: 'strong',
      },
    ],
  },
  {
    title: '体育与健康目标',
    subtitle: '运动、身高体重与健康反馈',
    icon: Dumbbell,
    tone: 'bg-emerald-50 text-emerald-600',
    items: [
      {
        title: '每周运动达标',
        description: '从能力模型的“体育与健康/基础体能”承接，保持有氧运动和户外活动频率。',
        level: 'L3 三年级',
        abilityCategory: '体育与健康',
        abilityPoint: '基础体能',
        linkedTasks: ['跳绳训练', '户外快走', '核心动作'],
        reviewCadence: '每周复盘',
        progress: 67,
        target: '每周 5 次',
        current: '已完成 3/5 次',
        suggestion: '本周还差 2 次，可安排跳绳或 20 分钟快走。',
        status: 'on-track',
      },
      {
        title: '身体数据跟踪',
        description: '从能力模型的“体育与健康/作息管理”承接，记录身体状态和健康节奏。',
        level: 'L3 三年级',
        abilityCategory: '体育与健康',
        abilityPoint: '作息管理',
        linkedTasks: ['身高体重记录', '睡眠记录', '周末运动'],
        reviewCadence: '每月复盘',
        progress: 45,
        target: '每月 2 次',
        current: '已记录 1 次',
        suggestion: '建议本周末补一次测量，保持同一时间段记录。',
        status: 'attention',
      },
    ],
  },
  {
    title: '思维与认知目标',
    subtitle: '批判性思维、创造力与问题解决能力',
    icon: Brain,
    tone: 'bg-violet-50 text-violet-600',
    items: [
      {
        title: '问题拆解训练',
        description: '从能力模型的“思维与认知/问题理解”承接，用结构化方式表达想法。',
        level: 'L3 三年级',
        abilityCategory: '思维与认知',
        abilityPoint: '问题理解',
        linkedTasks: ['条件标记', '问题复述', '方案比较'],
        reviewCadence: '每周复盘',
        progress: 76,
        target: '每周 3 次',
        current: '已完成 7/9 次',
        suggestion: '建议从生活问题切入，让孩子先提出两个方案再比较。',
        status: 'strong',
      },
      {
        title: '创造力表达',
        description: '从能力模型的“思维与认知/表达输出”承接，通过创作任务训练表达。',
        level: 'L3 三年级',
        abilityCategory: '思维与认知',
        abilityPoint: '表达输出',
        linkedTasks: ['故事续写', '图画表达', '思维导图'],
        reviewCadence: '双周复盘',
        progress: 62,
        target: '每周 2 次',
        current: '已完成 5/8 次',
        suggestion: '建议把阅读笔记转成小故事或思维导图。',
        status: 'on-track',
      },
    ],
  },
  {
    title: '学习习惯目标',
    subtitle: '每日学习时间、复习频率和专注习惯',
    icon: CalendarClock,
    tone: 'bg-amber-50 text-amber-600',
    items: [
      {
        title: '每日固定学习时段',
        description: '从能力模型的“学习习惯/学习计划制定”承接，建立稳定学习节奏。',
        level: 'L3 三年级',
        abilityCategory: '学习习惯',
        abilityPoint: '学习计划制定',
        linkedTasks: ['每日任务清单', '固定开始时间', '完成后反馈'],
        reviewCadence: '每周复盘',
        progress: 84,
        target: '连续 21 天',
        current: '已坚持 18 天',
        suggestion: '继续保持固定开始时间，完成后及时给予正向反馈。',
        status: 'strong',
      },
      {
        title: '错题复盘',
        description: '从能力模型的“学习习惯/复盘与反思”承接，形成错因记录和二次订正习惯。',
        level: 'L3 三年级',
        abilityCategory: '学习习惯',
        abilityPoint: '复盘与反思',
        linkedTasks: ['错因记录', '二次订正', '错题周记'],
        reviewCadence: '每周复盘',
        progress: 52,
        target: '每周 4 次',
        current: '已完成 6/12 次',
        suggestion: '建议把复盘拆成 5 分钟小任务，避免堆积到周末。',
        status: 'attention',
      },
    ],
  },
];

const categoryLabelMap: Record<string, string> = {
  subject: '学科能力',
  thinking: '思维与认知',
  habit: '学习习惯',
  health: '体育与健康',
  delivery: '交付层',
  cognition: '认知层',
  stability: '稳定性层',
};

const fallbackAbilityOptions: AbilityOption[] = goalSections.flatMap(section => (
  section.items.map(goal => ({
    categoryId: goal.abilityCategory,
    categoryLabel: goal.abilityCategory,
    point: goal.abilityPoint,
    desc: goal.description,
    tasks: goal.linkedTasks,
  }))
));

function buildAbilityOptions(model?: AbilityModel | null): AbilityOption[] {
  if (!model) return fallbackAbilityOptions;

  const options = Object.entries(model).flatMap(([categoryId, rows]) => (
    Array.isArray(rows)
      ? rows.map(row => ({
          categoryId,
          categoryLabel: categoryLabelMap[categoryId] || categoryId,
          point: row.point,
          desc: row.desc || '',
          tasks: Array.isArray(row.tasks) ? row.tasks : [],
        }))
      : []
  )).filter(option => option.point);

  return options.length > 0 ? options : fallbackAbilityOptions;
}

function buildGoalFromAbility(option: AbilityOption): GoalDraft {
  const firstTask = option.tasks[0] || `${option.point}练习`;
  return {
    id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'ability-model',
    title: `${option.point}提升目标`,
    description: `从能力模型的“${option.categoryLabel}/${option.point}”承接，${option.desc || '围绕该能力点建立阶段目标。'}`,
    level: 'L3 三年级',
    abilityCategory: option.categoryLabel,
    abilityPoint: option.point,
    goalDirection: inferGoalDirection(option.categoryLabel, option.point),
    goalType: '能力提升目标',
    goalCycle: '四周周期',
    successCriteria: `连续执行 ${firstTask}，并能看到该能力点有稳定推进。`,
    linkedTasks: option.tasks.length > 0 ? option.tasks.slice(0, 3) : [firstTask],
    linkedTaskIds: [],
    reviewCadence: '每周复盘',
    progress: 0,
    target: '每周 3 次',
    current: '尚未开始',
    suggestion: '建议先拆成小任务，连续执行一周后再调整目标强度。',
    status: 'attention',
  };
}

function buildGoalFromTemplate(template: GoalItem): GoalDraft {
  return {
    ...template,
    id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'ability-model',
    goalDirection: template.goalDirection || inferGoalDirection(template.abilityCategory, template.abilityPoint),
    goalType: template.goalType || inferGoalType(template),
    goalCycle: template.goalCycle || '四周周期',
    successCriteria: template.successCriteria || template.target,
    progress: 0,
    current: '尚未开始',
    status: 'attention',
    linkedTaskIds: [],
  };
}

function buildBlankGoal(): GoalDraft {
  return {
    id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'ability-model',
    title: '',
    description: '',
    level: 'L3 三年级',
    abilityCategory: '',
    abilityPoint: '',
    goalDirection: defaultGoalDirection,
    goalType: '能力提升目标',
    goalCycle: '四周周期',
    successCriteria: '',
    linkedTasks: [],
    linkedTaskIds: [],
    reviewCadence: '每周复盘',
    progress: 0,
    target: '',
    current: '尚未开始',
    suggestion: '',
    status: 'attention',
  };
}

function normalizeGoalDraft(goal: GoalDraft): GoalDraft {
  return normalizeReadinessGoal(goal) as GoalDraft;
}

async function getAbilityModel(): Promise<AbilityModel | null> {
  const response = await apiClient.get('/settings/ability-model');
  return response.data.data || null;
}

async function getGoals(childId: number): Promise<GoalDraft[]> {
  const response = await apiClient.get('/settings/goals', { params: { childId } });
  const goals = response.data.data || [];
  return Array.isArray(goals) ? goals.map(normalizeGoalDraft) : [];
}

async function saveGoals({ childId, goals }: { childId: number; goals: GoalDraft[] }): Promise<GoalDraft[]> {
  const response = await apiClient.put('/settings/goals', { childId, goals });
  return response.data.data || [];
}

async function getTasks(childId: number): Promise<LinkedTaskOption[]> {
  const response = await apiClient.get('/tasks', { params: { childId } });
  return response.data.data || [];
}

function getTaskDefaultsForGoal(goal: GoalItem) {
  if (goal.abilityCategory === '体育与健康') {
    return { category: '体育运动', subject: 'sports', taskKind: '运动', trackingType: 'numeric', trackingUnit: '分钟', targetValue: 20 };
  }
  if (goal.abilityPoint.includes('英语') || goal.abilityCategory.includes('英语')) {
    return { category: '英语阅读', subject: 'english', taskKind: '阅读', trackingType: 'numeric', trackingUnit: '分钟', targetValue: 15 };
  }
  if (goal.abilityPoint.includes('阅读') || goal.abilityPoint.includes('表达')) {
    return { category: '中文阅读', subject: 'chinese', taskKind: '阅读', trackingType: 'simple', trackingUnit: '', targetValue: 0 };
  }
  if (goal.abilityPoint.includes('数学') || goal.title.includes('数学')) {
    return { category: '校内巩固', subject: 'math', taskKind: '学习', trackingType: 'numeric', trackingUnit: '题', targetValue: 10 };
  }
  return { category: '校内巩固', subject: 'chinese', taskKind: '学习', trackingType: 'simple', trackingUnit: '', targetValue: 0 };
}

async function createTaskFromGoal({ childId, goal, taskName }: { childId: number; goal: GoalItem; taskName: string }): Promise<LinkedTaskOption> {
  const defaults = getTaskDefaultsForGoal(goal);
  const response = await apiClient.post('/tasks', {
    childId,
    name: taskName,
    category: defaults.category,
    type: '固定',
    timePerUnit: defaults.targetValue || 20,
    weeklyFrequency: 5,
    trackingType: defaults.trackingType,
    trackingUnit: defaults.trackingUnit,
    targetValue: defaults.targetValue,
    appliesTo: [childId],
    tags: {
      subject: defaults.subject,
      parentRole: 'accompany',
      difficulty: 'basic',
      scheduleRule: 'daily',
      taskKind: defaults.taskKind,
      level: goal.level,
      abilityCategory: goal.abilityCategory,
      abilityPoint: goal.abilityPoint,
      linkedGoal: goal.title,
    },
  });
  return response.data.data;
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white p-5 shadow-sm', className)}>
      {children}
    </section>
  );
}

function ProgressBar({ value, tone = 'bg-indigo-500' }: { value: number; tone?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${value}%` }} />
    </div>
  );
}

function GoalMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-xl font-semibold tabular-nums text-slate-950">{value}</p>
            <p className="truncate text-xs text-slate-500">{hint}</p>
          </div>
        </div>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </Panel>
  );
}

function GoalDialogShell({
  children,
  onClose,
  maxWidth = 'max-w-xl',
}: {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" />
      <div
        className={cn('relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl', maxWidth)}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function GoalDialogHeader({
  eyebrow,
  title,
  description,
  onClose,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold text-slate-500">{eyebrow}</p> : null}
        <h3 className="mt-1 text-lg font-semibold text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg">
        <X className="h-5 w-5" />
      </Button>
    </div>
  );
}

function GoalCard({
  goal,
  onManageTasks,
  onEdit,
  onReview,
  onDelete,
  onViewAbility,
  onViewReadiness,
}: {
  goal: GoalItem;
  onManageTasks?: (goal: GoalItem) => void;
  onEdit?: (goal: GoalItem) => void;
  onReview?: (goal: GoalItem) => void;
  onDelete?: (goal: GoalItem) => void;
  onViewAbility?: (goal: GoalItem) => void;
  onViewReadiness?: (goal: GoalItem) => void;
}) {
  const status = statusStyles[goal.status];
  const tone = goal.status === 'strong' ? 'bg-emerald-500' : goal.status === 'attention' ? 'bg-amber-500' : 'bg-indigo-500';
  const latestReview = goal.reviewNotes?.[0];
  const readinessLayer = getReadinessLayerByText(goal.abilityCategory, goal.abilityPoint, goal.title, goal.description);
  const visibleTasks = goal.linkedTasks.slice(0, 3);
  const hiddenTaskCount = Math.max(0, goal.linkedTasks.length - visibleTasks.length);
  const gaps = getGoalGaps(goal);
  const readinessState = getGoalReadinessState(goal);
  const nextAction = getGoalNextAction(goal);
  const linkedTaskTotal = (goal.linkedTaskIds || []).length;
  const handlePrimaryAction = () => {
    if (nextAction === '关联任务') {
      onManageTasks?.(goal);
      return;
    }
    if (nextAction === '做一次复盘' || nextAction === '记录复盘') {
      onReview?.(goal);
      return;
    }
    if (nextAction === '保持节奏') {
      onViewReadiness?.(goal);
      return;
    }
    onEdit?.(goal);
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-center">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-950">{goal.title}</h3>
            <Badge variant="outline" className={cn('shrink-0 rounded-md px-2 py-0 text-[11px]', status.className)}>
              {status.label}
            </Badge>
            <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">{goal.goalDirection || defaultGoalDirection}</span>
            <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1', readinessLayer.softTone)}>{readinessLayer.label}</span>
            <span className="shrink-0 rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">{readinessState}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="truncate font-medium text-slate-700">{goal.abilityPoint || '未设置能力点'}</span>
            {goal.goalType ? <span>{goal.goalType}</span> : null}
            {goal.goalCycle ? <span>{goal.goalCycle}</span> : null}
            <span>{goal.reviewCadence}</span>
            <span>支撑任务 {linkedTaskTotal} 个</span>
            {latestReview ? <span>最近复盘 {latestReview.date}</span> : null}
          </div>
          <div className="grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
            <p className="rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-100">成功标准：{goal.successCriteria || goal.target || '未设置'}</p>
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={!goal.id}
              className="rounded-md bg-teal-50 px-2 py-1 text-left font-semibold text-teal-700 ring-1 ring-teal-100 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              下一步：{nextAction}
            </button>
          </div>
          {gaps.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {gaps.slice(0, 4).map((gap) => (
                <span key={gap.label} className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                  {gap.label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {visibleTasks.map((task) => (
              <span key={task} className="max-w-[160px] truncate rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                {task}
              </span>
            ))}
            {hiddenTaskCount > 0 ? (
              <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                +{hiddenTaskCount}
              </span>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-slate-500">{goal.current}</span>
            <span className="font-semibold tabular-nums text-slate-900">{goal.progress}%</span>
          </div>
          <ProgressBar value={goal.progress} tone={tone} />
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button variant="outline" size="sm" onClick={() => onEdit?.(goal)} disabled={!onEdit} className="h-7 rounded-md bg-white px-2 text-xs">
              编辑
            </Button>
            <Button variant="outline" size="sm" onClick={() => onReview?.(goal)} disabled={!onReview} className="h-7 rounded-md bg-white px-2 text-xs">
              复盘
            </Button>
            <Button variant="outline" size="sm" onClick={() => onManageTasks?.(goal)} disabled={!onManageTasks} className="h-7 rounded-md bg-white px-2 text-xs">
              关联任务
            </Button>
            <Button variant="outline" size="sm" onClick={() => onViewReadiness?.(goal)} disabled={!onViewReadiness} className="h-7 rounded-md bg-white px-2 text-xs">
              准备
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onViewAbility?.(goal)} disabled={!onViewAbility} className="h-7 w-7 rounded-md text-slate-500">
              <Target className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete?.(goal)} disabled={!onDelete} className="h-7 w-7 rounded-md text-red-600 hover:text-red-700">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function GoalSectionCard({
  section,
  onManageTasks,
  onEdit,
  onReview,
  onDelete,
  onViewAbility,
  onViewReadiness,
}: {
  section: GoalSection;
  onManageTasks?: (goal: GoalItem) => void;
  onEdit?: (goal: GoalItem) => void;
  onReview?: (goal: GoalItem) => void;
  onDelete?: (goal: GoalItem) => void;
  onViewAbility?: (goal: GoalItem) => void;
  onViewReadiness?: (goal: GoalItem) => void;
}) {
  const Icon = section.icon;

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', section.tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{section.title}</h2>
          <p className="text-xs text-slate-500">{section.subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">
        {section.items.map((goal) => (
          <GoalCard
            key={goal.id || goal.title}
            goal={goal}
            onManageTasks={goal.id ? onManageTasks : undefined}
            onEdit={goal.id ? onEdit : undefined}
            onReview={goal.id ? onReview : undefined}
            onDelete={goal.id ? onDelete : undefined}
            onViewAbility={goal.id ? onViewAbility : undefined}
            onViewReadiness={goal.id ? onViewReadiness : undefined}
          />
        ))}
      </div>
    </Panel>
  );
}

function GoalStatusSummaryCard({ summary }: { summary: GoalStatusSummary }) {
  const rows = [
    { label: '领先目标', value: summary.strong, className: 'bg-emerald-500' },
    { label: '稳定目标', value: summary.onTrack, className: 'bg-indigo-500' },
    { label: '需关注', value: summary.attention, className: 'bg-amber-500' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">真实目标</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">已关联任务</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{summary.linked}</p>
        </div>
      </div>
      {rows.map((row) => {
        const percent = summary.total > 0 ? Math.round((row.value / summary.total) * 100) : 0;
        return (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">{row.label}</span>
              <span className="text-slate-500">{row.value} 个 · {percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={cn('h-full rounded-full', row.className)} style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
      {summary.total === 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-500">
          创建真实目标并关联任务后，这里会显示目标状态分布。历史趋势需要后续按日期保存快照后再启用。
        </p>
      )}
    </div>
  );
}
export default function GoalsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedChild } = useSelectedChild();
  const queryClient = useQueryClient();
  const handledAbilityCreateKeyRef = useRef<string | null>(null);
  const [selectedAbility, setSelectedAbility] = useState<AbilityOption | null>(null);
  const [draftForm, setDraftForm] = useState<GoalDraft | null>(null);
  const [taskManageGoal, setTaskManageGoal] = useState<GoalItem | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [reviewGoal, setReviewGoal] = useState<GoalItem | null>(null);
  const [reviewForm, setReviewForm] = useState({ summary: '', adjustment: '' });
  const [goalToDelete, setGoalToDelete] = useState<GoalItem | null>(null);
  const [showCreateAssist, setShowCreateAssist] = useState(false);
  const { data: savedAbilityModel } = useQuery({
    queryKey: ['ability-model'],
    queryFn: getAbilityModel,
  });
  const { data: goalDrafts = [], isLoading: isGoalsLoading } = useQuery({
    queryKey: ['goals', selectedChild?.id],
    queryFn: () => getGoals(selectedChild!.id),
    enabled: !!selectedChild?.id,
  });
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks', selectedChild?.id],
    queryFn: () => getTasks(selectedChild!.id),
    enabled: !!selectedChild?.id,
  });
  const saveGoalsMutation = useMutation({
    mutationFn: saveGoals,
    onSuccess: (savedGoals, variables) => {
      queryClient.setQueryData(['goals', variables.childId], savedGoals);
      toast.success('目标已保存');
    },
    onError: (error) => {
      toast.error(`保存失败：${getErrorMessage(error)}`);
    },
  });
  const createGoalTasksMutation = useMutation({
    mutationFn: async ({ childId, goal }: { childId: number; goal: GoalItem }) => {
      const existingNames = new Set(tasks.map(task => task.name.trim()));
      const candidateNames = (goal.linkedTasks.length > 0 ? goal.linkedTasks : [`${goal.abilityPoint}练习`])
        .map(task => task.trim())
        .filter(Boolean)
        .filter(task => !existingNames.has(task))
        .slice(0, 6);

      if (candidateNames.length === 0) {
        return [] as LinkedTaskOption[];
      }

      return Promise.all(candidateNames.map(taskName => createTaskFromGoal({ childId, goal, taskName })));
    },
    onError: (error) => {
      toast.error(`生成失败：${getErrorMessage(error)}`);
    },
  });
  const abilityOptions = useMemo(() => buildAbilityOptions(savedAbilityModel), [savedAbilityModel]);
  const recommendedGoalTemplates = useMemo(() => goalSections.flatMap(section => section.items), []);
  const orderedGoals = useMemo(() => {
    const getPriority = (goal: GoalDraft) => {
      if (goal.status === 'attention') return 0;
      if ((goal.linkedTaskIds || []).length === 0) return 1;
      if (goal.progress === 0) return 2;
      return 3;
    };
    return [...goalDrafts].sort((a, b) => getPriority(a) - getPriority(b) || a.title.localeCompare(b.title, 'zh-Hans-CN'));
  }, [goalDrafts]);
  const dynamicGoalSections = useMemo<GoalSection[]>(() => (
    orderedGoals.length > 0
      ? [
          {
            title: '当前目标',
            subtitle: '按需关注、未绑定任务、待推进的顺序排列',
            icon: Target,
            tone: 'bg-blue-50 text-blue-600',
            items: orderedGoals,
          },
        ]
      : []
  ), [orderedGoals]);
  const allGoals = goalDrafts;
  const linkedTaskCount = new Set(allGoals.flatMap(goal => goal.linkedTaskIds || [])).size;
  const statusSummary = useMemo<GoalStatusSummary>(() => ({
    total: allGoals.length,
    strong: allGoals.filter(goal => goal.status === 'strong').length,
    onTrack: allGoals.filter(goal => goal.status === 'on-track').length,
    attention: allGoals.filter(goal => goal.status === 'attention').length,
    linked: allGoals.filter(goal => (goal.linkedTaskIds || []).length > 0).length,
  }), [allGoals]);
  const directionSummary = useMemo(() => {
    const counts = new Map<string, number>();
    allGoals.forEach(goal => {
      const direction = goal.goalDirection || defaultGoalDirection;
      counts.set(direction, (counts.get(direction) || 0) + 1);
    });
    return goalDirectionOptions.map(direction => ({
      direction,
      count: counts.get(direction) || 0,
    }));
  }, [allGoals]);
  const readinessCoverage = useMemo(() => readinessLayers.map((layer) => {
    const goals = allGoals.filter(goal => getReadinessLayerByText(goal.abilityCategory, goal.abilityPoint, goal.title, goal.description).id === layer.id);
    return {
      layer,
      goals,
      linkedCount: goals.filter(goal => (goal.linkedTaskIds || []).length > 0).length,
    };
  }), [allGoals]);
  const goalsMissingSuccessCriteria = allGoals.filter(goal => !goal.successCriteria?.trim() && !goal.target?.trim()).length;
  const goalsMissingAbility = allGoals.filter(goal => !goal.abilityCategory || !goal.abilityPoint).length;
  const primaryGap = allGoals.length === 0
    ? '先创建目标'
    : goalsMissingAbility > 0
      ? '补能力点'
      : goalsMissingSuccessCriteria > 0
        ? '补成功标准'
        : statusSummary.linked < statusSummary.total
          ? '关联任务'
          : statusSummary.attention > 0
            ? '复盘需关注目标'
            : '保持节奏';
  const stableProgressCount = allGoals.filter(goal => goal.status !== 'attention' && goal.progress > 0).length;
  const stabilityLabel = allGoals.length === 0
    ? '待建立'
    : statusSummary.attention > 0
      ? '需调整'
      : statusSummary.linked < statusSummary.total
        ? '待绑定'
        : '稳定推进';
  const actionSuggestions = useMemo(() => {
    if (allGoals.length === 0) {
      return [
        { title: '先建立真实目标', desc: '从能力模型或推荐模板创建 1-3 个阶段目标，再关联任务管理里的真实任务。', icon: Target },
        { title: '避免一次建太多', desc: '首版建议每个孩子保留少量重点目标，方便后续复盘和调整。', icon: Lightbulb },
      ];
    }

    const suggestions: Array<{ title: string; desc: string; icon: React.ElementType }> = [];
    if (statusSummary.linked < statusSummary.total) {
      suggestions.push({
        title: '补齐任务关联',
        desc: `还有 ${statusSummary.total - statusSummary.linked} 个目标没有关联任务，关联后才能自动计算进度。`,
        icon: Target,
      });
    }
    if (statusSummary.attention > 0) {
      suggestions.push({
        title: '优先复盘需关注目标',
        desc: `当前有 ${statusSummary.attention} 个目标进度偏低，建议记录复盘并调整任务频率。`,
        icon: HeartPulse,
      });
    }
    if (statusSummary.strong > 0) {
      suggestions.push({
        title: '保留稳定节奏',
        desc: `${statusSummary.strong} 个目标表现领先，可以保持当前任务安排，避免额外加压。`,
        icon: Sparkles,
      });
    }

    return suggestions.slice(0, 3);
  }, [allGoals.length, statusSummary]);

  const openBlankGoal = () => {
    setSelectedAbility(null);
    setDraftForm(buildBlankGoal());
    setEditingGoalId(null);
  };

  useEffect(() => {
    const category = searchParams.get('category');
    const point = searchParams.get('point');
    if (!category || !point || draftForm) return;
    const key = `${category}::${point}`;
    if (handledAbilityCreateKeyRef.current === key) return;
    handledAbilityCreateKeyRef.current = key;

    openCreateGoal({
      categoryId: category,
      categoryLabel: category,
      point,
      desc: '',
      tasks: [`${point}练习`],
    });
  }, [searchParams, draftForm]);

  const openCreateGoal = (option: AbilityOption) => {
    const nextGoal = buildGoalFromAbility(option);
    setSelectedAbility(option);
    setDraftForm(nextGoal);
    setEditingGoalId(null);
  };

  const openCreateGoalFromTemplate = (template: GoalItem) => {
    setSelectedAbility({
      categoryId: template.abilityCategory,
      categoryLabel: template.abilityCategory,
      point: template.abilityPoint,
      desc: template.description,
      tasks: template.linkedTasks,
    });
    setDraftForm(buildGoalFromTemplate(template));
    setEditingGoalId(null);
  };

  const openEditGoal = (goal: GoalItem) => {
    if (!goal.id) return;
    setSelectedAbility({
      categoryId: goal.abilityCategory,
      categoryLabel: goal.abilityCategory,
      point: goal.abilityPoint,
      desc: goal.description,
      tasks: goal.linkedTasks,
    });
    setEditingGoalId(goal.id);
    setDraftForm({ ...goal, source: 'ability-model' });
  };

  const openReviewGoal = (goal: GoalItem) => {
    setReviewGoal(goal);
    setReviewForm({ summary: '', adjustment: '' });
  };

  const viewAbilityPoint = (goal: GoalItem) => {
    const params = new URLSearchParams({
      category: goal.abilityCategory,
      point: goal.abilityPoint,
    });
    navigate(`/parent/ability-model?${params.toString()}`);
  };

  const viewGoalReadiness = (goal: GoalItem) => {
    const params = new URLSearchParams({
      goal: goal.title,
      category: goal.abilityCategory,
      point: goal.abilityPoint,
    });
    navigate(`/parent/growth-dashboard?${params.toString()}`);
  };

  const openManageTasks = (goal: GoalItem) => {
    setTaskManageGoal(goal);
    setSelectedTaskIds(goal.linkedTaskIds || []);
  };

  const saveDraftGoal = ({ manageTasksAfterSave = false }: { manageTasksAfterSave?: boolean } = {}) => {
    if (!draftForm) return;
    if (!selectedChild?.id) {
      toast.error('请先选择孩子');
      return;
    }
    if (!draftForm.title.trim()) {
      toast.error('请填写目标名称');
      return;
    }
    const normalizedDraft = normalizeGoalDraft(draftForm);
    const nextDrafts = editingGoalId
      ? goalDrafts.map(goal => goal.id === editingGoalId ? { ...normalizedDraft, id: editingGoalId } : goal)
      : [...goalDrafts, normalizedDraft];
    saveGoalsMutation.mutate(
      { childId: selectedChild.id, goals: nextDrafts },
      {
        onSuccess: () => {
          if (manageTasksAfterSave) {
            setTaskManageGoal(normalizedDraft);
            setSelectedTaskIds(normalizedDraft.linkedTaskIds || []);
          }
          setDraftForm(null);
          setSelectedAbility(null);
          setEditingGoalId(null);
        },
      }
    );
  };

  const deleteGoal = () => {
    if (!selectedChild?.id || !goalToDelete?.id) {
      toast.error('请先选择目标');
      return;
    }

    const nextDrafts = goalDrafts.filter(goal => goal.id !== goalToDelete.id);
    saveGoalsMutation.mutate(
      { childId: selectedChild.id, goals: nextDrafts },
      {
        onSuccess: () => setGoalToDelete(null),
      }
    );
  };

  const saveReviewNote = () => {
    if (!selectedChild?.id || !reviewGoal?.id) {
      toast.error('请先选择目标');
      return;
    }
    if (!reviewForm.summary.trim() && !reviewForm.adjustment.trim()) {
      toast.error('请填写复盘内容');
      return;
    }

    const note: GoalReviewNote = {
      id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toLocaleDateString('en-CA'),
      summary: reviewForm.summary.trim(),
      adjustment: reviewForm.adjustment.trim(),
    };
    const nextDrafts = goalDrafts.map(goal => (
      goal.id === reviewGoal.id
        ? { ...goal, reviewNotes: [note, ...(goal.reviewNotes || [])].slice(0, 30) }
        : goal
    ));

    saveGoalsMutation.mutate(
      { childId: selectedChild.id, goals: nextDrafts },
      {
        onSuccess: () => {
          setReviewGoal(null);
          setReviewForm({ summary: '', adjustment: '' });
        },
      }
    );
  };

  const saveLinkedTasks = () => {
    if (!selectedChild?.id || !taskManageGoal?.id) {
      toast.error('请先选择目标');
      return;
    }

    const selectedTasks = tasks.filter(task => selectedTaskIds.includes(task.id));
    const nextDrafts = goalDrafts.map(goal => (
      goal.id === taskManageGoal.id
        ? {
            ...goal,
            linkedTaskIds: selectedTaskIds,
            linkedTasks: selectedTasks.length > 0 ? selectedTasks.map(task => task.name) : goal.linkedTasks,
          }
        : goal
    ));

    saveGoalsMutation.mutate(
      { childId: selectedChild.id, goals: nextDrafts },
      {
        onSuccess: () => {
          setTaskManageGoal(null);
          setSelectedTaskIds([]);
        },
      }
    );
  };

  const generateTasksForGoal = () => {
    if (!selectedChild?.id || !taskManageGoal?.id) {
      toast.error('请先选择目标');
      return;
    }

    createGoalTasksMutation.mutate(
      { childId: selectedChild.id, goal: taskManageGoal },
      {
        onSuccess: (createdTasks) => {
          if (createdTasks.length === 0) {
            toast.info('建议任务已存在，无需重复生成');
            return;
          }

          const createdTaskIds = createdTasks.map(task => task.id);
          const nextSelectedTaskIds = [...new Set([...selectedTaskIds, ...createdTaskIds])];
          const createdTaskNames = createdTasks.map(task => task.name);
          const nextDrafts = goalDrafts.map(goal => (
            goal.id === taskManageGoal.id
              ? {
                  ...goal,
                  linkedTaskIds: nextSelectedTaskIds,
                  linkedTasks: [...new Set([...goal.linkedTasks, ...createdTaskNames])],
                }
              : goal
          ));

          saveGoalsMutation.mutate(
            { childId: selectedChild.id, goals: nextDrafts },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['tasks', selectedChild.id] });
                setSelectedTaskIds(nextSelectedTaskIds);
                toast.success(`已生成 ${createdTasks.length} 个任务并关联目标`);
              },
            }
          );
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-[1360px] space-y-5">
      <PageToolbar
        left={
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <Target className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-950">目标准备工作台</h1>
              <p className="truncate text-xs text-slate-500 sm:text-sm">
                {selectedChild?.name || '当前孩子'}的目标方向、三层能力点、支撑任务和下一步动作
              </p>
            </div>
          </div>
        }
        right={
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (selectedChild?.id) {
                  queryClient.invalidateQueries({ queryKey: ['goals', selectedChild.id] });
                }
                queryClient.invalidateQueries({ queryKey: ['ability-model'] });
              }}
              variant="secondary"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              同步数据
            </Button>
            <Button onClick={openBlankGoal} disabled={isGoalsLoading || saveGoalsMutation.isPending}>
              <PencilLine className="mr-2 h-4 w-4" />
              创建目标
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold text-teal-700">当前目标方向</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{defaultReadinessTemplate.name}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                目标管理只承接方向、能力点、支撑任务和下一步动作，不输出录取概率、排名或目标校适配分。
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-100">
              主要缺口：{primaryGap}
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-5">
            {directionSummary.map((item) => (
              <div key={item.direction} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="truncate text-sm font-semibold text-slate-900">{item.direction}</p>
                <p className="mt-1 text-xs text-slate-500">{item.count} 个目标</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-teal-700">三层覆盖</p>
              <h2 className="mt-1 text-base font-semibold text-slate-950">目标是否支撑三层模型</h2>
            </div>
            <Button variant="outline" className="h-9 rounded-lg bg-white" onClick={() => navigate('/parent/ability-model')}>
              三层准备度
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {readinessCoverage.map(({ layer, goals, linkedCount }) => (
              <div key={layer.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold ring-1', layer.softTone)}>{layer.label}</span>
                  <span className="text-xs font-semibold text-slate-700">{goals.length} 个目标 · {linkedCount} 个有任务</span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">{layer.question}：{layer.description}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: '真实目标', value: allGoals.length, hint: '已保存到当前孩子', icon: Target, tone: 'bg-teal-50 text-teal-700' },
          { label: '已绑定任务', value: linkedTaskCount, hint: `${statusSummary.linked}/${statusSummary.total} 个目标已绑定`, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
          { label: '需关注目标', value: statusSummary.attention, hint: '需要复盘或调整', icon: HeartPulse, tone: 'bg-amber-50 text-amber-600' },
          { label: '推进稳定性', value: stabilityLabel, hint: `${stableProgressCount}/${allGoals.length} 个已推进`, icon: ShieldCheck, tone: 'bg-sky-50 text-sky-700' },
        ].map((item) => (
          <GoalMetricCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {isGoalsLoading ? (
            <Panel>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">正在加载目标...</div>
            </Panel>
          ) : dynamicGoalSections.length > 0 ? (
            dynamicGoalSections.map((section) => (
              <GoalSectionCard
                key={section.title}
                section={section}
                onManageTasks={openManageTasks}
                onEdit={openEditGoal}
                onReview={openReviewGoal}
                onDelete={setGoalToDelete}
                onViewAbility={viewAbilityPoint}
                onViewReadiness={viewGoalReadiness}
              />
            ))
          ) : (
            <Panel>
              <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Target className="h-10 w-10 text-slate-300" />
                <h2 className="mt-4 text-base font-semibold text-slate-950">还没有真实目标</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  先创建 1-3 个当前阶段最重要的目标，再为目标绑定任务。目标会按关联任务打卡自动计算进度。
                </p>
                <Button onClick={openBlankGoal} className="mt-4">
                  创建目标
                </Button>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <button
              type="button"
              onClick={() => setShowCreateAssist((value) => !value)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Brain className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-950">创建辅助</h2>
                  <p className="truncate text-xs text-slate-500">从三层能力点或模板生成目标</p>
                </div>
              </div>
              <Badge variant="outline" className="rounded-md bg-white px-2 py-0 text-[11px] text-slate-600">
                {showCreateAssist ? '收起' : '展开'}
              </Badge>
            </button>
            {showCreateAssist && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">三层能力点承接</p>
                <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
              {abilityOptions.slice(0, 12).map((option) => (
                <button
                  key={`${option.categoryLabel}-${option.point}`}
                  type="button"
                  onClick={() => openCreateGoal(option)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-teal-200 hover:bg-teal-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{option.point}</p>
                      <p className="truncate text-[11px] text-slate-500">{option.categoryLabel}</p>
                    </div>
                    <Badge variant="outline" className="rounded-md bg-white px-1.5 py-0 text-[11px] text-teal-700">选用</Badge>
                  </div>
                </button>
              ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">推荐目标模板</p>
                <div className="max-h-48 space-y-1.5 overflow-auto pr-1">
                  {recommendedGoalTemplates.slice(0, 12).map((goal) => {
                    const layer = getReadinessLayerByText(goal.abilityCategory, goal.abilityPoint, goal.title, goal.description);
                    return (
                      <button
                        key={`${goal.abilityCategory}-${goal.title}`}
                        type="button"
                        onClick={() => openCreateGoalFromTemplate(goal)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-sky-200 hover:bg-sky-50"
                      >
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900">{goal.title}</p>
                            <p className="truncate text-[11px] text-slate-500">{goal.abilityPoint}</p>
                          </div>
                          <span className={cn('shrink-0 rounded-md px-1.5 py-0 text-[11px] font-semibold ring-1', layer.softTone)}>
                            {layer.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            )}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">目标状态分布</h2>
                <p className="text-xs text-slate-500">近 28 天打卡进度</p>
              </div>
              <Badge variant="outline" className="rounded-md bg-teal-50 px-2 py-0 text-[11px] text-teal-700">已接入打卡</Badge>
            </div>
            <div className="mt-3">
              <GoalStatusSummaryCard summary={statusSummary} />
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">下一步动作</h2>
                <p className="text-xs text-slate-500">根据真实目标生成</p>
              </div>
            </div>
            <div className="space-y-2">
              {actionSuggestions.map(({ title, desc, icon: Icon }) => (
                <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex gap-2.5">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{title}</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">数据口径</h2>
                <p className="text-xs text-slate-500">目标计算规则</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-900">进度来源</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">只统计目标已关联任务的近 28 天打卡记录，并保留目标方向、层级和能力点。</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-900">完成计分</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">完成/提前/补做计 1 次，部分完成计 0.5 次。</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-900">后续扩展</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">阅读、运动和报告复盘数据后续作为证据来源接入，不输出目标校适配分。</p>
              </div>
            </div>
          </Panel>

        </div>
      </div>

      {draftForm && (
        <GoalDialogShell onClose={() => { setDraftForm(null); setSelectedAbility(null); setEditingGoalId(null); }}>
            <GoalDialogHeader
              eyebrow={`${selectedAbility?.categoryLabel || '能力模型'} · ${selectedAbility?.point || '目标'}`}
              title={editingGoalId ? '编辑目标' : '创建目标'}
              description={editingGoalId ? '修改目标内容后，会继续保留已关联任务和复盘记录。' : '目标会保存到当前孩子档案，后续可继续关联任务和计划。'}
              onClose={() => { setDraftForm(null); setSelectedAbility(null); setEditingGoalId(null); }}
            />
            <div className="flex-1 space-y-4 overflow-auto p-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">目标名称</span>
                <input
                  value={draftForm.title}
                  onChange={(event) => setDraftForm({ ...draftForm, title: event.target.value })}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">目标方向</span>
                  <select
                    value={draftForm.goalDirection || defaultGoalDirection}
                    onChange={(event) => setDraftForm({ ...draftForm, goalDirection: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  >
                    {goalDirectionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">目标类型</span>
                  <select
                    value={draftForm.goalType || goalTypeOptions[0]}
                    onChange={(event) => setDraftForm({ ...draftForm, goalType: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  >
                    {goalTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">目标周期</span>
                  <select
                    value={draftForm.goalCycle || goalCycleOptions[0]}
                    onChange={(event) => setDraftForm({ ...draftForm, goalCycle: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  >
                    {goalCycleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">所属层级</span>
                  <select
                    value={draftForm.abilityCategory || '交付层'}
                    onChange={(event) => setDraftForm({
                      ...draftForm,
                      abilityCategory: event.target.value,
                      goalDirection: draftForm.goalDirection || inferGoalDirection(event.target.value, draftForm.abilityPoint),
                    })}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  >
                    {readinessLayers.map((layer) => <option key={layer.id} value={layer.label}>{layer.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">能力点</span>
                  <input
                    value={draftForm.abilityPoint}
                    onChange={(event) => setDraftForm({
                      ...draftForm,
                      abilityPoint: event.target.value,
                      goalDirection: draftForm.goalDirection || inferGoalDirection(draftForm.abilityCategory, event.target.value),
                    })}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">阶段目标</span>
                  <input
                    value={draftForm.target}
                    onChange={(event) => setDraftForm({ ...draftForm, target: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">复盘节奏</span>
                  <input
                    value={draftForm.reviewCadence}
                    onChange={(event) => setDraftForm({ ...draftForm, reviewCadence: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">目标描述</span>
                <textarea
                  value={draftForm.description}
                  onChange={(event) => setDraftForm({ ...draftForm, description: event.target.value })}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">完成标准</span>
                <textarea
                  value={draftForm.successCriteria || ''}
                  onChange={(event) => setDraftForm({ ...draftForm, successCriteria: event.target.value })}
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">建议任务</span>
                <textarea
                  value={draftForm.linkedTasks.join('\n')}
                  onChange={(event) => setDraftForm({ ...draftForm, linkedTasks: event.target.value.split('\n').map(item => item.trim()).filter(Boolean) })}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <Button variant="outline" onClick={() => { setDraftForm(null); setSelectedAbility(null); setEditingGoalId(null); }} className="rounded-lg bg-white">取消</Button>
              <Button variant="outline" onClick={() => saveDraftGoal({ manageTasksAfterSave: true })} disabled={saveGoalsMutation.isPending || !selectedChild?.id} className="rounded-lg bg-white">
                {saveGoalsMutation.isPending ? '保存中...' : '保存并关联任务'}
              </Button>
              <Button onClick={() => saveDraftGoal()} disabled={saveGoalsMutation.isPending}>
                {saveGoalsMutation.isPending ? '保存中...' : editingGoalId ? '保存修改' : '保存目标'}
              </Button>
            </div>
        </GoalDialogShell>
      )}

      {taskManageGoal && (
        <GoalDialogShell onClose={() => { setTaskManageGoal(null); setSelectedTaskIds([]); }} maxWidth="max-w-2xl">
            <GoalDialogHeader
              eyebrow={`${taskManageGoal.abilityCategory} · ${taskManageGoal.abilityPoint}`}
              title="关联任务"
              description={`为“${taskManageGoal.title}”选择当前孩子已有任务。`}
              onClose={() => { setTaskManageGoal(null); setSelectedTaskIds([]); }}
            />

            <div className="flex-1 overflow-auto p-5">
              {isTasksLoading ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">正在加载任务...</div>
              ) : tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <Target className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-900">当前孩子还没有任务</p>
                  <p className="mt-1 text-xs text-slate-500">可以先到任务管理创建任务，再回到目标页关联。</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const checked = selectedTaskIds.includes(task.id);
                    const isRecommended = task.tags?.abilityPoint === taskManageGoal.abilityPoint || task.tags?.linkedGoal === taskManageGoal.title;
                    return (
                      <label
                        key={task.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition',
                          checked ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50 hover:border-teal-100 hover:bg-teal-50/40'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setSelectedTaskIds(current => (
                              event.target.checked
                                ? [...new Set([...current, task.id])]
                                : current.filter(id => id !== task.id)
                            ));
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-950">{task.name}</p>
                            {isRecommended && (
                              <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700">推荐</span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {task.category || '未分类'} · {task.scheduleRule === 'daily' ? '每日任务' : task.scheduleRule === 'weekend' ? '周末任务' : task.scheduleRule === 'school' ? '上学日任务' : '灵活任务'}
                            {task.weeklyFrequency ? ` · 每周 ${task.weeklyFrequency} 次` : ''}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs text-slate-500">已选择 {selectedTaskIds.length} 个任务</p>
                <button
                  type="button"
                  onClick={generateTasksForGoal}
                  disabled={createGoalTasksMutation.isPending || saveGoalsMutation.isPending}
                  className="mt-1 text-xs font-medium text-teal-700 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createGoalTasksMutation.isPending ? '正在生成建议任务...' : '没有合适任务时生成建议任务'}
                </button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setTaskManageGoal(null); setSelectedTaskIds([]); }}>取消</Button>
                <Button onClick={saveLinkedTasks} disabled={saveGoalsMutation.isPending}>
                  {saveGoalsMutation.isPending ? '保存中...' : '保存关联'}
                </Button>
              </div>
            </div>
        </GoalDialogShell>
      )}

      {reviewGoal && (
        <GoalDialogShell onClose={() => { setReviewGoal(null); setReviewForm({ summary: '', adjustment: '' }); }}>
            <GoalDialogHeader
              eyebrow={`${reviewGoal.abilityCategory} · ${reviewGoal.abilityPoint}`}
              title="目标复盘"
              description={`记录“${reviewGoal.title}”的阶段表现和下一步调整。`}
              onClose={() => { setReviewGoal(null); setReviewForm({ summary: '', adjustment: '' }); }}
            />

            <div className="flex-1 space-y-4 overflow-auto p-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">本次复盘</span>
                <textarea
                  value={reviewForm.summary}
                  onChange={(event) => setReviewForm({ ...reviewForm, summary: event.target.value })}
                  rows={4}
                  placeholder="例如：本周完成率稳定，但复述质量不够，需要增加口头表达练习。"
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">下一步调整</span>
                <textarea
                  value={reviewForm.adjustment}
                  onChange={(event) => setReviewForm({ ...reviewForm, adjustment: event.target.value })}
                  rows={3}
                  placeholder="例如：下周保留每日阅读，把每周一次复述改为两次。"
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
              </label>

              {reviewGoal.reviewNotes && reviewGoal.reviewNotes.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">历史复盘</p>
                  <div className="mt-3 space-y-2">
                    {reviewGoal.reviewNotes.slice(0, 5).map((note) => (
                      <div key={note.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                        <p className="font-semibold text-slate-900">{note.date}</p>
                        {note.summary && <p className="mt-1">{note.summary}</p>}
                        {note.adjustment && <p className="mt-1 text-slate-500">调整：{note.adjustment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <Button variant="outline" onClick={() => { setReviewGoal(null); setReviewForm({ summary: '', adjustment: '' }); }}>取消</Button>
              <Button onClick={saveReviewNote} disabled={saveGoalsMutation.isPending}>
                {saveGoalsMutation.isPending ? '保存中...' : '保存复盘'}
              </Button>
            </div>
        </GoalDialogShell>
      )}

      <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除目标</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除“{goalToDelete?.title || '当前目标'}”？删除后会移除目标、关联任务记录和复盘记录，但不会删除任务管理里的任务。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteGoal}
              disabled={saveGoalsMutation.isPending}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saveGoalsMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
