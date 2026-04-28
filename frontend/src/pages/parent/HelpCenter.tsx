import { useMemo, useState } from 'react';
import type { ElementType } from 'react';
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  FileText,
  HelpCircle,
  Library,
  ListChecks,
  MessageSquare,
  Search,
  Settings,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type HelpSection = {
  id: string;
  title: string;
  desc: string;
  icon: ElementType;
  items: Array<{
    title: string;
    steps: string[];
    tips?: string[];
  }>;
};

const sections: HelpSection[] = [
  {
    id: 'overview',
    title: '整体使用流程',
    desc: '先建档，再定目标，最后用任务和复盘形成闭环。',
    icon: HelpCircle,
    items: [
      {
        title: '推荐使用顺序',
        steps: [
          '进入设置，确认家庭信息和孩子档案是否完整。',
          '在能力模型里查看孩子当前阶段，明确重点能力方向。',
          '在目标页建立阶段目标，并把目标关联到能力模型。',
          '在任务管理和学习计划中安排可执行任务。',
          '每天在今日概览完成打卡，每周通过仪表盘和报告复盘。',
        ],
        tips: ['不要一开始就堆任务，先保证孩子档案、学期、阅读阶段和目标清晰。'],
      },
    ],
  },
  {
    id: 'dashboard',
    title: '仪表盘',
    desc: '查看孩子阶段表现、阅读数据和任务完成情况。',
    icon: BarChart3,
    items: [
      {
        title: '看哪些数据',
        steps: [
          '优先看本周、本月筛选，判断当前周期的整体表现。',
          '阅读能力区用于观察图书馆和阅读记录带来的变化。',
          '任务完成趋势用于判断计划是否过重或执行是否稳定。',
        ],
        tips: ['趋势类图表只适合看方向，不建议用单日波动判断孩子状态。'],
      },
    ],
  },
  {
    id: 'ability',
    title: '能力模型',
    desc: '用 L1-L5 描述孩子在不同能力维度上的阶段位置。',
    icon: Brain,
    items: [
      {
        title: '如何理解 L1-L5',
        steps: [
          'L1-L5 对应 1-5 年级阶段能力，而不是单纯分数等级。',
          '先选择孩子当前年级对应级别，再查看学科能力、阅读能力等维度。',
          '能力点里的任务可以作为目标和任务设计的参考。',
        ],
        tips: ['目前模型内容先用于规划和对齐，后续会逐步接入编辑和自动评估。'],
      },
    ],
  },
  {
    id: 'goals',
    title: '目标',
    desc: '把长期成长方向拆成可跟踪的阶段目标。',
    icon: Target,
    items: [
      {
        title: '建立目标的方法',
        steps: [
          '先选择目标类型，例如英语能力、阅读能力或学习习惯。',
          '设置目标周期和完成标准，避免目标只有一句口号。',
          '目标应关联能力模型，后续任务才能围绕能力点推进。',
        ],
        tips: ['目标不要太多，同一阶段建议保留 1-3 个重点目标。'],
      },
    ],
  },
  {
    id: 'tasks',
    title: '任务管理',
    desc: '把目标拆成每天可以完成、可以记录的任务。',
    icon: ListChecks,
    items: [
      {
        title: '任务怎么建',
        steps: [
          '选择孩子后新增任务，填写名称、分类、预计时长和频率。',
          '任务要尽量可验证，例如“RAZ 听读 15 分钟”比“学英语”更好。',
          '任务完成后在今日概览或计划页打卡，系统会进入统计和报告。',
        ],
        tips: ['如果连续几天无法完成，优先降低任务量，而不是继续加压。'],
      },
    ],
  },
  {
    id: 'plans',
    title: '学习计划',
    desc: '把任务安排到具体日期，形成一周学习节奏。',
    icon: CalendarDays,
    items: [
      {
        title: '安排计划',
        steps: [
          '进入学习计划，选择孩子和日期范围。',
          '把任务放入合适日期，注意同一天总时长不要过高。',
          '临时调整时优先移动任务，避免频繁删除重新创建。',
        ],
        tips: ['计划页适合做周安排，今日概览适合做当天执行。'],
      },
    ],
  },
  {
    id: 'library',
    title: '图书馆',
    desc: '管理书籍、阅读状态、封面和阅读记录。',
    icon: Library,
    items: [
      {
        title: '图书和阅读记录',
        steps: [
          '添加书籍后，补充分类、阅读状态和封面。',
          '孩子每次阅读后添加阅读记录，记录时间、页数或完成状态。',
          '如果早期读完但没有页数和字数，可先标记已读完，后续补充估算信息。',
        ],
        tips: ['阅读统计优先依赖阅读记录；只有书籍状态，没有记录时，趋势会不完整。'],
      },
    ],
  },
  {
    id: 'reports',
    title: '学习报告',
    desc: '通过阶段报告复盘任务、目标和孩子状态。',
    icon: FileText,
    items: [
      {
        title: '如何复盘',
        steps: [
          '按周或按月查看完成情况，不只看完成率，也看任务类型是否均衡。',
          '把未完成任务分为过难、时间不合适、兴趣不足三类处理。',
          '复盘后回到目标和任务页调整下一周期安排。',
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: '设置',
    desc: '管理账户、家庭、孩子档案和推送配置。',
    icon: Settings,
    items: [
      {
        title: '设置页重点',
        steps: [
          '账户信息用于维护家长资料和安全设置。',
          '家庭概览用于查看家庭码、成员和权限。',
          '孩子概览可打开孩子编辑弹窗，维护基本信息、学期与学习、推送设置。',
          '钉钉推送配置后，可以用于后续日报和提醒。',
        ],
      },
    ],
  },
  {
    id: 'faq',
    title: '常见问题',
    desc: '上线、数据和使用过程中的常见说明。',
    icon: MessageSquare,
    items: [
      {
        title: '数据会不会被覆盖',
        steps: [
          '正常前端发布只替换静态文件，不会覆盖数据库。',
          '后端发布通常只重启服务，也不会清空数据。',
          '涉及 Prisma migration 或手动 SQL 前，应先备份生产数据库。',
        ],
      },
      {
        title: '页面没有更新怎么办',
        steps: [
          '先确认前端是否已重新 build 并复制到 Nginx 目录。',
          '浏览器强制刷新，或清理缓存后再打开。',
          '接口版本可通过 /api/version 检查后端是否已经重启到新版本。',
        ],
      },
    ],
  },
];

export default function HelpCenter() {
  const [activeId, setActiveId] = useState(sections[0].id);
  const [keyword, setKeyword] = useState('');

  const filteredSections = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return sections;
    return sections.filter((section) => {
      const text = [
        section.title,
        section.desc,
        ...section.items.flatMap((item) => [item.title, ...item.steps, ...(item.tips || [])]),
      ].join(' ').toLowerCase();
      return text.includes(query);
    });
  }, [keyword]);

  const activeSection = filteredSections.find((section) => section.id === activeId) || filteredSections[0] || sections[0];
  const ActiveIcon = activeSection.icon;

  return (
    <div className="mx-auto max-w-[1360px] space-y-5 text-slate-950">
      <section className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="outline" className="border-violet-100 bg-violet-50 text-violet-700">帮助中心</Badge>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">趣学伴操作指南</h1>
            <p className="mt-2 text-sm text-slate-500">按模块查看操作方法、推荐流程和常见问题。</p>
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索操作、模块或问题"
              className="pl-9"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-20 lg:h-[calc(100vh-120px)]">
          <div className="space-y-1">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              const active = section.id === activeSection.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveId(section.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    active ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{section.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                <ActiveIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-950">{activeSection.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{activeSection.desc}</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            {activeSection.items.map((item) => (
              <article key={item.title} className="rounded-lg border border-slate-100 bg-slate-50/60 p-5">
                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                <div className="mt-4 space-y-3">
                  {item.steps.map((step, index) => (
                    <div key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                        {index + 1}
                      </span>
                      <p className="pt-0.5 text-sm leading-6 text-slate-700">{step}</p>
                    </div>
                  ))}
                </div>
                {item.tips?.length ? (
                  <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                    {item.tips.map((tip) => (
                      <p key={tip} className="flex gap-2 text-sm leading-6 text-emerald-700">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />
                        {tip}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
