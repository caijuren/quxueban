import { describe, expect, it } from 'vitest';
import {
  buildAbilityRelationCounts,
  getGoalGaps,
  getGoalNextAction,
  getGoalReadinessState,
  inferGoalDirection,
  normalizeReadinessGoal,
} from '@/lib/readiness-goals';

describe('三层目标准备规则', () => {
  it('按能力点推断目标方向', () => {
    expect(inferGoalDirection('交付层', '英语能力')).toBe('英语强化');
    expect(inferGoalDirection('认知层', '规则内化')).toBe('数理逻辑');
    expect(inferGoalDirection('交付层', '大语文阅读表达')).toBe('阅读表达');
    expect(inferGoalDirection('稳定性层', '睡眠作息')).toBe('稳定执行');
  });

  it('兼容旧目标并补齐关键字段', () => {
    const goal = normalizeReadinessGoal({
      title: '数学计算稳定性',
      abilityCategory: '学科能力',
      abilityPoint: '数学能力',
      target: '正确率 90%',
      linkedTasks: undefined,
      linkedTaskIds: undefined,
      reviewNotes: undefined,
    });

    expect(goal.goalDirection).toBe('数理逻辑');
    expect(goal.goalType).toBe('学科训练目标');
    expect(goal.goalCycle).toBe('四周周期');
    expect(goal.successCriteria).toBe('正确率 90%');
    expect(goal.linkedTasks).toEqual([]);
    expect(goal.linkedTaskIds).toEqual([]);
    expect(goal.reviewNotes).toEqual([]);
  });

  it('输出目标缺口、准备状态和下一步动作', () => {
    const missingSupport = normalizeReadinessGoal({
      title: '英语能力提升目标',
      abilityCategory: '交付层',
      abilityPoint: '英语能力',
      successCriteria: '每周完成三次听读复述',
      status: 'on-track',
    });

    expect(getGoalGaps(missingSupport).map(gap => gap.label)).toContain('缺支撑任务');
    expect(getGoalReadinessState(missingSupport)).toBe('待支撑');
    expect(getGoalNextAction(missingSupport)).toBe('关联任务');

    const readyGoal = normalizeReadinessGoal({
      title: '阅读表达目标',
      abilityCategory: '交付层',
      abilityPoint: '大语文',
      successCriteria: '每周完成两次复述',
      linkedTaskIds: [1],
      reviewNotes: [{ id: 'r1' }],
      status: 'on-track',
    });

    expect(getGoalReadinessState(readyGoal)).toBe('可复盘');
    expect(getGoalNextAction(readyGoal)).toBe('保持节奏');
  });

  it('按能力点统计关联目标和任务', () => {
    const counts = buildAbilityRelationCounts(
      [
        { abilityPoint: '英语能力' },
        { abilityPoint: '英语能力' },
        { abilityPoint: '睡眠作息' },
      ],
      [
        { id: 1, name: 'RAZ 听读', tags: { abilityPoint: '英语能力' } },
        { id: 2, name: '早睡打卡', tags: { abilityPoint: '睡眠作息' } },
        { id: 3, name: '未归类任务', tags: {} },
      ]
    );

    expect(counts['英语能力']).toEqual({ goals: 2, tasks: 1 });
    expect(counts['睡眠作息']).toEqual({ goals: 1, tasks: 1 });
    expect(counts['未归类任务']).toBeUndefined();
  });
});
