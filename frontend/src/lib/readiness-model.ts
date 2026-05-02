import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  CalendarCheck,
  Dumbbell,
  FileText,
  HeartPulse,
  Lightbulb,
  MessageSquareText,
  PenLine,
  ShieldCheck,
  Target,
  TimerReset,
} from 'lucide-react';
import type { ElementType } from 'react';

export type ReadinessLayerId = 'delivery' | 'cognition' | 'stability';

export type ReadinessLayer = {
  id: ReadinessLayerId;
  label: string;
  english: string;
  shortLabel: string;
  question: string;
  description: string;
  tone: string;
  softTone: string;
  icon: ElementType;
};

export type ReadinessAbilityPoint = {
  layerId: ReadinessLayerId;
  point: string;
  icon: ElementType;
  iconClass: string;
  desc: string;
  indicators: string[];
  tasks: string[];
  status: 'mastered' | 'progressing' | 'pending';
  mastery: number;
};

export const readinessLayers: ReadinessLayer[] = [
  {
    id: 'delivery',
    label: '交付层',
    english: 'Delivery',
    shortLabel: '输出',
    question: '现在够不够强',
    description: '英语、数理、大语文、项目成果和临场应变，是目标校最容易看到的竞争力。',
    tone: 'text-blue-700',
    softTone: 'bg-blue-50 text-blue-700 ring-blue-100',
    icon: Target,
  },
  {
    id: 'cognition',
    label: '认知层',
    english: 'Cognition',
    shortLabel: '倍率',
    question: '为什么能变强',
    description: '处理速度、规则内化、逻辑深度、批判思维和迁移应用，决定学习效率和天花板。',
    tone: 'text-violet-700',
    softTone: 'bg-violet-50 text-violet-700 ring-violet-100',
    icon: Brain,
  },
  {
    id: 'stability',
    label: '稳定性层',
    english: 'Stability',
    shortLabel: '带宽',
    question: '能不能持续变强',
    description: '睡眠、运动、情绪、完成率、延期率和复盘频率，是系统持续运转的保障。',
    tone: 'text-emerald-700',
    softTone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    icon: ShieldCheck,
  },
];

export const readinessLayerMap = readinessLayers.reduce((acc, layer) => {
  acc[layer.id] = layer;
  return acc;
}, {} as Record<ReadinessLayerId, ReadinessLayer>);

