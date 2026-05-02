import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  EducationStage,
  getAbilityDimensions,
  getEducationStageLabel,
  middleSubjectOptions,
  primaryTimeBlockOptions,
  targetTypeOptions,
} from '@/lib/education-stage';
import { getReadinessLayerByText } from '@/lib/readiness-model';
import { cn } from '@/lib/utils';

export type TaskCategory = '校内巩固' | '校内拔高' | '课外课程' | '英语阅读' | '体育运动' | '中文阅读';
export type TaskType = '固定' | '灵活' | '跟随学校';
export type ScheduleRule = 'daily' | 'school' | 'weekend' | 'flexible';
export type TrackingType = 'simple' | 'numeric' | 'progress';

export type TaskEditorTags = {
  subject?: string;
  parentRole?: string;
  difficulty?: string;
  scheduleRule?: ScheduleRule;
  weeklyFrequency?: number;
  taskKind?: string;
  level?: string;
  abilityCategory?: string;
  abilityPoint?: string;
  linkedGoal?: string;
  targetType?: string;
  timeBlock?: string;
};

export type TaskEditorTask = {
  name: string;
  category: TaskCategory;
  type: TaskType;
  timePerUnit: number;
  scheduleRule?: ScheduleRule;
  weeklyFrequency?: number;
  tags?: TaskEditorTags;
  appliesTo?: number[];
  trackingType?: TrackingType;
  trackingUnit?: string;
  targetValue?: number;
};

export type TaskEditorFormData = {
  name: string;
  category: TaskCategory;
  type: TaskType;
  timePerUnit: number;
  scheduleRule: ScheduleRule;
  weeklyFrequency: number;
  subject: string;
  parentRole: string;
  difficulty: string;
  taskKind: string;
  level: string;
  abilityCategory: string;
  abilityPoint: string;
  linkedGoal: string;
  targetType: string;
  timeBlock: string;
  trackingType: TrackingType;
  trackingUnit: string;
  targetValue: number;
};

export const NO_ABILITY_POINT = '__none__';

const categoryOptions: TaskCategory[] = ['校内巩固', '校内拔高', '课外课程', '中文阅读', '英语阅读', '体育运动'];
const typeOptions: TaskType[] = ['固定', '灵活', '跟随学校'];
const taskKindOptions = ['学习', '阅读', '运动', '习惯', '生活', '情绪', '社交'];
const primaryLevelOptions = ['L1 一年级', 'L2 二年级', 'L3 三年级', 'L4 四年级', 'L5 五年级'];
const middleLevelOptions = ['L6 六年级', 'L7 初一', 'L8 初二', 'L9 初三'];
const abilityCategoryOptions = ['交付层', '认知层', '稳定性层'];
const linkedGoalOptions = ['不关联目标', '语文阅读理解', '数学计算稳定性', '每日固定学习时段', '错题复盘', '每周运动达标'];
const primarySubjectOptions = ['语文', '数学', '英语', '体育'];

const scheduleRuleLabels: Record<ScheduleRule, string> = {
  daily: '每日任务',
  school: '在校日任务',
  flexible: '智能分配',
  weekend: '周末任务',
};

const trackingTypeLabels: Record<TrackingType, string> = {
  simple: '简单记录',
  numeric: '数值记录',
  progress: '进度记录',
};

export const subjectMap: Record<string, string> = {
  '语文': 'chinese',
  '数学': 'math',
  '英语': 'english',
  '体育': 'sports',
  '物理': 'physics',
  '化学': 'chemistry',
  '生物': 'biology',
  '历史': 'history',
  '地理': 'geography',
  '道法': 'politics',
};

export const subjectReverseMap: Record<string, string> = Object.fromEntries(
  Object.entries(subjectMap).map(([label, value]) => [value, label])
);

export const parentRoleMap: Record<string, string> = {
  '独立完成': 'independent',
  '家长陪伴': 'accompany',
  '家长主导': 'parent-led',
};

export const parentRoleReverseMap: Record<string, string> = {
  independent: '独立完成',
  accompany: '家长陪伴',
  'parent-led': '家长主导',
};

