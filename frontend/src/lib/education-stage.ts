export type EducationStage = 'primary' | 'middle';

export type StageAbilityDimension = {
  key: string;
  label: string;
  description: string;
};

export const educationStageOptions: Array<{
  value: EducationStage;
  label: string;
  description: string;
}> = [
  { value: 'primary', label: '小学阶段', description: '侧重习惯、阅读、专注和基础能力' },
  { value: 'middle', label: '初中阶段', description: '侧重学科、错题、复习和学习效率' },
];

export const primaryAbilityDimensions: StageAbilityDimension[] = [
  { key: 'study_habit', label: '学习习惯', description: '学习节律、任务启动和持续完成情况' },
  { key: 'focus_execution', label: '专注与执行', description: '专注时长、抗干扰和执行稳定性' },
  { key: 'reading_comprehension', label: '阅读理解', description: '信息提取、理解深度和阅读积累' },
  { key: 'expression_output', label: '表达输出', description: '口头表达、写作输出和复述总结' },
  { key: 'basic_chinese', label: '基础语文', description: '字词、古诗文、阅读和基础写作' },
  { key: 'math_thinking', label: '数学思维', description: '计算、逻辑、应用题和数感' },
  { key: 'english_literacy', label: '英语核心素养', description: '分级阅读、听说表达和词汇积累' },
  { key: 'science_exploration', label: '科学探索', description: '观察、提问、实验和解释能力' },
  { key: 'sports_health', label: '运动健康', description: '运动习惯、体能和作息健康' },
  { key: 'life_self_care', label: '生活自理', description: '整理、计划、责任感和独立性' },
];

export const middleAbilityDimensions: StageAbilityDimension[] = [
  { key: 'chinese_subject', label: '语文能力', description: '阅读理解、文言文、作文和表达' },
  { key: 'math_subject', label: '数学能力', description: '计算、代数、几何和综合应用' },
  { key: 'english_subject', label: '英语能力', description: '词汇、语法、阅读、听说和写作' },
  { key: 'science_subject', label: '科学/物理/化学', description: '概念理解、实验分析和综合推理' },
  { key: 'humanities_subject', label: '历史/地理/道法', description: '知识结构、材料分析和表达组织' },
  { key: 'mistake_review', label: '错题复盘', description: '错因归类、订正质量和举一反三' },
  { key: 'logical_thinking', label: '思维逻辑', description: '抽象、推理、归纳和迁移能力' },
  { key: 'time_management', label: '时间管理', description: '计划分配、效率和复习节奏' },
  { key: 'exam_strategy', label: '考试策略', description: '审题、取舍、节奏和稳定发挥' },
  { key: 'self_learning', label: '自主学习', description: '预习、复盘、自查和主动提问' },
];

export const middleSubjectOptions = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道法'];

export const primaryTimeBlockOptions = ['晨读', '放学后', '晚饭后', '睡前', '周末上午', '周末下午'];

export const targetTypeOptions = [
  { value: 'habit_process', label: '习惯过程' },
  { value: 'skill_growth', label: '能力成长' },
  { value: 'knowledge_mastery', label: '知识掌握' },
  { value: 'exam_result', label: '考试结果' },
  { value: 'reading_level', label: '阅读等级' },
];

export function getAbilityDimensions(stage: EducationStage): StageAbilityDimension[] {
  return stage === 'middle' ? middleAbilityDimensions : primaryAbilityDimensions;
}

export function getEducationStageLabel(stage?: string): string {
  return educationStageOptions.find((option) => option.value === stage)?.label || '小学阶段';
}
