import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  Lightbulb,
  MessageSquareText,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageToolbar } from '@/components/parent/PageToolbar';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { cn } from '@/lib/utils';

type GoalStatus = 'on-track' | 'attention' | 'strong';

type GoalItem = {
  title: string;
  description: string;
  progress: number;
  target: string;
  current: string;
  suggestion: string;
  status: GoalStatus;
};

type GoalSection = {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tone: string;
  items: GoalItem[];
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
        description: '本月完成精读与复述训练，提升信息提取和表达能力。',
        progress: 72,
        target: '每周 4 次',
        current: '已完成 11/16 次',
        suggestion: '建议继续使用章节复述卡，每次阅读后让孩子讲 3 个关键情节。',
        status: 'on-track',
      },
      {
        title: '数学计算稳定性',
        description: '控制基础计算错误率，形成检查习惯。',
        progress: 58,
        target: '正确率 90%',
        current: '当前 82%',
        suggestion: '建议增加 10 分钟限时口算，并记录错因分类。',
        status: 'attention',
      },
      {
        title: '英语自然拼读',
        description: '巩固常见字母组合和短句朗读。',
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
        description: '保持有氧运动和户外活动频率。',
        progress: 67,
        target: '每周 5 次',
        current: '已完成 3/5 次',
        suggestion: '本周还差 2 次，可安排跳绳或 20 分钟快走。',
        status: 'on-track',
      },
      {
        title: '身体数据跟踪',
        description: '记录身高、体重和 BMI 变化趋势。',
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
        description: '用“问题-原因-方案”结构表达想法。',
        progress: 76,
        target: '每周 3 次',
        current: '已完成 7/9 次',
        suggestion: '建议从生活问题切入，让孩子先提出两个方案再比较。',
        status: 'strong',
      },
      {
        title: '创造力表达',
        description: '通过故事续写、图画表达或搭建任务进行创作。',
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
        description: '建立稳定学习节奏，减少临时安排。',
        progress: 84,
        target: '连续 21 天',
        current: '已坚持 18 天',
        suggestion: '继续保持固定开始时间，完成后及时给予正向反馈。',
        status: 'strong',
      },
      {
        title: '错题复盘',
        description: '形成错因记录和二次订正习惯。',
        progress: 52,
        target: '每周 4 次',
        current: '已完成 6/12 次',
        suggestion: '建议把复盘拆成 5 分钟小任务，避免堆积到周末。',
        status: 'attention',
      },
    ],
  },
];

const historyPoints = [
  { label: '第1周', value: 48 },
  { label: '第2周', value: 56 },
  { label: '第3周', value: 64 },
  { label: '第4周', value: 71 },
  { label: '本周', value: 76 },
];

const strategySuggestions: Array<{ title: string; desc: string; icon: React.ElementType }> = [
  { title: '降低错题复盘门槛', desc: '把每次复盘控制在 5-8 分钟，优先记录错因。', icon: Activity },
  { title: '体育目标拆分到日历', desc: '把剩余运动次数拆到具体日期，减少周末集中补。', icon: Dumbbell },
  { title: '保留强项激励', desc: '英语自然拼读和学习时段表现较好，可发放阶段徽章。', icon: Award },
];

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

function GoalCard({ goal }: { goal: GoalItem }) {
  const status = statusStyles[goal.status];
  const tone = goal.status === 'strong' ? 'bg-emerald-500' : goal.status === 'attention' ? 'bg-amber-500' : 'bg-indigo-500';

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950">{goal.title}</h3>
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
      <div className="mt-4 flex gap-2 rounded-lg bg-white p-3 text-xs leading-5 text-slate-600">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span>{goal.suggestion}</span>
      </div>
    </div>
  );
}

function GoalSectionCard({ section }: { section: GoalSection }) {
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
          <GoalCard key={goal.title} goal={goal} />
        ))}
      </div>
    </Panel>
  );
}