export const difficultyMap: Record<string, string> = {
  '基础': 'basic',
  '提高': 'advanced',
  '挑战': 'challenge',
};

export const difficultyReverseMap: Record<string, string> = {
  basic: '基础',
  advanced: '提高',
  challenge: '挑战',
};

export function getDefaultTargetType(stage?: string) {
  return stage === 'middle' ? 'knowledge_mastery' : 'habit_process';
}

export function createDefaultTaskEditorFormData(stage?: string): TaskEditorFormData {
  const level = stage === 'middle' ? 'L7 初一' : 'L3 三年级';

  return {
    name: '',
    category: '校内巩固',
    type: '固定',
    timePerUnit: 30,
    scheduleRule: 'daily',
    weeklyFrequency: 5,
    subject: '语文',
    parentRole: '独立完成',
    difficulty: '基础',
    taskKind: '学习',
    level,
    abilityCategory: '交付层',
    abilityPoint: NO_ABILITY_POINT,
    linkedGoal: '不关联目标',
    targetType: getDefaultTargetType(stage),
    timeBlock: '',
    trackingType: 'simple',
    trackingUnit: '',
    targetValue: 0,
  };
}

export function taskToTaskEditorFormData(task: TaskEditorTask, stage?: string): TaskEditorFormData {
  const currentSubjectOptions = stage === 'middle' ? middleSubjectOptions : primarySubjectOptions;
  const currentLevelOptions = stage === 'middle' ? middleLevelOptions : primaryLevelOptions;
  const tags = task.tags || {};
  const subject = tags.subject ? subjectReverseMap[tags.subject] || currentSubjectOptions[0] : currentSubjectOptions[0];
  const level = tags.level || currentLevelOptions[0];

  return {
    name: task.name,
    category: task.category,
    type: task.type,
    timePerUnit: task.timePerUnit,
    scheduleRule: task.scheduleRule || tags.scheduleRule || 'daily',
    weeklyFrequency: task.weeklyFrequency || tags.weeklyFrequency || 5,
    subject: currentSubjectOptions.includes(subject) ? subject : currentSubjectOptions[0],
    parentRole: tags.parentRole ? parentRoleReverseMap[tags.parentRole] || '独立完成' : '独立完成',
    difficulty: tags.difficulty ? difficultyReverseMap[tags.difficulty] || '基础' : '基础',
    taskKind: tags.taskKind || '学习',
    level: currentLevelOptions.includes(level) ? level : currentLevelOptions[0],
    abilityCategory: abilityCategoryOptions.includes(tags.abilityCategory || '') ? tags.abilityCategory || '交付层' : '交付层',
    abilityPoint: tags.abilityPoint || NO_ABILITY_POINT,
    linkedGoal: tags.linkedGoal || '不关联目标',
    targetType: tags.targetType || getDefaultTargetType(stage),
    timeBlock: stage === 'primary' ? tags.timeBlock || '' : '',
    trackingType: task.trackingType || 'simple',
    trackingUnit: task.trackingUnit || '',
    targetValue: task.targetValue || 0,
  };
}

export function normalizeTaskEditorFormForStage(formData: TaskEditorFormData, stage?: EducationStage): TaskEditorFormData {
  const currentSubjectOptions = stage === 'middle' ? middleSubjectOptions : primarySubjectOptions;
  const currentLevelOptions = stage === 'middle' ? middleLevelOptions : primaryLevelOptions;
  const currentAbilityPointOptions = getAbilityDimensions(stage || 'primary').map((dimension) => dimension.label);

  return {
    ...formData,
    subject: currentSubjectOptions.includes(formData.subject) ? formData.subject : currentSubjectOptions[0],
    level: currentLevelOptions.includes(formData.level) ? formData.level : currentLevelOptions[0],
    abilityPoint: currentAbilityPointOptions.includes(formData.abilityPoint) ? formData.abilityPoint : NO_ABILITY_POINT,
    targetType: ['habit_process', 'knowledge_mastery'].includes(formData.targetType)
      ? getDefaultTargetType(stage)
      : formData.targetType || getDefaultTargetType(stage),
    timeBlock: stage === 'primary' ? formData.timeBlock : '',
  };
}

