import { goalDirections } from './readiness-model';

export type ReadinessGoalStatus = 'on-track' | 'attention' | 'strong';

export type ReadinessGoal = {
  id?: string;
  title?: string;
  description?: string;
  level?: string;
  abilityCategory?: string;
  abilityPoint?: string;
  goalDirection?: string;
  goalType?: string;
  goalCycle?: string;
  successCriteria?: string;
  linkedTasks?: string[];
  linkedTaskIds?: number[];
  reviewCadence?: string;
  progress?: number;
  target?: string;
  current?: string;
  suggestion?: string;
  status?: ReadinessGoalStatus;
  reviewNotes?: unknown[];
};

export type ReadinessTask = {
  id: number;
  name: string;
  tags?: {
    abilityCategory?: string;
    abilityPoint?: string;
    linkedGoal?: string;
  };
};

export type GoalReadinessState = '待建立' | '待支撑' | '推进中' | '需关注' | '可复盘';

export type GoalGap = {
  label: string;
  action: string;
};

export type AbilityRelationCounts = Record<string, { goals: number; tasks: number }>;

export const defaultGoalDirection = goalDirections[0]?.name || '三公基础';
export const goalDirectionOptions = goalDirections.filter(direction => direction.status === 'default').map(direction => direction.name);

export function inferGoalDirection(category = '', point = '') {
  const text = `${category} ${point}`;
  if (text.includes('英语')) return '英语强化';
  if (text.includes('数理') || text.includes('数学') || text.includes('逻辑') || text.includes('规则')) return '数理逻辑';
  if (text.includes('阅读') || text.includes('语文') || text.includes('表达')) return '阅读表达';
  if (text.includes('稳定') || text.includes('睡眠') || text.includes('作息') || text.includes('完成率') || text.includes('延期') || text.includes('复盘') || text.includes('运动') || text.includes('情绪')) return '稳定执行';
  return defaultGoalDirection;
}

export function inferGoalType(goal: Pick<ReadinessGoal, 'abilityCategory' | 'abilityPoint'>) {
  const abilityCategory = goal.abilityCategory || '';
  const abilityPoint = goal.abilityPoint || '';
  if (abilityCategory === '体育与健康') return '体育健康目标';
  if (abilityPoint.includes('阅读')) return '阅读目标';
  if (abilityCategory === '学习习惯') return '习惯养成目标';
  if (abilityCategory === '学科能力') return '学科训练目标';
  return '能力提升目标';
}

export function getGoalGaps(goal: ReadinessGoal): GoalGap[] {
  const gaps: GoalGap[] = [];
  if (!goal.goalDirection) gaps.push({ label: '缺目标方向', action: '补目标方向' });
  if (!goal.abilityCategory || !goal.abilityPoint) gaps.push({ label: '缺能力点', action: '补能力点' });
  if (!goal.successCriteria?.trim() && !goal.target?.trim()) gaps.push({ label: '缺成功标准', action: '补完成标准' });
  if ((goal.linkedTaskIds || []).length === 0) gaps.push({ label: '缺支撑任务', action: '关联任务' });
  if (!(goal.reviewNotes || []).length) gaps.push({ label: '缺复盘记录', action: '记录复盘' });
  return gaps;
}

export function getGoalReadinessState(goal: ReadinessGoal): GoalReadinessState {
  if (!goal.title || !goal.goalDirection || !goal.abilityPoint || !goal.successCriteria) return '待建立';
  if ((goal.linkedTaskIds || []).length === 0) return '待支撑';
  if (goal.status === 'attention') return '需关注';
  if ((goal.reviewNotes || []).length > 0) return '可复盘';
  return '推进中';
}

export function getGoalNextAction(goal: ReadinessGoal) {
  const gaps = getGoalGaps(goal);
  if (gaps.some(gap => gap.label === '缺能力点')) return '补能力点';
  if (gaps.some(gap => gap.label === '缺成功标准')) return '补完成标准';
  if (gaps.some(gap => gap.label === '缺支撑任务')) return '关联任务';
  if (goal.status === 'attention') return '做一次复盘';
  if (gaps.some(gap => gap.label === '缺复盘记录')) return '记录复盘';
  return '保持节奏';
}

export function normalizeReadinessGoal(goal: ReadinessGoal): ReadinessGoal & Required<Pick<ReadinessGoal, 'goalDirection' | 'goalType' | 'goalCycle' | 'successCriteria' | 'linkedTasks' | 'linkedTaskIds' | 'reviewNotes'>> {
  const goalDirection = goal.goalDirection || inferGoalDirection(goal.abilityCategory, goal.abilityPoint);
  return {
    ...goal,
    goalDirection,
    goalType: goal.goalType || inferGoalType(goal),
    goalCycle: goal.goalCycle || '四周周期',
    successCriteria: goal.successCriteria || goal.target || '',
    linkedTasks: Array.isArray(goal.linkedTasks) ? goal.linkedTasks : [],
    linkedTaskIds: Array.isArray(goal.linkedTaskIds) ? goal.linkedTaskIds : [],
    reviewNotes: Array.isArray(goal.reviewNotes) ? goal.reviewNotes : [],
  };
}

export function buildAbilityRelationCounts(goals: ReadinessGoal[], tasks: ReadinessTask[]): AbilityRelationCounts {
  const counts: AbilityRelationCounts = {};

  goals.forEach((goal) => {
    const point = goal.abilityPoint?.trim();
    if (!point) return;
    counts[point] = counts[point] || { goals: 0, tasks: 0 };
    counts[point].goals += 1;
  });

  tasks.forEach((task) => {
    const point = task.tags?.abilityPoint?.trim();
    if (!point) return;
    counts[point] = counts[point] || { goals: 0, tasks: 0 };
    counts[point].tasks += 1;
  });

  return counts;
}
