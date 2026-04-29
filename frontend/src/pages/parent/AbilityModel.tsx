import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Brain,
  CalendarCheck,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  FileText,
  Flag,
  GraduationCap,
  Lightbulb,
  ListChecks,
  PenLine,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageToolbar, PageToolbarTitle } from '@/components/parent/PageToolbar';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiClient, getErrorMessage } from '@/lib/api-client';

const levels = [
  {
    id: 'L1',
    name: '一年级',
    shortName: 'L1',
    age: '一年级',
    focus: '适应小学节奏',
    time: '10-15 分钟',
    parentRole: '高陪伴',
    summary: '适应小学学习节奏，建立听讲、书写、阅读和任务完成的基本习惯。',
  },
  {
    id: 'L2',
    name: '二年级',
    shortName: 'L2',
    age: '二年级',
    focus: '巩固基础习惯',
    time: '15-25 分钟',
    parentRole: '陪伴引导',
    summary: '巩固语数英基础和日常学习习惯，开始关注正确率、专注度和完成质量。',
  },
  {
    id: 'L3',
    name: '三年级',
    shortName: 'L3',
    age: '三年级',
    focus: '提升理解与复盘',
    time: '20-35 分钟',
    parentRole: '策略支持',
    summary: '从基础完成进入能力提升，重点看阅读理解、错因分析、表达和简单复盘。',
  },
  {
    id: 'L4',
    name: '四年级',
    shortName: 'L4',
    age: '四年级',
    focus: '形成自主学习',
    time: '30-45 分钟',
    parentRole: '低中介入',
    summary: '逐步形成自主学习意识，能参与计划制定，并开始做阶段目标管理。',
  },
  {
    id: 'L5',
    name: '五年级',
    shortName: 'L5',
    age: '五年级',
    focus: '强化规划与迁移',
    time: '45-60 分钟',
    parentRole: '阶段复盘',
    summary: '面向高年级学习要求，强化知识迁移、时间规划、复盘和长期目标执行。',
  },
] as const;

type LevelId = typeof levels[number]['id'];

const levelStats: Record<LevelId, { mastered: number; progressing: number; pending: number; progress: number }> = {
  L1: { mastered: 9, progressing: 5, pending: 4, progress: 50 },
  L2: { mastered: 10, progressing: 5, pending: 3, progress: 56 },
  L3: { mastered: 11, progressing: 4, pending: 1, progress: 70 },
  L4: { mastered: 8, progressing: 6, pending: 2, progress: 58 },
  L5: { mastered: 7, progressing: 5, pending: 4, progress: 48 },
};

const categoryTabs = [
  { id: 'subject', label: '学科能力', desc: '语数英基础、知识理解和学科表达', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'thinking', label: '思维与认知', desc: '问题理解、逻辑推理和表达输出', icon: Brain, color: 'text-violet-600', bg: 'bg-violet-50' },
  { id: 'habit', label: '学习习惯', desc: '计划、时间、作业、复盘和专注', icon: ClipboardCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'health', label: '体育与健康', desc: '体能、作息、情绪恢复和健康节奏', icon: Dumbbell, color: 'text-emerald-600', bg: 'bg-emerald-50' },
] as const;

type CategoryId = typeof categoryTabs[number]['id'];
const categoryLabelToId: Record<string, CategoryId> = {
  学科能力: 'subject',
  思维与认知: 'thinking',
  学习习惯: 'habit',
  体育与健康: 'health',
};
type Status = 'mastered' | 'progressing' | 'pending';

const statusMeta: Record<Status, { label: string; className: string; dot: string }> = {
  mastered: {
    label: '已掌握',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    dot: 'bg-emerald-500',
  },
  progressing: {
    label: '进行中',
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
    dot: 'bg-amber-500',
  },
  pending: {
    label: '未开始',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
  },
};

