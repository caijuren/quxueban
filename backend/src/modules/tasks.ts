import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { env } from '../config/env'

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

const VALID_SUBJECTS = ['chinese', 'math', 'english', 'sports']
const VALID_PARENT_ROLES = ['independent', 'accompany', 'parent-led']
const VALID_DIFFICULTIES = ['basic', 'advanced', 'challenge']
const VALID_AMOUNT_UNITS = ['page', 'chapter', 'section', 'time', 'question']

const SUBJECT_MAP: Record<string, string> = { chinese: '语文', math: '数学', english: '英语', sports: '体育' }
const PARENT_ROLE_MAP: Record<string, string> = { independent: '独立完成', accompany: '家长陪伴', 'parent-led': '家长主导', parent: '家长主导' }
const DIFFICULTY_MAP: Record<string, string> = { basic: '普通', advanced: '提升', challenge: '挑战' }



tasksRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { name, category, type, timePerUnit, weeklyRule, tags, appliesTo } = req.body
  const { familyId } = req.user!
  if (!name || !category || !type) throw new AppError(400, 'Missing required fields: name, category, type')
  if (!appliesTo || !Array.isArray(appliesTo) || appliesTo.length === 0) throw new AppError(400, 'Task must be assigned to at least one child (appliesTo is required)')

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
  }

  const scheduleRule = tags?.scheduleRule && ['daily', 'school', 'weekend', 'flexible'].includes(tags.scheduleRule) ? tags.scheduleRule : 'daily'

  const task = await prisma.task.create({
    data: { familyId, name, category: mappedCategory, type: mappedType, timePerUnit: timePerUnit || 30, weeklyRule: weeklyRule || {}, tags: validatedTags, appliesTo: appliesTo || [], scheduleRule },
  })
  res.status(201).json({ status: 'success', message: 'Task created', data: task })
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
    // 强制使用childId过滤，确保数据隔离
    let tasks = await prisma.$queryRaw`
      SELECT id, family_id, name, category, type, time_per_unit,
             weekly_rule, sort_order, is_active, tags, applies_to, schedule_rule, created_at, updated_at
      FROM tasks WHERE family_id = ${familyId} AND is_active = true ORDER BY sort_order, created_at DESC
    `
    
    // 过滤：返回分配给该孩子的任务，或者未分配的任务（兼容旧数据）
    tasks = (tasks as any[]).filter(task => {
      let appliesTo = task.applies_to || []
      // 处理applies_to可能是字符串的情况
      if (typeof appliesTo === 'string') {
        try {
          appliesTo = JSON.parse(appliesTo)
        } catch (e) {
          appliesTo = []
        }
      }
      // 确保appliesTo是数组
      if (!Array.isArray(appliesTo)) {
        appliesTo = []
      }
      // 如果appliesTo为空数组，说明任务未分配，也应该显示给所有孩子
      return appliesTo.includes(childId) || appliesTo.length === 0
    })
    
    const formattedTasks = (tasks as any[]).map(task => {
      // 优先从数据库的 schedule_rule 字段读取，其次从 tags 中提取
      let taskTags = task.tags || {};
      if (typeof taskTags === 'string') {
        try {
          taskTags = JSON.parse(taskTags);
        } catch (e) {
          taskTags = {};
        }
      }
      const scheduleRuleFromTags = (typeof taskTags === 'object' && taskTags !== null && 'scheduleRule' in taskTags)
        ? taskTags.scheduleRule
        : null;
      const scheduleRule = task.schedule_rule || scheduleRuleFromTags || 'daily';

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
        appliesTo: task.applies_to || [],
        tags: typeof taskTags === 'object' ? taskTags : {},
        scheduleRule: scheduleRule,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      };
    })
    res.json({ status: 'success', data: formattedTasks })
  } catch (error: any) {
    console.error('[GET TASKS] Error:', error)
    throw new AppError(500, 'Failed to get tasks: ' + error.message)
  }
})

tasksRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const { name, category, type, timePerUnit, tags, appliesTo, childId } = req.body
  
  // 强制要求提供childId参数，确保数据隔离
  if (!childId) {
    throw new AppError(400, 'Missing required parameter: childId. Data isolation is mandatory.')
  }
  
  if (appliesTo !== undefined) {
    if (!Array.isArray(appliesTo) || appliesTo.length === 0) {
      throw new AppError(400, 'Task must be assigned to at least one child (appliesTo cannot be empty)')
    }
  }
  
  const mappedCategory = category ? (CATEGORY_MAP[category] || category) : undefined
  const mappedType = type ? (TYPE_MAP[type] || type) : undefined
  
  const existing = await prisma.$queryRaw`SELECT id, applies_to FROM tasks WHERE id = ${id} AND family_id = ${familyId}` as any[]
  if (!existing?.length) throw new AppError(404, 'Task not found')
  
  // 验证任务是否分配给了指定的孩子
  const appliesToArray = existing[0].applies_to as number[] || []
  if (!appliesToArray.includes(childId)) {
    throw new AppError(403, 'Task is not assigned to the specified child')
  }

  let validatedTags: any = {}
  if (tags?.subject && VALID_SUBJECTS.includes(tags.subject)) validatedTags.subject = tags.subject
  if (tags?.parentRole && VALID_PARENT_ROLES.includes(tags.parentRole)) validatedTags.parentRole = tags.parentRole
  if (tags?.difficulty && VALID_DIFFICULTIES.includes(tags.difficulty)) validatedTags.difficulty = tags.difficulty
  if (tags?.totalAmount?.value > 0 && tags?.totalAmount?.unit && VALID_AMOUNT_UNITS.includes(tags.totalAmount.unit)) validatedTags.totalAmount = tags.totalAmount
  if (tags?.scheduleRule && ['daily', 'school', 'weekend', 'flexible'].includes(tags.scheduleRule)) validatedTags.scheduleRule = tags.scheduleRule

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(mappedCategory && { category: mappedCategory }),
      ...(mappedType && { type: mappedType }),
      ...(timePerUnit !== undefined && { timePerUnit }),
      ...(Object.keys(validatedTags).length > 0 && { tags: validatedTags }),
      ...(appliesTo !== undefined && { appliesTo }),
      ...(tags?.scheduleRule && ['daily', 'school', 'weekend', 'flexible'].includes(tags.scheduleRule) && { scheduleRule: tags.scheduleRule }),
      updatedAt: new Date()
    }
  })
  
  // 从tags中提取scheduleRule
  let taskTags = task.tags || {};
  if (typeof taskTags === 'string') {
    try {
      taskTags = JSON.parse(taskTags);
    } catch (e) {
      taskTags = {};
    }
  }
  const scheduleRule = (typeof taskTags === 'object' && taskTags !== null && 'scheduleRule' in taskTags) 
    ? taskTags.scheduleRule 
    : 'daily';
  
  // 构建包含scheduleRule的响应对象
  const responseTask = {
    ...task,
    scheduleRule,
    tags: typeof taskTags === 'object' ? taskTags : {}
  };
  
  res.json({ status: 'success', message: 'Task updated', data: responseTask })
})

tasksRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  
  const task = await prisma.$queryRaw`SELECT family_id FROM tasks WHERE id = ${id}` as any[]
  if (!task?.length) throw new AppError(404, '任务不存在')
  if (task[0].family_id !== familyId) throw new AppError(403, '无权限')
  
  await prisma.task.update({ where: { id }, data: { isActive: false } })
  res.json({ status: 'success', message: 'Task deleted' })
})

/**
 * POST /publish - 发布下周计划
 * Body: { childIds, weekNo, selectedTaskIds?, taskRules? }
 */
tasksRouter.post('/publish', async (req: AuthRequest, res: Response) => {
  try {
  const { childIds, weekNo, selectedTaskIds, taskRules } = req.body
  const { familyId } = req.user!

  console.log('[PUBLISH] Request:', { childIds, weekNo, selectedTaskIds, taskRules })

  if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
    throw new AppError(400, 'Missing or invalid childIds')
  }

  if (!weekNo) {
    throw new AppError(400, 'Missing weekNo')
  }

  // 获取所有活跃任务
  let tasks = await prisma.task.findMany({
    where: { familyId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

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

  // 解析 weekNo 获取周开始日期
  const [year, week] = weekNo.split('-').map(Number)
  const weekStartDate = getWeekStartDate(year, week)

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
        const appliesTo = task.appliesTo as number[] || []
        return appliesTo.includes(child.id)
      })

      for (const task of childTasks) {
        // 优先使用前端传入的规则，否则沿用任务原有规则
        const customRule = taskRules && typeof taskRules === 'object' ? taskRules[task.id] : undefined
        const scheduleRule = customRule || task.scheduleRule || 'daily'

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
        const daysAllocated = allowedDays

        // 创建周计划，即使没有分配到任何天数也创建
        const target = daysAllocated.length
        await tx.weeklyPlan.create({
          data: {
            familyId,
            childId: child.id,
            taskId: task.id,
            target,
            progress: 0,
            weekNo,
            status: target > 0 ? 'active' : 'inactive',
            assignedDays: daysAllocated, // 存储 JavaScript 标准索引
          }
        })

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
  const scheduleRule = (typeof taskTags === 'object' && taskTags !== null && 'scheduleRule' in taskTags) 
    ? taskTags.scheduleRule 
    : 'daily';

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

export default tasksRouter
