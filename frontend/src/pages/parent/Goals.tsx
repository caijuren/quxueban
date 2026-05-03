import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  Lightbulb,
  PenLine,
  PencilLine,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { getReadinessLayerByText, readinessLayers } from '@/lib/readiness-model';

type GoalStatus = 'on-track' | 'attention' | 'strong';

type GoalItem = {
  id?: string;
  title: string;
  description: string;
  level: string;
  abilityCategory: string;
  abilityPoint: string;
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
    progress: 0,
    current: '尚未开始',
    status: 'attention',
    linkedTaskIds: [],
  };
}

async function getAbilityModel(): Promise<AbilityModel | null> {
  const response = await apiClient.get('/settings/ability-model');
  return response.data.data || null;
}

async function getGoals(childId: number): Promise<GoalDraft[]> {
  const response = await apiClient.get('/settings/goals', { params: { childId } });
  return response.data.data || [];
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
    <section className={cn('rounded-2xl border border-border bg-white p-5 shadow-sm', className)}>
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

function GoalCard({
  goal,
  onManageTasks,
  onEdit,
  onReview,
  onDelete,
  onViewAbility,
}: {
  goal: GoalItem;
  onManageTasks?: (goal: GoalItem) => void;
  onEdit?: (goal: GoalItem) => void;
  onReview?: (goal: GoalItem) => void;
  onDelete?: (goal: GoalItem) => void;
  onViewAbility?: (goal: GoalItem) => void;
}) {
  const status = statusStyles[goal.status];
  const tone = goal.status === 'strong' ? 'bg-emerald-500' : goal.status === 'attention' ? 'bg-amber-500' : 'bg-indigo-500';
  const latestReview = goal.reviewNotes?.[0];
  const readinessLayer = getReadinessLayerByText(goal.abilityCategory, goal.abilityPoint, goal.title, goal.description);

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-950">{goal.title}</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-600 ring-1 ring-indigo-100">{goal.level}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', readinessLayer.softTone)}>{readinessLayer.label}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{goal.description}</p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 rounded-full', status.className)}>
          {status.label}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_110px] md:items-center">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">{goal.current}</span>
            <span className="font-semibold text-slate-900">{goal.progress}%</span>
          </div>
          <ProgressBar value={goal.progress} tone={tone} />
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-xs">
          <p className="text-slate-500">目标</p>
          <p className="mt-1 font-semibold text-slate-900">{goal.target}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-white p-3 text-xs">
          <p className="font-semibold text-slate-900">关联能力</p>
          <p className="mt-1 text-slate-500">{readinessLayer.label} · {goal.abilityPoint}</p>
        </div>
        <div className="rounded-lg bg-white p-3 text-xs">
          <p className="font-semibold text-slate-900">复盘节奏</p>
          <p className="mt-1 text-slate-500">{goal.reviewCadence}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {goal.linkedTasks.map((task) => (
          <span key={task} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-100">
            {task}
          </span>
        ))}
      </div>
      <div className="mt-4 flex gap-2 rounded-lg bg-white p-3 text-xs leading-5 text-slate-600">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span>{goal.suggestion}</span>
      </div>
      {latestReview && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-slate-600">
          <p className="font-semibold text-blue-700">最近复盘 · {latestReview.date}</p>
          <p className="mt-1">{latestReview.summary}</p>
          {latestReview.adjustment && <p className="mt-1 text-slate-500">调整：{latestReview.adjustment}</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit?.(goal)}
          disabled={!onEdit}
          className="h-8 rounded-lg bg-white text-xs"
        >
          <PenLine className="mr-1.5 h-3.5 w-3.5" />
          编辑
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReview?.(goal)}
          disabled={!onReview}
          className="h-8 rounded-lg bg-white text-xs"
        >
          复盘
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewAbility?.(goal)}
          disabled={!onViewAbility}
          className="h-8 rounded-lg bg-white text-xs"
        >
          查看能力点
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onManageTasks?.(goal)}
          disabled={!onManageTasks}
          className="h-8 rounded-lg bg-white text-xs"
        >
          管理关联任务
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete?.(goal)}
          disabled={!onDelete}
          className="h-8 rounded-lg bg-white text-xs text-red-600 hover:text-red-700"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          删除
        </Button>
      </div>
    </div>
  );
}