function TrendChart() {
  const points = historyPoints.map((item, index) => ({
    ...item,
    x: 28 + index * 78,
    y: 142 - item.value,
  }));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const area = `${line} L${points[points.length - 1].x} 154 L${points[0].x} 154 Z`;

  return (
    <svg viewBox="0 0 360 170" className="h-44 w-full overflow-visible">
      <defs>
        <linearGradient id="goalTrendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((index) => (
        <line key={index} x1="20" x2="340" y1={36 + index * 32} y2={36 + index * 32} stroke="#eef2f7" />
      ))}
      <path d={area} fill="url(#goalTrendFill)" />
      <path d={line} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="5" fill="#6366f1" />
          <text x={point.x} y="166" textAnchor="middle" className="fill-slate-400 text-[10px]">{point.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function GoalsPage() {
  const { selectedChild } = useSelectedChild();
  const allGoals = goalSections.flatMap(section => section.items);
  const averageProgress = Math.round(allGoals.reduce((sum, goal) => sum + goal.progress, 0) / allGoals.length);
  const strongCount = allGoals.filter(goal => goal.status === 'strong').length;
  const attentionCount = allGoals.filter(goal => goal.status === 'attention').length;

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
                {selectedChild?.name || '当前孩子'}的长期目标、阶段进度和调整建议
              </p>
            </div>
          </div>
        }
        right={
          <div className="flex gap-2">
            <Button className="h-11 rounded-xl bg-blue-500 px-4 text-white shadow-sm hover:bg-blue-600">
              <RefreshCw className="mr-2 h-4 w-4" />
              同步数据
            </Button>
            <Button className="h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 px-4 text-white shadow-sm hover:from-indigo-600 hover:to-violet-600">
              <PencilLine className="mr-2 h-4 w-4" />
              调整目标
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: '综合进度', value: `${averageProgress}%`, hint: '四类目标平均', icon: Target, tone: 'bg-indigo-50 text-indigo-600' },
          { label: '领先目标', value: strongCount, hint: '建议继续强化', icon: Sparkles, tone: 'bg-emerald-50 text-emerald-600' },
          { label: '需关注目标', value: attentionCount, hint: '需要调整策略', icon: HeartPulse, tone: 'bg-amber-50 text-amber-600' },
          { label: '可获得徽章', value: 3, hint: '本周潜在激励', icon: Award, tone: 'bg-violet-50 text-violet-600' },
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
          {goalSections.map((section) => (
            <GoalSectionCard key={section.title} section={section} />
          ))}
        </div>

        <div className="space-y-5">
          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">目标达成趋势</h2>
                <p className="mt-1 text-xs text-slate-500">按周汇总目标平均完成度</p>
              </div>
              <Badge variant="outline" className="rounded-full bg-indigo-50 text-indigo-700">动态更新</Badge>
            </div>
            <TrendChart />
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">策略建议</h2>
                <p className="mt-1 text-xs text-slate-500">根据当前进度给出调整方向</p>
              </div>
            </div>
            <div className="space-y-3">
              {strategySuggestions.map(({ title, desc, icon: Icon }) => (
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
                <h2 className="text-base font-semibold text-slate-950">激励与提醒</h2>
                <p className="mt-1 text-xs text-slate-500">达成后展示徽章，未达成时推送提醒</p>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-indigo-50 p-4">
                <p className="text-sm font-semibold text-slate-900">即将获得：连续学习徽章</p>
                <p className="mt-1 text-xs text-slate-500">再坚持 3 天即可达成 21 天固定学习时段。</p>
              </div>
              <Button variant="outline" className="h-11 rounded-xl">
                <MessageSquareText className="mr-2 h-4 w-4" />
                生成本周鼓励话术
              </Button>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-slate-950">后续数据集成</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  这个页面后续会接入任务完成率、学科数据、阅读记录、运动记录和通知系统。当前先固定页面结构与交互口径，避免数据模型未定时反复返工。
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
