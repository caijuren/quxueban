import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { env } from '../config/env'
import { isChinaPublicHoliday } from '../utils/china-holidays'

export const tasksRouter: Router = Router()

tasksRouter.use(authMiddleware)
tasksRouter.use(requireRole('parent'))

const CATEGORY_MAP: Record<string, string> = {
  '校内巩固': 'school', '校内拔高': 'advanced', '课外课程': 'extra',
  '英语阅读': 'english', '体育运动': 'sports', '中文阅读': 'chinese',
}
const TYPE_MAP: Record<string, string> = {
  '固定': 'fixed', '灵活': 'flexible', '跟随学校': 'follow',
}
const CATEGORY_REVERSE_MAP: Record<string, string> = {
  'school': '校内巩固', 'extra': '课外课程', 'advanced': '校内拔高',
  'english': '英语阅读', 'sports': '体育运动', 'chinese': '中文阅读',
}
const TYPE_REVERSE_MAP: Record<string, string> = {
  'fixed': '固定', 'flexible': '灵活', 'follow': '跟随学校',
}

const VALID_SUBJECTS = ['chinese', 'math', 'english', 'sports', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics']
const VALID_PARENT_ROLES = ['independent', 'accompany', 'parent-led']
const VALID_DIFFICULTIES = ['basic', 'advanced', 'challenge']
const VALID_AMOUNT_UNITS = ['page', 'chapter', 'section', 'time', 'question']
const VALID_TRACKING_TYPES = ['simple', 'numeric', 'progress']
const OPTIONAL_TAG_KEYS = ['taskKind', 'level', 'abilityCategory', 'abilityPoint', 'linkedGoal', 'targetType', 'timeBlock']

const SUBJECT_MAP: Record<string, string> = { chinese: '语文', math: '数学', english: '英语', sports: '体育' }
const PARENT_ROLE_MAP: Record<string, string> = { independent: '独立完成', accompany: '家长陪伴', 'parent-led': '家长主导', parent: '家长主导' }
const DIFFICULTY_MAP: Record<string, string> = { basic: '普通', advanced: '提升', challenge: '挑战' }

function normalizeAppliesTo(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return normalizeAppliesTo(parsed)
    } catch {
      return []
    }
  }

  return []
}

async function ensureChildrenBelongToFamily(childIds: number[], familyId: number) {
  if (childIds.length === 0) {
    throw new AppError(400, 'Task must be assigned to at least one child (appliesTo is required)')
  }

  const children = await prisma.user.findMany({
    where: {
      id: { in: childIds },
      familyId,
      role: 'child',
      status: 'active',
    },
    select: { id: true },
  })

  if (children.length !== childIds.length) {
    throw new AppError(400, 'Some assigned children do not belong to the current family')
  }
}

function parseTaskTags(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }

  return {}
}

function normalizeTaskTags(value: unknown): Record<string, unknown> {
  const tags = parseTaskTags(value)
  const metadata = parseTaskTags((tags as any).metadata)
  return { ...metadata, ...tags }
}

function getEffectiveScheduleRule(task: { schedule_rule?: unknown; tags?: unknown; weekly_rule?: unknown }): string {
  const taskTags = parseTaskTags(task.tags)
  const weeklyRule = parseTaskTags(task.weekly_rule)
  const scheduleRuleFromColumn = typeof task.schedule_rule === 'string' ? task.schedule_rule : ''
  const scheduleRuleFromTags = typeof taskTags.scheduleRule === 'string' ? taskTags.scheduleRule : ''
  const scheduleRuleFromWeeklyRule = typeof weeklyRule.scheduleRule === 'string' ? weeklyRule.scheduleRule : ''

  const validRules = ['daily', 'school', 'weekend', 'flexible']
  const isValidRule = (value: string) => validRules.includes(value)

  // Legacy compatibility:
  // many old tasks kept the real rule in tags.scheduleRule while schedule_rule stayed at the default daily.
  if (isValidRule(scheduleRuleFromTags) && (scheduleRuleFromColumn === 'daily' || !isValidRule(scheduleRuleFromColumn))) {
    return scheduleRuleFromTags
  }

  if (isValidRule(scheduleRuleFromColumn)) {
    return scheduleRuleFromColumn
  }

  if (isValidRule(scheduleRuleFromTags)) {
    return scheduleRuleFromTags
  }

  if (isValidRule(scheduleRuleFromWeeklyRule)) {
    return scheduleRuleFromWeeklyRule
  }

  return 'daily'
}