type AbilityRow = {
  point: string;
  icon: ElementType;
  iconClass: string;
  desc: string;
  indicators: string[];
  tasks: string[];
  status: Status;
  mastery: number;
};

type EditableAbilityRow = Omit<AbilityRow, 'icon' | 'iconClass'>;
type AbilityFormState = EditableAbilityRow & { categoryId: CategoryId; originalPoint?: string };

const abilityData: Record<CategoryId, AbilityRow[]> = {
  subject: [
    {
      point: '语文能力',
      icon: BookOpen,
      iconClass: 'bg-blue-50 text-blue-600',
      desc: '能稳定完成阅读、识字、表达和基础写作任务。',
      indicators: ['每周阅读 4 次以上', '能复述主要内容', '完成基础字词积累'],
      tasks: ['每日朗读打卡', '阅读后口头复述'],
      status: 'mastered',
      mastery: 82,
    },
    {
      point: '数学能力',
      icon: BarChart3,
      iconClass: 'bg-emerald-50 text-emerald-600',
      desc: '能理解题意，开始关注错因和解题步骤。',
      indicators: ['基础练习正确率 80%+', '每周错题复盘 1 次', '能说出解题思路'],
      tasks: ['错题本整理', '口述解题过程'],
      status: 'progressing',
      mastery: 64,
    },
    {
      point: '英语能力',
      icon: FileText,
      iconClass: 'bg-sky-50 text-sky-600',
      desc: 'L1 习惯养成：建立读听习惯，听懂常用指令和分级音频，能用 5 词内简单句描述图片。',
      indicators: ['读：能自主拼读并读完 RAZ G', '写：单词拼写正确，标点规范', '材料：OD 1 完成全册，RAZ 到 Level G，教辅为全新英语一年级听力'],
      tasks: ['每日 RAZ 听读 15min（1新1旧）', '每周 OD 2 个单元 + 课后练习', '每日原版动画 15min（如 Bluey）'],
      status: 'pending',
      mastery: 20,
    },
  ],
  thinking: [
    {
      point: '问题理解',
      icon: Lightbulb,
      iconClass: 'bg-amber-50 text-amber-600',
      desc: '能拆解问题，区分已知条件和目标。',
      indicators: ['能复述任务要求', '能找出关键条件', '能提出澄清问题'],
      tasks: ['题目条件标记', '问题复述训练'],
      status: 'mastered',
      mastery: 78,
    },
    {
      point: '逻辑推理',
      icon: Brain,
      iconClass: 'bg-violet-50 text-violet-600',
      desc: '能按照步骤推演，减少跳步和猜测。',
      indicators: ['能列出 2-3 个步骤', '推理过程可解释', '能发现明显矛盾'],
      tasks: ['逻辑游戏', '步骤排序练习'],
      status: 'progressing',
      mastery: 58,
    },
    {
      point: '表达输出',
      icon: PenLine,
      iconClass: 'bg-pink-50 text-pink-600',
      desc: '能用自己的话说明想法、结论和依据。',
      indicators: ['每周表达练习 2 次', '能说明选择原因', '能做简单总结'],
      tasks: ['三句话总结', '亲子问答复盘'],
      status: 'progressing',
      mastery: 55,
    },
  ],
  habit: [
    {
      point: '学习计划制定',
      icon: CalendarCheck,
      iconClass: 'bg-blue-50 text-blue-600',
      desc: '能根据任务安排，制定短期学习计划，合理分配时间。',
      indicators: ['每周制定学习计划', '每天安排 3-5 个学习任务', '合理分配各科时间'],
      tasks: ['使用学习计划表制定计划', '每日任务清单打卡'],
      status: 'mastered',
      mastery: 85,
    },
    {
      point: '时间管理',
      icon: Clock3,
      iconClass: 'bg-violet-50 text-violet-600',
      desc: '能合理安排学习与休息时间，避免拖延。',
      indicators: ['专注学习时间 15-25 分钟', '休息时间 5-10 分钟', '每日总学习时长不少于 1 小时'],
      tasks: ['番茄钟专注训练', '时间记录与复盘'],
      status: 'progressing',
      mastery: 60,
    },
    {
      point: '作业管理',
      icon: ClipboardCheck,
      iconClass: 'bg-pink-50 text-pink-600',
      desc: '能独立完成作业，并进行初步检查和订正。',
      indicators: ['每日作业独立完成', '错题订正率 80% 以上', '作业按时提交'],
      tasks: ['作业完成后自查', '错题本整理'],
      status: 'mastered',
      mastery: 80,
    },
    {
      point: '复盘与反思',
      icon: BookOpen,
      iconClass: 'bg-orange-50 text-orange-600',
      desc: '能在学习后进行简单复盘，总结收获与不足。',
      indicators: ['每周复盘 1 次', '能说出本周 3 个收获', '能指出 1-2 个需要改进的地方'],
      tasks: ['学习周记', '错题分析与总结'],
      status: 'progressing',
      mastery: 50,
    },
    {
      point: '学习专注力',
      icon: Target,
      iconClass: 'bg-emerald-50 text-emerald-600',
      desc: '能在干扰较少的环境中保持专注完成学习任务。',
      indicators: ['连续专注 20 分钟以上', '减少分心行为', '完成任务不依赖提醒'],
      tasks: ['专注力训练游戏', '安静环境学习实践'],
      status: 'mastered',
      mastery: 75,
    },
    {
      point: '自主学习意识',
      icon: BadgeCheck,
      iconClass: 'bg-indigo-50 text-indigo-600',
      desc: '能主动发现问题并尝试解决，培养自主学习意识。',
      indicators: ['每周主动提问 1-2 次', '主动查找资料', '尝试独立解决问题'],
      tasks: ['问题探索小任务', '自主阅读拓展资料'],
      status: 'pending',
      mastery: 0,
    },
  ],
  health: [
    {
      point: '基础体能',
      icon: Activity,
      iconClass: 'bg-emerald-50 text-emerald-600',
      desc: '保持每周稳定运动，关注耐力、协调和平衡。',
      indicators: ['每周运动 3 次以上', '每次运动 20 分钟+', '记录基础体能变化'],
      tasks: ['跳绳训练', '亲子户外运动'],
      status: 'mastered',
      mastery: 72,
    },
    {
      point: '作息管理',
      icon: TimerReset,
      iconClass: 'bg-cyan-50 text-cyan-600',
      desc: '建立稳定作息，减少晚睡和疲劳学习。',
      indicators: ['固定睡前流程', '睡眠时长达标', '早晨状态稳定'],
      tasks: ['睡前整理清单', '早睡打卡'],
      status: 'progressing',
      mastery: 62,
    },
    {
      point: '情绪恢复',
      icon: ShieldCheck,
      iconClass: 'bg-rose-50 text-rose-600',
      desc: '遇到挫折后能通过合适方式恢复状态。',
      indicators: ['能表达情绪原因', '能接受短暂休息', '能回到任务中'],
      tasks: ['情绪温度计', '复盘一次小挫折'],
      status: 'progressing',
      mastery: 56,
    },
  ],
};