export function taskEditorFormToPayload(
  formData: TaskEditorFormData,
  childId: number | null | undefined,
  appliesTo?: number[],
) {
  return {
    childId,
    name: formData.name.trim(),
    category: formData.category,
    type: formData.type,
    timePerUnit: formData.timePerUnit,
    scheduleRule: formData.scheduleRule,
    weeklyFrequency: formData.weeklyFrequency,
    trackingType: formData.trackingType,
    trackingUnit: formData.trackingType === 'simple' ? '' : formData.trackingUnit,
    targetValue: formData.targetValue,
    appliesTo: appliesTo || (childId ? [childId] : []),
    tags: {
      subject: subjectMap[formData.subject],
      parentRole: parentRoleMap[formData.parentRole],
      difficulty: difficultyMap[formData.difficulty],
      scheduleRule: formData.scheduleRule,
      weeklyFrequency: formData.weeklyFrequency,
      taskKind: formData.taskKind,
      level: formData.level,
      abilityCategory: formData.abilityCategory,
      abilityPoint: formData.abilityPoint.trim(),
      linkedGoal: formData.linkedGoal,
      targetType: formData.targetType,
      timeBlock: formData.timeBlock,
    },
  };
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ChoiceGrid<T extends string>({
  value,
  options,
  onChange,
  getLabel = (option) => option,
  columns = 'grid-cols-2 sm:grid-cols-3',
}: {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
  columns?: string;
}) {
  return (
    <div className={cn('grid gap-2', columns)}>
      {options.map((option) => (
        <Button
          key={option}
          type="button"
          variant={value === option ? 'default' : 'outline'}
          onClick={() => onChange(option)}
          className={cn('h-10 rounded-lg', value === option ? 'bg-primary text-primary-foreground' : 'border-slate-200 bg-white hover:bg-slate-50')}
        >
          {getLabel(option)}
        </Button>
      ))}
    </div>
  );
}

export function TaskEditor({
  value,
  onChange,
  educationStage,
  childName,
  onCancel,
  onSubmit,
  isSubmitting,
  submitLabel = '保存任务',
  submittingLabel = '保存中...',
}: {
  value: TaskEditorFormData;
  onChange: (value: TaskEditorFormData) => void;
  educationStage: EducationStage;
  childName?: string;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
}) {
  const currentSubjectOptions = educationStage === 'middle' ? middleSubjectOptions : primarySubjectOptions;
  const currentLevelOptions = educationStage === 'middle' ? middleLevelOptions : primaryLevelOptions;
  const currentAbilityPointOptions = getAbilityDimensions(educationStage).map((dimension) => dimension.label);
  const readinessLayer = getReadinessLayerByText(
    value.abilityCategory,
    value.abilityPoint,
    value.targetType,
    value.category,
    value.name
  );
  const ReadinessIcon = readinessLayer.icon;

  const setValue = (updates: Partial<TaskEditorFormData>) => onChange({ ...value, ...updates });

  return (
    <div className="space-y-5">
      <FormSection title="基础信息" description={`当前孩子：${childName || '未选择'} · ${getEducationStageLabel(educationStage)}`}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>任务名称</Label>
            <Input value={value.name} onChange={(event) => setValue({ name: event.target.value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>任务分类</Label>
              <ChoiceGrid value={value.category} options={categoryOptions} onChange={(category) => setValue({ category })} columns="grid-cols-2 sm:grid-cols-3" />
            </div>
            <div className="space-y-2">
              <Label>任务性质</Label>
              <ChoiceGrid value={value.type} options={typeOptions} onChange={(type) => setValue({ type })} columns="grid-cols-3" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>单次时长（分钟）</Label>
              <Input type="number" value={value.timePerUnit} onChange={(event) => setValue({ timePerUnit: parseInt(event.target.value, 10) || 30 })} />
            </div>
            <div className="space-y-2">
              <Label>分配规则</Label>
              <ChoiceGrid
                value={value.scheduleRule}
                options={['daily', 'school', 'flexible', 'weekend']}
                onChange={(scheduleRule) => setValue({ scheduleRule })}
                getLabel={(scheduleRule) => scheduleRuleLabels[scheduleRule]}
                columns="grid-cols-2"
              />
            </div>
          </div>
          {value.scheduleRule === 'flexible' ? (
            <div className="space-y-2">
              <Label>每周次数</Label>
              <Input type="number" value={value.weeklyFrequency} onChange={(event) => setValue({ weeklyFrequency: parseInt(event.target.value, 10) || 1 })} />
            </div>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="三层归属" description="这里决定任务进入交付层、认知层还是稳定性层。">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>归属层级</Label>
            <Select value={value.abilityCategory} onValueChange={(abilityCategory) => setValue({ abilityCategory })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {abilityCategoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>能力点</Label>
            <Select value={value.abilityPoint} onValueChange={(abilityPoint) => setValue({ abilityPoint })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ABILITY_POINT}>请选择能力点</SelectItem>
                {currentAbilityPointOptions.map((point) => <SelectItem key={point} value={point}>{point}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="flex items-start gap-3">
            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg ring-1', readinessLayer.softTone)}>
              <ReadinessIcon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">当前归属：{readinessLayer.label} · {readinessLayer.english}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{readinessLayer.question}。{readinessLayer.description}</p>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="目标连接" description="把任务挂到目标体系里，方便后续看目标进度。">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>目标类型</Label>
            <Select value={value.targetType} onValueChange={(targetType) => setValue({ targetType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {targetTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>关联目标</Label>
            <Select value={value.linkedGoal} onValueChange={(linkedGoal) => setValue({ linkedGoal })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {linkedGoalOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      <FormSection title="执行设置" description="决定孩子怎么完成、难度如何，以及完成时怎么记录。">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>完成方式</Label>
            <ChoiceGrid value={value.parentRole} options={['独立完成', '家长陪伴', '家长主导']} onChange={(parentRole) => setValue({ parentRole })} columns="grid-cols-3" />
          </div>
          <div className="space-y-2">
            <Label>难度</Label>
            <ChoiceGrid value={value.difficulty} options={['基础', '提高', '挑战']} onChange={(difficulty) => setValue({ difficulty })} columns="grid-cols-3" />
          </div>
          <div className="space-y-2">
            <Label>记录类型</Label>
            <ChoiceGrid
              value={value.trackingType}
              options={['simple', 'numeric', 'progress']}
              onChange={(trackingType) => setValue({ trackingType, trackingUnit: trackingType === 'simple' ? '' : value.trackingUnit })}
              getLabel={(trackingType) => trackingTypeLabels[trackingType]}
              columns="grid-cols-3"
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {value.trackingType !== 'simple' ? (
            <>
              <div className="space-y-2">
                <Label>计量单位</Label>
                <Select value={value.trackingUnit} onValueChange={(trackingUnit) => setValue({ trackingUnit })}>
                  <SelectTrigger><SelectValue placeholder="选择单位" /></SelectTrigger>
                  <SelectContent>
                    {['页', '次', '分钟', '道', '篇', '个', '组', '字', '词', '句', '段', '章', '本', '套', '卷'].map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>目标值</Label>
                <Input type="number" value={value.targetValue || ''} onChange={(event) => setValue({ targetValue: parseInt(event.target.value, 10) || 0 })} />
              </div>
            </>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="额外字段" description="学科、年级、时间块和任务标签用于筛选与展示。">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>学科</Label>
            <ChoiceGrid value={value.subject} options={currentSubjectOptions} onChange={(subject) => setValue({ subject })} columns="grid-cols-2 sm:grid-cols-3" />
          </div>
          <div className="space-y-2">
            <Label>适用年级</Label>
            <Select value={value.level} onValueChange={(level) => setValue({ level })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currentLevelOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {educationStage === 'primary' ? (
            <div className="space-y-2">
              <Label>时间块</Label>
              <Select value={value.timeBlock || 'none'} onValueChange={(timeBlock) => setValue({ timeBlock: timeBlock === 'none' ? '' : timeBlock })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {primaryTimeBlockOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>任务类型标签</Label>
            <Select value={value.taskKind} onValueChange={(taskKind) => setValue({ taskKind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {taskKindOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          <Save className="mr-2 size-4" />
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