export const readinessAbilityPoints: Record<ReadinessLayerId, ReadinessAbilityPoint[]> = {
  delivery: [
    {
      layerId: 'delivery',
      point: '英语能力',
      icon: FileText,
      iconClass: 'bg-sky-50 text-sky-600',
      desc: '面向原版阅读、听说表达、词汇积累和结构化输出。',
      indicators: ['分级阅读持续推进', '听说表达稳定输出', '阅读后能复述关键信息'],
      tasks: ['RAZ 听读与复述', '英语结构化表达', '词汇与句法切片'],
      status: 'progressing',
      mastery: 64,
    },
    {
      layerId: 'delivery',
      point: '数理逻辑',
      icon: BarChart3,
      iconClass: 'bg-blue-50 text-blue-600',
      desc: '关注数学思维、快速规则学习、空间想象和稳定解题。',
      indicators: ['新规则题能理解并应用', '限时题组正确率稳定', '能讲清解题路径'],
      tasks: ['新规则题', '变式迁移题', '讲题复盘'],
      status: 'progressing',
      mastery: 58,
    },
    {
      layerId: 'delivery',
      point: '大语文',
      icon: BookOpen,
      iconClass: 'bg-rose-50 text-rose-600',
      desc: '覆盖中文阅读、古文国学、百科文史和表达写作。',
      indicators: ['每周中文阅读稳定', '能提取人物和情节线索', '能组织观点和依据'],
      tasks: ['章节精读', '人物分析', '三句话复述'],
      status: 'progressing',
      mastery: 62,
    },
    {
      layerId: 'delivery',
      point: '项目成果',
      icon: CalendarCheck,
      iconClass: 'bg-amber-50 text-amber-600',
      desc: '沉淀校内荣誉、活动经历、作品项目和可展示材料。',
      indicators: ['有阶段性作品', '能说明项目过程', '材料可进入简历证据'],
      tasks: ['项目记录', '作品整理', '活动复盘'],
      status: 'pending',
      mastery: 34,
    },
    {
      layerId: 'delivery',
      point: '临场应变',
      icon: MessageSquareText,
      iconClass: 'bg-indigo-50 text-indigo-600',
      desc: '面谈表达、现场推理、抗压专注和综合沟通。',
      indicators: ['能听清问题并回应', '能给出理由', '遇到追问不明显慌乱'],
      tasks: ['面谈问答', '现场推理', '表达复盘'],
      status: 'pending',
      mastery: 38,
    },
  ],
  cognition: [
    {
      layerId: 'cognition',
      point: '信息处理速度',
      icon: TimerReset,
      iconClass: 'bg-cyan-50 text-cyan-600',
      desc: '单位时间内理解、筛选、作答和修正信息的效率。',
      indicators: ['限时任务正确率', '跳题率和回看率', '单位时间有效产出'],
      tasks: ['限时小题组', '快速阅读定位', '口算速度训练'],
      status: 'progressing',
      mastery: 56,
    },
    {
      layerId: 'cognition',
      point: '规则内化',
      icon: Brain,
      iconClass: 'bg-violet-50 text-violet-600',
      desc: '面对新规则、新定义题时，能否从理解走向稳定应用。',
      indicators: ['第几次尝试后正确', '提示后能否迁移', '同类错误是否重复'],
      tasks: ['新规则题', '反例构造', '规则复述'],
      status: 'progressing',
      mastery: 52,
    },
    {
      layerId: 'cognition',
      point: '逻辑深度',
      icon: Lightbulb,
      iconClass: 'bg-amber-50 text-amber-600',
      desc: '答案是否有条件、步骤、依据、反例和完整推理链。',
      indicators: ['能说明条件', '能解释步骤依据', '能发现明显漏洞'],
      tasks: ['讲题复盘', '推理链补全', '错因分类'],
      status: 'progressing',
      mastery: 55,
    },
    {
      layerId: 'cognition',
      point: '批判思维',
      icon: PenLine,
      iconClass: 'bg-pink-50 text-pink-600',
      desc: '能识别材料、题干或观点中的前提、漏洞和替代解释。',
      indicators: ['能提出追问', '能区分事实和观点', '能给出不同解释'],
      tasks: ['观点辨析', '材料质疑', '反方表达'],
      status: 'pending',
      mastery: 32,
    },
    {
      layerId: 'cognition',
      point: '迁移应用',
      icon: Activity,
      iconClass: 'bg-teal-50 text-teal-600',
      desc: '能否把一个学科中的方法迁移到新题型或其他学科任务。',
      indicators: ['变式题成功率', '跨学科调用能力', '能总结通用方法'],
      tasks: ['变式迁移题', '跨学科问题', '方法总结卡'],
      status: 'progressing',
      mastery: 48,
    },
  ],
  stability: [
    {
      layerId: 'stability',
      point: '睡眠作息',
      icon: TimerReset,
      iconClass: 'bg-cyan-50 text-cyan-600',
      desc: '作息稳定度决定第二天的信息处理和情绪恢复。',
      indicators: ['睡眠时长达标', '晚睡次数下降', '早晨状态稳定'],
      tasks: ['睡前整理清单', '早睡打卡', '晚间减负'],
      status: 'progressing',
      mastery: 62,
    },
    {
      layerId: 'stability',
      point: '运动健康',
      icon: Dumbbell,
      iconClass: 'bg-emerald-50 text-emerald-600',
      desc: '通过体能和户外活动维持长期学习耐力。',
      indicators: ['每周运动次数', '单次运动时长', '疲劳恢复速度'],
      tasks: ['跳绳训练', '户外快走', '核心动作'],
      status: 'mastered',
      mastery: 72,
    },
    {
      layerId: 'stability',
      point: '情绪恢复',
      icon: HeartPulse,
      iconClass: 'bg-rose-50 text-rose-600',
      desc: '遇到挫折后能表达、恢复并回到任务中。',
      indicators: ['能说明情绪原因', '能接受短暂休息', '能回到任务'],
      tasks: ['情绪温度计', '挫折复盘', '亲子沟通'],
      status: 'progressing',
      mastery: 56,
    },
    {
      layerId: 'stability',
      point: '执行完成率',
      icon: Target,
      iconClass: 'bg-blue-50 text-blue-600',
      desc: '任务能否持续完成，是判断计划是否可运行的基础。',
      indicators: ['每日完成率', '连续完成天数', '任务启动成本'],
      tasks: ['每日任务清单', '固定开始时间', '完成后反馈'],
      status: 'mastered',
      mastery: 78,
    },
    {
      layerId: 'stability',
      point: '延期率',
      icon: CalendarCheck,
      iconClass: 'bg-orange-50 text-orange-600',
      desc: '延期率升高通常意味着任务负荷、情绪或时间安排出现问题。',
      indicators: ['延期任务数量', '连续延期天数', '延期原因分布'],
      tasks: ['任务减量', '时间块调整', '原因记录'],
      status: 'progressing',
      mastery: 54,
    },
    {
      layerId: 'stability',
      point: '复盘频率',
      icon: BookOpen,
      iconClass: 'bg-indigo-50 text-indigo-600',
      desc: '复盘是交付层增长和认知层内化之间的关键连接。',
      indicators: ['每周复盘次数', '错因记录质量', '下次是否避免同类错误'],
      tasks: ['错因记录', '讲题复盘', '周末复盘'],
      status: 'progressing',
      mastery: 50,
    },
  ],
};

const deliveryKeywords = ['交付层', 'Delivery', '输出', '英语', '数理', '数学', '语文', '阅读', '项目', '面谈', '临场', '表达', '学科', '校内'];
const cognitionKeywords = ['认知层', 'Cognition', '倍率', '规则', '迁移', '逻辑', '思维', '速度', '批判', '错因', '复盘', '推理'];
const stabilityKeywords = ['稳定性层', 'Stability', '带宽', '睡眠', '作息', '运动', '情绪', '完成率', '延期', '习惯', '时间', '专注', '健康', '自理'];

export function getReadinessLayerByText(...values: Array<string | undefined | null>): ReadinessLayer {
  const text = values.filter(Boolean).join(' ');
  if (stabilityKeywords.some((keyword) => text.includes(keyword))) return readinessLayerMap.stability;
  if (cognitionKeywords.some((keyword) => text.includes(keyword))) return readinessLayerMap.cognition;
  if (deliveryKeywords.some((keyword) => text.includes(keyword))) return readinessLayerMap.delivery;
  return readinessLayerMap.delivery;
}

export function getReadinessLayerIdByText(...values: Array<string | undefined | null>): ReadinessLayerId {
  return getReadinessLayerByText(...values).id;
}