const recommendedTasks = [
  { title: '番茄钟专注训练', tag: '进行中', icon: Clock3, tone: 'text-amber-600 bg-amber-50' },
  { title: '制定周学习计划', tag: '推荐', icon: CalendarCheck, tone: 'text-blue-600 bg-blue-50' },
  { title: '错题本整理', tag: '推荐', icon: ClipboardCheck, tone: 'text-indigo-600 bg-indigo-50' },
];

const resources = [
  { title: '时间管理技巧视频', type: '视频', icon: FileText, tone: 'text-orange-600 bg-orange-50' },
  { title: '学习计划模板', type: '文档', icon: PenLine, tone: 'text-pink-600 bg-pink-50' },
  { title: '专注力训练游戏', type: '互动', icon: Sparkles, tone: 'text-amber-600 bg-amber-50' },
];

function serializeAbilityData(data: Record<CategoryId, AbilityRow[]>): Record<CategoryId, EditableAbilityRow[]> {
  return Object.fromEntries(
    Object.entries(data).map(([categoryId, rows]) => [
      categoryId,
      rows.map(({ point, desc, indicators, tasks, status, mastery }) => ({ point, desc, indicators, tasks, status, mastery })),
    ])
  ) as Record<CategoryId, EditableAbilityRow[]>;
}

