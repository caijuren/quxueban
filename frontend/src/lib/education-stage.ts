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
  { value: 'primary', label: '小学阶段', description: '侧重三公准备度、认知能级和稳定执行' },
  { value: 'middle', label: '初中阶段', description: '侧重学科交付、认知方法和复习稳定性' },
];

export const primaryAbilityDimensions: StageAbilityDimension[] = [
  { key: 'english_delivery', label: '英语能力', description: '交付层：原版阅读、听说表达和结构化输出' },
  { key: 'math_delivery', label: '数理逻辑', description: '交付层：数学思维、快速规则学习和稳定解题' },
  { key: 'chinese_delivery', label: '大语文', description: '交付层：中文阅读、古文国学、百科文史和表达写作' },
  { key: 'project_delivery', label: '项目成果', description: '交付层：荣誉、作品、活动经历和可展示材料' },
  { key: 'interview_delivery', label: '临场应变', description: '交付层：面谈表达、现场推理和综合沟通' },
  { key: 'rule_internalization', label: '规则内化', description: '认知层：面对新规则时能否理解并稳定应用' },
  { key: 'transfer_application', label: '迁移应用', description: '认知层：能否把方法迁移到新题型或跨学科任务' },
  { key: 'processing_speed', label: '信息处理速度', description: '认知层：单位时间内理解、筛选和作答的效率' },
  { key: 'logical_depth', label: '逻辑深度', description: '认知层：条件、步骤、依据和反例是否完整' },
  { key: 'stability_execution', label: '执行完成率', description: '稳定性层：任务启动、持续完成和计划可运行性' },
  { key: 'review_frequency', label: '复盘频率', description: '稳定性层：错因记录、讲题复盘和下次修正' },
  { key: 'sleep_emotion', label: '睡眠情绪', description: '稳定性层：睡眠、运动、情绪和外部负载' },
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