function GoalSectionCard({
  section,
  onManageTasks,
  onEdit,
  onReview,
  onDelete,
  onViewAbility,
}: {
  section: GoalSection;
  onManageTasks?: (goal: GoalItem) => void;
  onEdit?: (goal: GoalItem) => void;
  onReview?: (goal: GoalItem) => void;
  onDelete?: (goal: GoalItem) => void;
  onViewAbility?: (goal: GoalItem) => void;
}) {
  const Icon = section.icon;

  return (
    <Panel>
      <div className="mb-4 flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', section.tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{section.title}</h2>
          <p className="mt-1 text-xs text-slate-500">{section.subtitle}</p>
        </div>
      </div>
      <div className="space-y-3">
        {section.items.map((goal) => (
          <GoalCard
            key={goal.id || goal.title}
            goal={goal}
            onManageTasks={goal.id ? onManageTasks : undefined}
            onEdit={goal.id ? onEdit : undefined}
            onReview={goal.id ? onReview : undefined}
            onDelete={goal.id ? onDelete : undefined}
            onViewAbility={goal.id ? onViewAbility : undefined}
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
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">真实目标</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{summary.total}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
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
        <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-500">
          创建真实目标并关联任务后，这里会显示目标状态分布。历史趋势需要后续按日期保存快照后再启用。
        </p>
      )}
    </div>
  );
}
export default function GoalsPage() {
  const navigate = useNavigate();
  const { selectedChild } = useSelectedChild();
  const queryClient = useQueryClient();
  const [selectedAbility, setSelectedAbility] = useState<AbilityOption | null>(null);
  const [draftForm, setDraftForm] = useState<GoalDraft | null>(null);
  const [taskManageGoal, setTaskManageGoal] = useState<GoalItem | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [reviewGoal, setReviewGoal] = useState<GoalItem | null>(null);
  const [reviewForm, setReviewForm] = useState({ summary: '', adjustment: '' });
  const [goalToDelete, setGoalToDelete] = useState<GoalItem | null>(null);
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
  const recommendedGoalGroups = useMemo(() => readinessLayers.map((layer) => ({
    layer,
    goals: recommendedGoalTemplates.filter((goal) => getReadinessLayerByText(goal.abilityCategory, goal.abilityPoint, goal.title, goal.description).id === layer.id),
  })).filter((group) => group.goals.length > 0), [recommendedGoalTemplates]);
  const dynamicGoalSections = useMemo<GoalSection[]>(() => (
    goalDrafts.length > 0
      ? [
          {
            title: '当前目标',
            subtitle: '当前孩子已确认并保存的目标，进度按关联任务打卡自动计算',
            icon: Target,
            tone: 'bg-blue-50 text-blue-600',
            items: goalDrafts,
          },
        ]
      : []
  ), [goalDrafts]);
  const allGoals = goalDrafts;
  const averageProgress = allGoals.length > 0 ? Math.round(allGoals.reduce((sum, goal) => sum + goal.progress, 0) / allGoals.length) : 0;
  const strongCount = allGoals.filter(goal => goal.status === 'strong').length;
  const attentionCount = allGoals.filter(goal => goal.status === 'attention').length;
  const statusSummary = useMemo<GoalStatusSummary>(() => ({
    total: allGoals.length,
    strong: allGoals.filter(goal => goal.status === 'strong').length,
    onTrack: allGoals.filter(goal => goal.status === 'on-track').length,
    attention: allGoals.filter(goal => goal.status === 'attention').length,
    linked: allGoals.filter(goal => (goal.linkedTaskIds || []).length > 0).length,
  }), [allGoals]);
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

  const openManageTasks = (goal: GoalItem) => {
    setTaskManageGoal(goal);
    setSelectedTaskIds(goal.linkedTaskIds || []);
  };

  const saveDraftGoal = () => {
    if (!draftForm) return;
    if (!selectedChild?.id) {
      toast.error('请先选择孩子');
      return;
    }
    if (!draftForm.title.trim()) {
      toast.error('请填写目标名称');
      return;
    }
    const nextDrafts = editingGoalId
      ? goalDrafts.map(goal => goal.id === editingGoalId ? { ...draftForm, id: editingGoalId } : goal)
      : [...goalDrafts, draftForm];
    saveGoalsMutation.mutate(
      { childId: selectedChild.id, goals: nextDrafts },
      {
        onSuccess: () => {
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-950">目标管理</h1>
              <p className="truncate text-xs text-slate-500 sm:text-sm">
                {selectedChild?.name || '当前孩子'}的交付、认知、稳定性目标，关联任务、阶段进度和复盘建议
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
            <Button
              onClick={() => abilityOptions[0] && openCreateGoal(abilityOptions[0])}
              disabled={isGoalsLoading || saveGoalsMutation.isPending}
            >
              <PencilLine className="mr-2 h-4 w-4" />
              从能力点创建
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: '真实目标', value: allGoals.length, hint: '已保存到当前孩子', icon: Target, tone: 'bg-indigo-50 text-indigo-600' },
          { label: '综合进度', value: `${averageProgress}%`, hint: '真实目标平均', icon: TrendingUp, tone: 'bg-blue-50 text-blue-600' },
          { label: '领先目标', value: strongCount, hint: '建议继续强化', icon: Sparkles, tone: 'bg-emerald-50 text-emerald-600' },
          { label: '需关注目标', value: attentionCount, hint: '需要调整策略', icon: HeartPulse, tone: 'bg-amber-50 text-amber-600' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Panel key={item.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', item.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5 xl:grid-cols-2">
          {isGoalsLoading ? (
            <Panel className="xl:col-span-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">正在加载目标...</div>
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
              />
            ))
          ) : (
            <Panel className="xl:col-span-2">
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <Target className="h-10 w-10 text-slate-300" />
                <h2 className="mt-4 text-base font-semibold text-slate-950">还没有真实目标</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  可以从右侧能力点或推荐模板创建目标。创建后目标会保存到当前孩子档案，并按关联任务打卡自动计算进度。
                </p>
                <Button onClick={() => abilityOptions[0] && openCreateGoal(abilityOptions[0])} className="mt-4">
                  从能力点创建
                </Button>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          <Panel>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">能力模型承接</h2>
                <p className="mt-1 text-xs text-slate-500">从能力点生成目标，再关联任务执行</p>
              </div>
            </div>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {abilityOptions.slice(0, 12).map((option) => (
                <button
                  key={`${option.categoryLabel}-${option.point}`}
                  type="button"
                  onClick={() => openCreateGoal(option)}
                  className="w-full rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{option.point}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{option.categoryLabel}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full bg-white text-violet-700">创建</Badge>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">目标状态分布</h2>
                <p className="mt-1 text-xs text-slate-500">基于真实目标和近 28 天打卡进度</p>
              </div>
              <Badge variant="outline" className="rounded-full bg-indigo-50 text-indigo-700">已接入打卡</Badge>
            </div>
            <div className="mt-4">
              <GoalStatusSummaryCard summary={statusSummary} />
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">推荐目标模板</h2>
                <p className="mt-1 text-xs text-slate-500">模板不进入统计，确认后才成为真实目标</p>
              </div>
            </div>
            <div className="max-h-80 space-y-4 overflow-auto pr-1">
              {recommendedGoalGroups.map((group) => {
                const Icon = group.layer.icon;
                return (
                  <div key={group.layer.id} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className={cn('flex size-7 items-center justify-center rounded-lg ring-1', group.layer.softTone)}>
                        <Icon className="size-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{group.layer.label}</p>
                        <p className="text-[11px] text-slate-500">{group.layer.question}</p>
                      </div>
                    </div>
                    {group.goals.slice(0, 4).map((goal) => (
                      <button
                        key={`${goal.abilityCategory}-${goal.title}`}
                        type="button"
                        onClick={() => openCreateGoalFromTemplate(goal)}
                        className="w-full rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{goal.title}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{goal.abilityPoint}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 rounded-full bg-white text-indigo-700">使用</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">下一步动作</h2>
                <p className="mt-1 text-xs text-slate-500">根据真实目标状态生成</p>
              </div>
            </div>
            <div className="space-y-3">
              {actionSuggestions.map(({ title, desc, icon: Icon }) => (
                <div key={title} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">数据口径</h2>
                <p className="mt-1 text-xs text-slate-500">当前版本的目标计算规则</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-sm font-semibold text-slate-900">进度来源</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">只统计目标已关联任务的近 28 天打卡记录；未关联任务的目标不会自动推进。</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-sm font-semibold text-slate-900">完成计分</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">完成、提前、补做按 1 次计入，部分完成按 0.5 次计入，不参与不计入分母。</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-sm font-semibold text-slate-900">后续扩展</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">阅读、运动和报告复盘数据会在后续版本接入目标进度。</p>
              </div>
            </div>
          </Panel>

        </div>
      </div>

      {draftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setDraftForm(null); setSelectedAbility(null); setEditingGoalId(null); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 p-5">
              <div>
                <p className="text-xs font-semibold text-violet-600">{selectedAbility?.categoryLabel} · {selectedAbility?.point}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{editingGoalId ? '编辑目标' : '从能力点创建目标'}</h3>
                <p className="mt-1 text-sm text-slate-500">{editingGoalId ? '修改目标内容后，会继续保留已关联任务和复盘记录。' : '目标会保存到当前孩子档案，后续可继续关联任务和计划。'}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setDraftForm(null); setSelectedAbility(null); setEditingGoalId(null); }} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 space-y-4 overflow-auto p-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">目标名称</span>
                <input
                  value={draftForm.title}
                  onChange={(event) => setDraftForm({ ...draftForm, title: event.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">目标描述</span>
                <textarea
                  value={draftForm.description}
                  onChange={(event) => setDraftForm({ ...draftForm, description: event.target.value })}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">阶段目标</span>
                  <input
                    value={draftForm.target}
                    onChange={(event) => setDraftForm({ ...draftForm, target: event.target.value })}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">复盘节奏</span>
                  <input
                    value={draftForm.reviewCadence}
                    onChange={(event) => setDraftForm({ ...draftForm, reviewCadence: event.target.value })}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">建议任务</span>
                <textarea
                  value={draftForm.linkedTasks.join('\n')}
                  onChange={(event) => setDraftForm({ ...draftForm, linkedTasks: event.target.value.split('\n').map(item => item.trim()).filter(Boolean) })}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-5">
              <Button variant="outline" onClick={() => { setDraftForm(null); setSelectedAbility(null); setEditingGoalId(null); }} className="rounded-xl bg-white">取消</Button>
              <Button onClick={saveDraftGoal} disabled={saveGoalsMutation.isPending}>
                {saveGoalsMutation.isPending ? '保存中...' : editingGoalId ? '保存修改' : '保存目标'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {taskManageGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setTaskManageGoal(null); setSelectedTaskIds([]); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative z-10 flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 p-5">
              <div>
                <p className="text-xs font-semibold text-indigo-600">{taskManageGoal.abilityCategory} · {taskManageGoal.abilityPoint}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">关联任务</h3>
                <p className="mt-1 text-sm text-slate-500">为“{taskManageGoal.title}”选择当前孩子已有任务。</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setTaskManageGoal(null); setSelectedTaskIds([]); }} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">没有合适任务时，可以直接生成</p>
                  <p className="mt-1 text-xs text-slate-500">会根据目标里的建议任务创建到当前孩子的任务管理中。</p>
                </div>
                <Button
                  onClick={generateTasksForGoal}
                  disabled={createGoalTasksMutation.isPending || saveGoalsMutation.isPending}
                  className="shrink-0"
                >
                  {createGoalTasksMutation.isPending ? '生成中...' : '生成建议任务'}
                </Button>
              </div>

              {isTasksLoading ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">正在加载任务...</div>
              ) : tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
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
                          'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                          checked ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100 bg-slate-50/70 hover:border-indigo-100 hover:bg-indigo-50/40'
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
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-950">{task.name}</p>
                            {isRecommended && (
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">推荐</span>
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

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 p-5">
              <p className="text-xs text-slate-500">已选择 {selectedTaskIds.length} 个任务</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setTaskManageGoal(null); setSelectedTaskIds([]); }}>取消</Button>
                <Button onClick={saveLinkedTasks} disabled={saveGoalsMutation.isPending}>
                  {saveGoalsMutation.isPending ? '保存中...' : '保存关联'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reviewGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setReviewGoal(null); setReviewForm({ summary: '', adjustment: '' }); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative z-10 flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 p-5">
              <div>
                <p className="text-xs font-semibold text-blue-600">{reviewGoal.abilityCategory} · {reviewGoal.abilityPoint}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">目标复盘</h3>
                <p className="mt-1 text-sm text-slate-500">记录“{reviewGoal.title}”的阶段表现和下一步调整。</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setReviewGoal(null); setReviewForm({ summary: '', adjustment: '' }); }} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-auto p-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">本次复盘</span>
                <textarea
                  value={reviewForm.summary}
                  onChange={(event) => setReviewForm({ ...reviewForm, summary: event.target.value })}
                  rows={4}
                  placeholder="例如：本周完成率稳定，但复述质量不够，需要增加口头表达练习。"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">下一步调整</span>
                <textarea
                  value={reviewForm.adjustment}
                  onChange={(event) => setReviewForm({ ...reviewForm, adjustment: event.target.value })}
                  rows={3}
                  placeholder="例如：下周保留每日阅读，把每周一次复述改为两次。"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>

              {reviewGoal.reviewNotes && reviewGoal.reviewNotes.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">历史复盘</p>
                  <div className="mt-3 space-y-2">
                    {reviewGoal.reviewNotes.slice(0, 5).map((note) => (
                      <div key={note.id} className="rounded-lg bg-white p-3 text-xs leading-5 text-slate-600">
                        <p className="font-semibold text-slate-900">{note.date}</p>
                        {note.summary && <p className="mt-1">{note.summary}</p>}
                        {note.adjustment && <p className="mt-1 text-slate-500">调整：{note.adjustment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-5">
              <Button variant="outline" onClick={() => { setReviewGoal(null); setReviewForm({ summary: '', adjustment: '' }); }}>取消</Button>
              <Button onClick={saveReviewNote} disabled={saveGoalsMutation.isPending}>
                {saveGoalsMutation.isPending ? '保存中...' : '保存复盘'}
              </Button>
            </div>
          </div>
        </div>
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
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {saveGoalsMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