function mergeEditableAbilityData(saved: Record<CategoryId, EditableAbilityRow[]> | null): Record<CategoryId, AbilityRow[]> {
  if (!saved) return abilityData;

  return Object.fromEntries(
    categoryTabs.map((category) => {
      const defaultRows = abilityData[category.id];
      const editableRows = saved[category.id] || [];
      const rows = editableRows.length > 0
        ? editableRows.map((row, index) => {
            const fallback = defaultRows[index % defaultRows.length] || defaultRows[0];
            return {
              ...row,
              icon: fallback.icon,
              iconClass: fallback.iconClass,
              indicators: Array.isArray(row.indicators) ? row.indicators : [],
              tasks: Array.isArray(row.tasks) ? row.tasks : [],
              status: row.status || 'pending',
              mastery: Number.isFinite(row.mastery) ? row.mastery : 0,
            };
          })
        : defaultRows;
      return [category.id, rows];
    })
  ) as Record<CategoryId, AbilityRow[]>;
}

function parseLines(value: string) {
  return value
    .split('\n')
    .map(item => item.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-slate-100', className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${value}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const meta = statusMeta[status];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1', meta.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

async function getAbilityModel(): Promise<Record<CategoryId, EditableAbilityRow[]> | null> {
  const response = await apiClient.get('/settings/ability-model');
  return response.data.data || null;
}

async function updateAbilityModel(model: Record<CategoryId, EditableAbilityRow[]>): Promise<Record<CategoryId, EditableAbilityRow[]>> {
  const response = await apiClient.put('/settings/ability-model', { model });
  return response.data.data || model;
}

async function resetAbilityModel(): Promise<void> {
  await apiClient.delete('/settings/ability-model');
}

function AbilityTable({ rows, onEdit, focusPoint }: { rows: AbilityRow[]; onEdit?: (row: AbilityRow) => void; focusPoint?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="hidden grid-cols-[150px_1.05fr_1.25fr_1fr_170px] border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 lg:grid">
        <div className="px-4 py-3 text-center">能力点</div>
        <div className="border-l border-slate-200 px-4 py-3 text-center">能力描述</div>
        <div className="border-l border-slate-200 px-4 py-3 text-center">具体指标</div>
        <div className="border-l border-slate-200 px-4 py-3 text-center">任务</div>
        <div className="border-l border-slate-200 px-4 py-3 text-center">状态与操作</div>
      </div>
      <div className="divide-y divide-slate-200">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.point}
              className={cn(
                'group grid gap-4 p-4 lg:grid-cols-[150px_1.05fr_1.25fr_1fr_170px] lg:gap-0 lg:p-0',
                focusPoint === row.point && 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-100'
              )}
            >
              <div className="flex items-center justify-center gap-3 text-center lg:px-4 lg:py-6">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', row.iconClass)}>
                  <Icon className="size-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">{row.point}</p>
              </div>
              <div className="text-left text-sm leading-6 text-slate-600 lg:border-l lg:border-slate-200 lg:px-4 lg:py-6">
                {row.desc}
              </div>
              <div className="text-left lg:border-l lg:border-slate-200 lg:px-4 lg:py-6">
                <ul className="space-y-1.5 text-sm leading-6 text-slate-700">
                  {row.indicators.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
              <div className="text-left lg:border-l lg:border-slate-200 lg:px-4 lg:py-6">
                <ul className="space-y-1.5 text-sm leading-6 text-slate-700">
                  {row.tasks.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3 lg:flex-col lg:justify-center lg:border-l lg:border-slate-200 lg:px-4 lg:py-6">
                <StatusBadge status={row.status} />
                <p className="text-xs font-medium text-slate-500">掌握度 {row.mastery}%</p>
                {onEdit ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row)} className="h-8 rounded-lg px-2 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100">
                    <PenLine className="mr-1.5 size-3.5" />
                    编辑
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

function Donut({ value }: { value: number }) {
  return (
    <div
      className="grid size-24 place-items-center rounded-full"
      style={{ background: `conic-gradient(#2fc49b ${value * 3.6}deg, #eef2f7 0deg)` }}
    >
      <div className="grid size-16 place-items-center rounded-full bg-white text-center shadow-inner">
        <span className="text-lg font-bold text-slate-900">{value}%</span>
        <span className="-mt-2 text-[10px] font-medium text-slate-500">整体掌握</span>
      </div>
    </div>
  );
}

export default function AbilityModel() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeLevel, setActiveLevel] = useState<LevelId>('L1');
  const [activeCategory, setActiveCategory] = useState<CategoryId>('subject');
  const [modelData, setModelData] = useState<Record<CategoryId, AbilityRow[]>>(abilityData);
  const [editingRow, setEditingRow] = useState<AbilityFormState | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const { data: savedAbilityModel, isLoading: isAbilityModelLoading } = useQuery({
    queryKey: ['ability-model'],
    queryFn: getAbilityModel,
  });

  const saveAbilityModelMutation = useMutation({
    mutationFn: (data: Record<CategoryId, AbilityRow[]>) => updateAbilityModel(serializeAbilityData(data)),
    onSuccess: (savedModel) => {
      queryClient.setQueryData(['ability-model'], savedModel);
      setModelData(mergeEditableAbilityData(savedModel));
      toast.success('能力模型已保存');
    },
    onError: (error) => {
      toast.error(`保存失败：${getErrorMessage(error)}`);
    },
  });

  const resetAbilityModelMutation = useMutation({
    mutationFn: resetAbilityModel,
    onSuccess: () => {
      setModelData(abilityData);
      queryClient.invalidateQueries({ queryKey: ['ability-model'] });
      toast.success('已恢复默认模型');
    },
    onError: (error) => {
      toast.error(`恢复失败：${getErrorMessage(error)}`);
    },
  });

  const currentLevel = levels.find((level) => level.id === activeLevel) || levels[2];
  const stats = levelStats[activeLevel];
  const activeCategoryMeta = categoryTabs.find((tab) => tab.id === activeCategory) || categoryTabs[2];
  const ActiveCategoryIcon = activeCategoryMeta.icon;
  const focusPoint = searchParams.get('point') || '';
  const visibleRows = useMemo(() => {
    const rows = modelData[activeCategory] || [];
    return rows;
  }, [activeCategory, modelData]);
  const sortedVisibleRows = useMemo(() => {
    if (!focusPoint) return visibleRows;
    return [...visibleRows].sort((a, b) => {
      const aMatch = a.point === focusPoint ? 0 : 1;
      const bMatch = b.point === focusPoint ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [focusPoint, visibleRows]);

  const statusCounts = useMemo(() => {
    return sortedVisibleRows.reduce<Record<Status, number>>(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      { mastered: 0, progressing: 0, pending: 0 }
    );
  }, [sortedVisibleRows]);

  useEffect(() => {
    if (savedAbilityModel === undefined) return;
    setModelData(mergeEditableAbilityData(savedAbilityModel));
  }, [savedAbilityModel]);

  useEffect(() => {
    const category = searchParams.get('category');
    const categoryId = category ? categoryLabelToId[category] : undefined;
    if (categoryId) {
      setActiveCategory(categoryId);
    }
  }, [searchParams]);

  const openEditRow = (row: AbilityRow) => {
    setEditingRow({
      categoryId: activeCategory,
      originalPoint: row.point,
      point: row.point,
      desc: row.desc,
      indicators: row.indicators,
      tasks: row.tasks,
      status: row.status,
      mastery: row.mastery,
    });
  };

  const openNewRow = () => {
    setEditingRow({
      categoryId: activeCategory,
      point: '',
      desc: '',
      indicators: [],
      tasks: [],
      status: 'pending',
      mastery: 0,
    });
  };

  const handleSaveEditingRow = () => {
    if (!editingRow) return;
    const point = editingRow.point.trim();
    if (!point) {
      toast.error('请填写能力点名称');
      return;
    }

    const rows = modelData[editingRow.categoryId] || [];
    const fallback = abilityData[editingRow.categoryId][0];
    const nextRow: AbilityRow = {
      point,
      desc: editingRow.desc.trim(),
      indicators: editingRow.indicators,
      tasks: editingRow.tasks,
      status: editingRow.status,
      mastery: Math.max(0, Math.min(100, Number(editingRow.mastery) || 0)),
      icon: fallback.icon,
      iconClass: fallback.iconClass,
    };

    const exists = editingRow.originalPoint
      ? rows.some(row => row.point === editingRow.originalPoint)
      : false;
    const nextRows = exists
      ? rows.map(row => row.point === editingRow.originalPoint ? { ...nextRow, icon: row.icon, iconClass: row.iconClass } : row)
      : [...rows, nextRow];
    const nextModelData = { ...modelData, [editingRow.categoryId]: nextRows };

    setModelData(nextModelData);
    setEditingRow(null);
    saveAbilityModelMutation.mutate(nextModelData);
  };

  const handleDeleteEditingRow = () => {
    if (!editingRow?.originalPoint) return;
    const nextModelData = {
      ...modelData,
      [editingRow.categoryId]: modelData[editingRow.categoryId].filter(row => row.point !== editingRow.originalPoint),
    };
    setModelData(nextModelData);
    setEditingRow(null);
    saveAbilityModelMutation.mutate(nextModelData);
  };

  const handleResetModel = () => {
    resetAbilityModelMutation.mutate(undefined, {
      onSuccess: () => setResetDialogOpen(false),
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-5">
      <PageToolbar
        left={
          <PageToolbarTitle
            icon={Brain}
            title="能力模型"
            description="按一年级到五年级梳理能力要求，观察掌握状态和下一步建议。"
            badge={<span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">L1-L5</span>}
          />
        }
        right={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 min-w-[132px] justify-center rounded-xl border-indigo-100 bg-white px-3 text-center text-slate-700 hover:bg-indigo-50">
                  <span className="text-center whitespace-nowrap">
                    {currentLevel.shortName} {currentLevel.name}
                  </span>
                  <ChevronDown className="ml-1.5 size-4 shrink-0 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[132px] p-1">
                {levels.map((level) => (
                  <DropdownMenuItem
                    key={level.id}
                    onClick={() => setActiveLevel(level.id)}
                    className={cn(
                      'flex cursor-pointer justify-center rounded-lg px-2 py-2 text-center text-sm font-semibold',
                      activeLevel === level.id && 'bg-indigo-50 text-indigo-700 focus:bg-indigo-50 focus:text-indigo-700'
                    )}
                  >
                    {level.shortName} {level.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" className="h-11 rounded-xl border-blue-100 bg-white text-blue-600 hover:bg-blue-50">
              <FileText className="mr-2 size-4" />
              导出报告
            </Button>
            <Button variant="outline" onClick={openNewRow} disabled={isAbilityModelLoading || saveAbilityModelMutation.isPending} className="h-11 rounded-xl border-blue-100 bg-white text-blue-600 hover:bg-blue-50">
              <Plus className="mr-2 size-4" />
              新增能力点
            </Button>
            <Button onClick={() => sortedVisibleRows[0] && openEditRow(sortedVisibleRows[0])} disabled={isAbilityModelLoading || saveAbilityModelMutation.isPending} className="h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm hover:from-indigo-700 hover:to-blue-700">
              <PenLine className="mr-2 size-4" />
              编辑模型
            </Button>
          </>
        }
      />

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-4">
          {categoryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold transition',
                  isActive
                    ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                )}
              >
                <span className={cn('flex size-8 items-center justify-center rounded-lg', tab.bg, tab.color)}>
                  <Icon className="size-4" />
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
        <main className="min-w-0 space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', activeCategoryMeta.bg, activeCategoryMeta.color)}>
                  <ActiveCategoryIcon className="size-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    {activeCategoryMeta.label}（{currentLevel.shortName} {currentLevel.name}）
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                    {currentLevel.summary} 当前分类聚焦：{activeCategoryMeta.desc}。建议单次学习时长 {currentLevel.time}，家长角色：{currentLevel.parentRole}。
                  </p>
                </div>
              </div>
              <div className="min-w-[260px] rounded-lg bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>整体掌握进度</span>
                  <span className="text-slate-900">{stats.progress}%</span>
                </div>
                <ProgressBar value={stats.progress} className="mt-2" />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold">
                  <span className="whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">已掌握 {statusCounts.mastered} 个</span>
                  <span className="whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-amber-700">进行中 {statusCounts.progressing} 个</span>
                  <span className="whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-slate-600">未开始 {statusCounts.pending} 个</span>
                </div>
              </div>
            </div>
          </section>

          <AbilityTable rows={sortedVisibleRows} onEdit={openEditRow} focusPoint={focusPoint} />

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">L1-L5 能力发展路径</h2>
                <p className="mt-1 text-sm text-slate-500">当前按小学一年级到五年级划分，后续可补充幼小衔接、六年级和更高年级。</p>
              </div>
              <Button variant="ghost" className="self-start rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 sm:self-auto">
                查看指标对比表
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {levels.map((level) => {
                const isActive = level.id === activeLevel;
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setActiveLevel(level.id)}
                    className={cn(
                      'rounded-lg border p-4 text-left transition',
                      isActive
                        ? 'border-blue-300 bg-blue-50 shadow-sm ring-1 ring-blue-100'
                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-bold text-slate-950">{level.shortName}</p>
                      {isActive ? <CheckCircle2 className="size-4 text-blue-600" /> : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{level.name}</p>
                    <p className="mt-2 text-xs text-slate-500">{level.time} · {level.parentRole}</p>
                    <p className="mt-3 text-sm leading-5 text-slate-600">{level.focus}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">当前等级概览</h2>
            <div className="mt-4 flex items-center justify-center">
              <Donut value={stats.progress} />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600"><span className="size-2 rounded-full bg-emerald-500" />已掌握</span>
                <span className="font-semibold text-slate-900">{stats.mastered} 个</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600"><span className="size-2 rounded-full bg-amber-500" />进行中</span>
                <span className="font-semibold text-slate-900">{stats.progressing} 个</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600"><span className="size-2 rounded-full bg-slate-400" />未开始</span>
                <span className="font-semibold text-slate-900">{stats.pending} 个</span>
              </div>
            </div>
            <Button className="mt-4 w-full rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" variant="ghost">
              查看详细报告
            </Button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">推荐任务</h2>
            <div className="mt-4 space-y-3">
              {recommendedTasks.map((task) => {
                const Icon = task.icon;
                return (
                  <div key={task.title} className="flex items-center gap-3">
                    <span className={cn('flex size-8 items-center justify-center rounded-lg', task.tone)}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{task.title}</span>
                    <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-blue-600">{task.tag}</span>
                  </div>
                );
              })}
            </div>
            <Button className="mt-4 w-full rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" variant="ghost">
              查看全部任务
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">相关资源推荐</h2>
            <div className="mt-4 space-y-3">
              {resources.map((resource) => {
                const Icon = resource.icon;
                return (
                  <div key={resource.title} className="flex items-center gap-3">
                    <span className={cn('flex size-8 items-center justify-center rounded-lg', resource.tone)}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{resource.title}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">{resource.type}</span>
                  </div>
                );
              })}
            </div>
            <Button className="mt-4 w-full rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" variant="ghost">
              查看更多资源
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">说明</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li className="flex gap-2"><Flag className="mt-1 size-4 shrink-0 text-blue-500" />L1-L5 当前对应一年级到五年级。</li>
              <li className="flex gap-2"><ListChecks className="mt-1 size-4 shrink-0 text-blue-500" />能力指标后续会接入任务、阅读、计划、目标和报告数据。</li>
              <li className="flex gap-2"><ShieldCheck className="mt-1 size-4 shrink-0 text-blue-500" />当前支持家庭级云端配置，编辑后会保存到后端。</li>
            </ol>
            <Button variant="outline" onClick={() => setResetDialogOpen(true)} disabled={resetAbilityModelMutation.isPending} className="mt-4 w-full rounded-lg bg-white">
              恢复默认模型
            </Button>
          </section>
        </aside>
      </div>

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditingRow(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 p-5">
              <div>
                <p className="text-xs font-semibold text-blue-600">{categoryTabs.find(item => item.id === editingRow.categoryId)?.label}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{editingRow.originalPoint ? '编辑能力点' : '新增能力点'}</h3>
                <p className="mt-1 text-sm text-slate-500">先维护模型内容和状态，后续再接入任务、目标和报告数据。</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingRow(null)} className="rounded-full">
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 space-y-4 overflow-auto p-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">能力点名称</span>
                <input
                  value={editingRow.point}
                  onChange={(event) => setEditingRow({ ...editingRow, point: event.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">能力描述</span>
                <textarea
                  value={editingRow.desc}
                  onChange={(event) => setEditingRow({ ...editingRow, desc: event.target.value })}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">具体指标</span>
                  <textarea
                    value={editingRow.indicators.join('\n')}
                    onChange={(event) => setEditingRow({ ...editingRow, indicators: parseLines(event.target.value) })}
                    rows={5}
                    placeholder="每行一个指标"
                    className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">任务</span>
                  <textarea
                    value={editingRow.tasks.join('\n')}
                    onChange={(event) => setEditingRow({ ...editingRow, tasks: parseLines(event.target.value) })}
                    rows={5}
                    placeholder="每行一个任务"
                    className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">当前状态</span>
                  <select
                    value={editingRow.status}
                    onChange={(event) => setEditingRow({ ...editingRow, status: event.target.value as Status })}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="mastered">已掌握</option>
                    <option value="progressing">进行中</option>
                    <option value="pending">未开始</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">掌握度：{editingRow.mastery}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={editingRow.mastery}
                    onChange={(event) => setEditingRow({ ...editingRow, mastery: Number(event.target.value) })}
                    className="mt-4 w-full accent-blue-600"
                  />
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {editingRow.originalPoint ? (
                  <Button type="button" variant="outline" onClick={handleDeleteEditingRow} className="rounded-xl border-red-100 bg-white text-red-600 hover:bg-red-50">
                    删除能力点
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setEditingRow(null)} className="rounded-xl bg-white">取消</Button>
                <Button type="button" onClick={handleSaveEditingRow} disabled={saveAbilityModelMutation.isPending} className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                  {saveAbilityModelMutation.isPending ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复默认能力模型</AlertDialogTitle>
            <AlertDialogDescription>
              确认恢复默认能力模型？当前家庭自定义的能力点、说明和任务内容会被清空。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetModel}
              disabled={resetAbilityModelMutation.isPending}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {resetAbilityModelMutation.isPending ? '恢复中...' : '确认恢复'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