function formatTaskRecord(task: any) {
  const taskTags = normalizeTaskTags(task.tags)
  const scheduleRule = getEffectiveScheduleRule(task)

  return {
    id: task.id,
    familyId: task.family_id,
    name: task.name,
    category: CATEGORY_REVERSE_MAP[task.category] || task.category,
    type: TYPE_REVERSE_MAP[task.type] || task.type,
    timePerUnit: task.time_per_unit,
    weeklyRule: task.weekly_rule,
    sortOrder: task.sort_order,
    isActive: task.is_active,
    tags: taskTags,
    appliesTo: normalizeAppliesTo(task.applies_to),
    scheduleRule,
    trackingType: task.tracking_type || 'simple',
    trackingUnit: task.tracking_unit || '',
    targetValue: task.target_value || 0,
    weeklyFrequency: task.weekly_frequency || taskTags.weeklyFrequency || null,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  }
}

function appendOptionalTaskTags(source: any, target: Record<string, any>) {
  if (!source || typeof source !== 'object') return

  for (const key of OPTIONAL_TAG_KEYS) {
    if (typeof source[key] === 'string') {
      const value = source[key].trim().slice(0, 80)
      if (value) target[key] = value
    }
  }
}

function ensureAbilityPoint(tags: unknown) {
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) {
    throw new AppError(400, '任务必须关联至少一个能力点')
  }

  const abilityPoint = typeof (tags as any).abilityPoint === 'string'
    ? (tags as any).abilityPoint.trim()
    : ''

  if (!abilityPoint) {
    throw new AppError(400, '任务必须关联至少一个能力点')
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateForDayIndex(weekStartDate: Date, dayIndex: number): Date {
  const date = new Date(weekStartDate)
  const offset = dayIndex === 0 ? 6 : dayIndex - 1
  date.setDate(weekStartDate.getDate() + offset)
  return date
}

function removePublicHolidays(weekStartDate: Date, allowedDays: number[]): number[] {
  return allowedDays.filter((dayIndex) => {
    const date = getDateForDayIndex(weekStartDate, dayIndex)
    return !isChinaPublicHoliday(formatLocalDate(date))
  })
}

tasksRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { name, category, type, timePerUnit, weeklyRule, tags, appliesTo, childId, weeklyFrequency, trackingType, trackingUnit, targetValue } = req.body
  const { familyId } = req.user!
  if (!name || !category || !type) throw new AppError(400, 'Missing required fields: name, category, type')
  ensureAbilityPoint(tags)

  const mappedCategory = CATEGORY_MAP[category] || category
  if (!['school', 'extra', 'advanced', 'english', 'sports', 'chinese'].includes(mappedCategory)) throw new AppError(400, 'Invalid category')

  const mappedType = TYPE_MAP[type] || type
  if (!['fixed', 'flexible', 'follow'].includes(mappedType)) throw new AppError(400, 'Invalid type')

  let validatedTags: any = {}
  if (tags && typeof tags === 'object') {
    if (tags.subject && VALID_SUBJECTS.includes(tags.subject)) validatedTags.subject = tags.subject
    if (tags.parentRole && VALID_PARENT_ROLES.includes(tags.parentRole)) validatedTags.parentRole = tags.parentRole
    if (tags.difficulty && VALID_DIFFICULTIES.includes(tags.difficulty)) validatedTags.difficulty = tags.difficulty
    if (tags.totalAmount?.value > 0 && VALID_AMOUNT_UNITS.includes(tags.totalAmount.unit)) validatedTags.totalAmount = tags.totalAmount
    appendOptionalTaskTags(tags, validatedTags)
  }

  const scheduleRule = tags?.scheduleRule && ['daily', 'school', 'weekend', 'flexible'].includes(tags.scheduleRule) ? tags.scheduleRule : 'daily'
  if (scheduleRule) validatedTags.scheduleRule = scheduleRule
  if (Number(weeklyFrequency) > 0) validatedTags.weeklyFrequency = Number(weeklyFrequency)
  const nextTrackingType = VALID_TRACKING_TYPES.includes(trackingType) ? trackingType : 'simple'
  const nextTrackingUnit = nextTrackingType === 'simple' ? '' : (typeof trackingUnit === 'string' ? trackingUnit : '')
  const nextTargetValue = Number(targetValue) > 0 ? Number(targetValue) : null
  const normalizedAppliesTo = normalizeAppliesTo(appliesTo)
  const effectiveAppliesTo = normalizedAppliesTo.length > 0
    ? normalizedAppliesTo
    : (Number.isInteger(Number(childId)) && Number(childId) > 0 ? [Number(childId)] : [])

  await ensureChildrenBelongToFamily(effectiveAppliesTo, familyId)

  const createdRows = await prisma.$queryRaw`
    INSERT INTO tasks (
      family_id,
      name,
      category,
      type,
      time_per_unit,
      weekly_rule,
      sort_order,
      is_active,
      tags,
      applies_to,
      schedule_rule,
      tracking_type,
      tracking_unit,
      target_value,
      weekly_frequency,
      created_at,
      updated_at
    ) VALUES (
      ${familyId},
      ${name},
      ${mappedCategory},
      ${mappedType},
      ${timePerUnit || 30},
      ${JSON.stringify(weeklyRule || {})}::jsonb,
      0,
      true,
      ${JSON.stringify(validatedTags)}::jsonb,
      ${JSON.stringify(effectiveAppliesTo)}::jsonb,
      ${scheduleRule},
      ${nextTrackingType},
      ${nextTrackingUnit},
      ${nextTargetValue},
      ${Number(weeklyFrequency) > 0 ? Number(weeklyFrequency) : null},
      NOW(),
      NOW()
    )
    RETURNING id, family_id, name, category, type, time_per_unit, weekly_rule, sort_order, is_active, tags, applies_to, schedule_rule, tracking_type, tracking_unit, target_value, weekly_frequency, created_at, updated_at
  ` as any[]

  res.status(201).json({ status: 'success', message: 'Task created', data: formatTaskRecord(createdRows[0]) })
})

tasksRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = req.query.childId ? parseInt(req.query.childId as string) : null

  // 强制要求提供childId参数，确保数据隔离
  if (!childId) {
    throw new AppError(400, 'Missing required parameter: childId. Data isolation is mandatory.')
  }

  // Handle mock mode
  if (!env.DATABASE_URL) {
    const mockTasks = [
      {
        id: 1,
        familyId: familyId,
        name: '语文阅读',
        category: '中文阅读',
        type: '固定',
        timePerUnit: 30,
        weeklyRule: {},
        sortOrder: 1,
        isActive: true,
        appliesTo: [2, 3],
        tags: {
          subject: 'chinese',
          parentRole: 'accompany',
          difficulty: 'basic',
          scheduleRule: 'daily'
        },
        scheduleRule: 'daily',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 2,
        familyId: familyId,
        name: '数学练习',
        category: '校内巩固',
        type: '固定',
        timePerUnit: 25,
        weeklyRule: {},
        sortOrder: 2,
        isActive: true,
        appliesTo: [2],
        tags: {
          subject: 'math',
          parentRole: 'independent',
          difficulty: 'basic',
          scheduleRule: 'school'
        },
        scheduleRule: 'school',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 3,
        familyId: familyId,
        name: '英语阅读',
        category: '英语阅读',
        type: '灵活',
        timePerUnit: 20,
        weeklyRule: {},
        sortOrder: 3,
        isActive: true,
        appliesTo: [3],
        tags: {
          subject: 'english',
          parentRole: 'parent-led',
          difficulty: 'advanced',
          scheduleRule: 'weekend'
        },
        scheduleRule: 'weekend',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]

    // Apply childId filter - 强制过滤
    const filteredTasks = mockTasks.filter(task => task.appliesTo.includes(childId))

    res.json({ status: 'success', data: filteredTasks })
    return
  }

  try {
    const tasks = await prisma.$queryRaw`
      SELECT id, family_id, name, category, type, time_per_unit,
             weekly_rule, sort_order, is_active, tags, applies_to, schedule_rule, tracking_type, tracking_unit, target_value, weekly_frequency, created_at, updated_at
      FROM tasks
      WHERE family_id = ${familyId} AND is_active = true
      ORDER BY sort_order, created_at DESC
    ` as any[]

    const formattedTasks = tasks
      .filter((task) => {
        const normalized = normalizeAppliesTo(task.applies_to)
        return normalized.includes(childId) || normalized.length === 0
      })
      .map((task) => formatTaskRecord(task))
    res.json({ status: 'success', data: formattedTasks })
  } catch (error: any) {
    console.error('[GET TASKS] Error:', error)
    throw new AppError(500, 'Failed to get tasks: ' + error.message)
  }
})

tasksRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const { name, category, type, timePerUnit, tags, appliesTo, childId, scheduleRule, weeklyFrequency, trackingType, trackingUnit, targetValue } = req.body
  
  // 强制要求提供childId参数，确保数据隔离
  if (!childId) {
    throw new AppError(400, 'Missing required parameter: childId. Data isolation is mandatory.')
  }
  if (tags !== undefined) {
    ensureAbilityPoint(tags)
  }

  const mappedCategory = category ? (CATEGORY_MAP[category] || category) : undefined
  const mappedType = type ? (TYPE_MAP[type] || type) : undefined

  const existingRows = await prisma.$queryRaw`
    SELECT id, applies_to
    FROM tasks
    WHERE id = ${id} AND family_id = ${familyId} AND is_active = true
  ` as any[]
  const existing = existingRows[0]
  if (!existing) throw new AppError(404, 'Task not found')

  const existingAppliesTo = normalizeAppliesTo(existing.applies_to)
  const nextAppliesTo = normalizeAppliesTo(appliesTo)
  const effectiveAppliesTo = nextAppliesTo.length > 0 ? nextAppliesTo : existingAppliesTo

  if (!effectiveAppliesTo.includes(Number(childId))) {
    effectiveAppliesTo.push(Number(childId))
  }

  await ensureChildrenBelongToFamily(effectiveAppliesTo, familyId)

  let validatedTags: any = {}
  if (tags?.subject && VALID_SUBJECTS.includes(tags.subject)) validatedTags.subject = tags.subject
  if (tags?.parentRole && VALID_PARENT_ROLES.includes(tags.parentRole)) validatedTags.parentRole = tags.parentRole
  if (tags?.difficulty && VALID_DIFFICULTIES.includes(tags.difficulty)) validatedTags.difficulty = tags.difficulty
  if (tags?.totalAmount?.value > 0 && tags?.totalAmount?.unit && VALID_AMOUNT_UNITS.includes(tags.totalAmount.unit)) validatedTags.totalAmount = tags.totalAmount
  appendOptionalTaskTags(tags, validatedTags)
  const bodyScheduleRule = tags?.scheduleRule || scheduleRule
  if (bodyScheduleRule && ['daily', 'school', 'weekend', 'flexible'].includes(bodyScheduleRule)) validatedTags.scheduleRule = bodyScheduleRule
  if (Number(weeklyFrequency) > 0) validatedTags.weeklyFrequency = Number(weeklyFrequency)

  const nextScheduleRule = bodyScheduleRule && ['daily', 'school', 'weekend', 'flexible'].includes(bodyScheduleRule)
    ? bodyScheduleRule
    : null
  const nextTrackingType = VALID_TRACKING_TYPES.includes(trackingType) ? trackingType : null
  const nextTrackingUnit = typeof trackingUnit === 'string' ? trackingUnit : null
  const nextTargetValue = Number(targetValue) > 0 ? Number(targetValue) : null
  const nextWeeklyFrequency = Number(weeklyFrequency) > 0 ? Number(weeklyFrequency) : null

  const updatedRows = await prisma.$queryRaw`
    UPDATE tasks
    SET
      name = COALESCE(${name}, name),
      category = COALESCE(${mappedCategory}, category),
      type = COALESCE(${mappedType}, type),
      time_per_unit = COALESCE(${timePerUnit}, time_per_unit),
      tags = CASE
        WHEN ${Object.keys(validatedTags).length > 0} THEN ${JSON.stringify(validatedTags)}::jsonb
        ELSE tags
      END,
      applies_to = ${JSON.stringify(effectiveAppliesTo)}::jsonb,
      schedule_rule = COALESCE(${nextScheduleRule}, schedule_rule),
      tracking_type = COALESCE(${nextTrackingType}, tracking_type),
      tracking_unit = COALESCE(${nextTrackingUnit}, tracking_unit),
      target_value = ${nextTargetValue},
      weekly_frequency = ${nextWeeklyFrequency},
      updated_at = NOW()
    WHERE id = ${id} AND family_id = ${familyId}
    RETURNING id, family_id, name, category, type, time_per_unit, weekly_rule, sort_order, is_active, tags, applies_to, schedule_rule, tracking_type, tracking_unit, target_value, weekly_frequency, created_at, updated_at
  ` as any[]

  res.json({ status: 'success', message: 'Task updated', data: formatTaskRecord(updatedRows[0]) })
})

tasksRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!

  const task = await prisma.$queryRaw`
    SELECT id
    FROM tasks
    WHERE id = ${id} AND family_id = ${familyId} AND is_active = true
  ` as any[]
  if (!task.length) throw new AppError(404, '任务不存在')

  await prisma.$executeRaw`
    UPDATE tasks
    SET is_active = false, updated_at = NOW()
    WHERE id = ${id} AND family_id = ${familyId}
  `
  res.json({ status: 'success', message: 'Task deleted' })
})

/**
 * POST /publish - 发布下周计划
 * Body: { childIds, weekNo, weekStartDate?, selectedTaskIds?, taskRules? }
 */
tasksRouter.post('/publish', async (req: AuthRequest, res: Response) => {
  try {
  const { childIds, weekNo, weekStartDate: requestedWeekStartDate, selectedTaskIds, taskRules, skipHolidays = true } = req.body
  const { familyId } = req.user!

  console.log('[PUBLISH] Request:', { childIds, weekNo, weekStartDate: requestedWeekStartDate, selectedTaskIds, taskRules })

  if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
    throw new AppError(400, 'Missing or invalid childIds')
  }

  if (!weekNo) {
    throw new AppError(400, 'Missing weekNo')
  }

  // 获取所有活跃任务
  let tasks = await prisma.$queryRaw`
    SELECT id, family_id, name, category, type, time_per_unit,
           weekly_rule, sort_order, is_active, tags, applies_to, schedule_rule, created_at, updated_at
    FROM tasks
    WHERE family_id = ${familyId} AND is_active = true
    ORDER BY sort_order ASC
  ` as any[]

  // 如果前端明确选择了任务，只发布这些任务
  if (Array.isArray(selectedTaskIds) && selectedTaskIds.length > 0) {
    const selectedTaskIdSet = new Set(
      selectedTaskIds
        .map((id: unknown) => Number(id))
        .filter((id: number) => Number.isFinite(id))
    )
    tasks = tasks.filter(task => selectedTaskIdSet.has(task.id))
  }

  if (tasks.length === 0) {
    throw new AppError(400, 'No active tasks found. Please create tasks first.')
  }

  // 验证孩子属于该家庭
  const children = await prisma.user.findMany({
    where: {
      id: { in: childIds },
      familyId,
      role: 'child',
      status: 'active',
    },
  })

  if (children.length !== childIds.length) {
    throw new AppError(400, 'Some children not found or do not belong to your family')
  }

  // 解析周开始日期。新版前端会直接传 weekStartDate，避免前后端周序号算法在跨年周发生偏差。
  const [year, week] = weekNo.split('-').map(Number)
  const weekStartDate = parseWeekStartDate(requestedWeekStartDate) || getWeekStartDate(year, week)

  console.log('[PUBLISH] Week start:', weekStartDate)

  // 计算每周安排
  const results: any[] = []

  await prisma.$transaction(async (tx) => {
    for (const child of children) {
      // 删除该周的现有计划
      await tx.weeklyPlan.deleteMany({
        where: { childId: child.id, weekNo },
      })

      const allocation: any[] = []

      // 过滤适用于该孩子的任务
      const childTasks = tasks.filter(task => {
        const appliesTo = normalizeAppliesTo(task.applies_to)
        return appliesTo.includes(child.id) || appliesTo.length === 0
      })

      for (const task of childTasks) {
        // 优先使用前端传入的规则，否则沿用任务原有规则
        const customRule = taskRules && typeof taskRules === 'object' ? taskRules[task.id] : undefined
        const taskTags = parseTaskTags(task.tags)
        const scheduleRule = customRule || getEffectiveScheduleRule(task)

        // 使用 JavaScript 标准星期索引：0=周日, 1=周一, ..., 6=周六
        let allowedDays: number[]
        switch (scheduleRule) {
          case 'school':
            allowedDays = [1, 2, 4, 5] // 周一、周二、周四、周五
            break
          case 'weekend':
            allowedDays = [0, 6] // 周日、周六
            break
          case 'flexible':
            allowedDays = [1, 2, 3, 4, 5] // 周一到周五
            break
          case 'daily':
          default:
            allowedDays = [0, 1, 2, 3, 4, 5, 6] // 每天
        }

        // 直接分配到所有允许的日期（简化：不考虑时间限制）
        const daysAllocated = skipHolidays ? removePublicHolidays(weekStartDate, allowedDays) : allowedDays

        // 创建周计划，即使没有分配到任何天数也创建
        const target = daysAllocated.length
        await tx.$executeRaw`
          INSERT INTO weekly_plans (
            family_id,
            child_id,
            task_id,
            target,
            progress,
            week_no,
            status,
            assigned_days,
            created_at,
            updated_at
          ) VALUES (
            ${familyId},
            ${child.id},
            ${task.id},
            ${target},
            0,
            ${weekNo},
            ${target > 0 ? 'active' : 'inactive'},
            ${JSON.stringify(daysAllocated)}::jsonb,
            NOW(),
            NOW()
          )
        `

        allocation.push({
          taskId: task.id,
          taskName: task.name,
          assignedDays: daysAllocated,
        })
      }

      results.push({
        childId: child.id,
        childName: child.name,
        allocation,
      })
    }
  })

  console.log('[PUBLISH] Success:', { weekNo, children: results.length })

  res.json({
    status: 'success',
    message: 'Weekly plan published successfully',
    data: {
      weekNo,
      weekStartDate: weekStartDate.toISOString().slice(0, 10),
      children: results,
    },
  })
  } catch (error) {
    console.error('[PUBLISH] ERROR:', error)
    if (error instanceof Error) {
      console.error('[PUBLISH] Error message:', error.message)
      console.error('[PUBLISH] Error stack:', error.stack)
    }
    if (!(error instanceof AppError)) {
      throw new AppError(500, 'Failed to publish plan: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    throw error
  }
})

/**
 * GET /:id - 获取单个任务详情
 */
tasksRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!

  const task = await prisma.$queryRaw`SELECT * FROM tasks WHERE id = ${id} AND family_id = ${familyId} LIMIT 1` as any[]

  if (!task || task.length === 0) {
    throw new AppError(404, 'Task not found')
  }

  // 从tags中提取scheduleRule
  let taskTags = task[0].tags || {};
  if (typeof taskTags === 'string') {
    try {
      taskTags = JSON.parse(taskTags);
    } catch (e) {
      taskTags = {};
    }
  }
  const scheduleRule = getEffectiveScheduleRule(task[0]);

  res.json({
    status: 'success',
    data: {
      id: task[0].id,
      familyId: task[0].family_id,
      name: task[0].name,
      category: CATEGORY_REVERSE_MAP[task[0].category] || task[0].category,
      type: TYPE_REVERSE_MAP[task[0].type] || task[0].type,
      timePerUnit: task[0].time_per_unit,
      weeklyRule: task[0].weekly_rule,
      tags: typeof taskTags === 'object' ? taskTags : {},
      appliesTo: task[0].applies_to || [],
      scheduleRule: scheduleRule,
      createdAt: task[0].created_at,
      updatedAt: task[0].updated_at,
      // 精细化记录字段
      trackingType: task[0].tracking_type,
      trackingUnit: task[0].tracking_unit,
      targetValue: task[0].target_value,
      weeklyFrequency: task[0].weekly_frequency,
    },
  })
})

/**
 * 辅助函数：根据年份和周数获取周开始日期（周一）
 * 按照中国习惯，周一开始，周日结束
 */
function getWeekStartDate(year: number, week: number): Date {
  const jan1 = new Date(year, 0, 1)
  const dayOfWeek = jan1.getDay() // 0=周日, 1=周一, ..., 6=周六
  // 计算到第一个周一的天数
  // 如果1月1日是周日(0)，需要加1天到周一
  // 如果1月1日是周一(1)，不需要加
  // 如果1月1日是周二(2)，需要加6天到下周周一
  const daysToFirstMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek)
  const firstMonday = new Date(jan1)
  firstMonday.setDate(jan1.getDate() + daysToFirstMonday)
  
  const weekStart = new Date(firstMonday)
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7)
  
  return weekStart
}

function parseWeekStartDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new AppError(400, 'Invalid weekStartDate')
  }

  return date
}

export default tasksRouter
