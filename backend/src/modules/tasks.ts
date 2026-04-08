import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

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

// 2025年中国法定节假日
const HOLIDAYS_2025: Set<string> = new Set([
  '2025-01-01', // 元旦
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04', // 春节
  '2025-04-04', '2025-04-05', '2025-04-06', // 清明节
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05', // 劳动节
  '2025-05-31', '2025-06-01', '2025-06-02', // 端午节
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', // 国庆节
])

tasksRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { name, category, type, timePerUnit, weeklyRule, tags, appliesTo } = req.body
  const { familyId } = req.user!
  if (!name || !category || !type) throw new AppError(400, 'Missing required fields: name, category, type')

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
    if (tags.scheduleRule) validatedTags.scheduleRule = tags.scheduleRule // 保存排期规则
  }

  const task = await prisma.task.create({
    data: { familyId, name, category: mappedCategory, type: mappedType, timePerUnit: timePerUnit || 30, weeklyRule: weeklyRule || {}, tags: validatedTags, appliesTo: appliesTo || [] },
  })
  res.status(201).json({ status: 'success', message: 'Task created', data: task })
})

tasksRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  try {
    const tasks = await prisma.$queryRaw`
      SELECT id, family_id, name, category, type, time_per_unit, 
             weekly_rule, sort_order, is_active, tags, applies_to, created_at, updated_at
      FROM tasks WHERE family_id = ${familyId} AND is_active = true ORDER BY sort_order, created_at DESC
    `
    
    const formattedTasks = (tasks as any[]).map(task => {
      // 从 tags 中提取 scheduleRule（确保 tags 是对象）
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
        : null;
      
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
        scheduleRule: scheduleRule || 'daily', // 添加 scheduleRule 字段
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
  const { name, category, type, timePerUnit, tags } = req.body
  
  const mappedCategory = category ? (CATEGORY_MAP[category] || category) : undefined
  const mappedType = type ? (TYPE_MAP[type] || type) : undefined
  
  const existing = await prisma.$queryRawUnsafe(`SELECT id FROM tasks WHERE id = ${id} AND family_id = ${familyId}`) as any[]
  if (!existing?.length) throw new AppError(404, 'Task not found')

  let validatedTags: any = {}
  if (tags?.subject && VALID_SUBJECTS.includes(tags.subject)) validatedTags.subject = tags.subject
  if (tags?.parentRole && VALID_PARENT_ROLES.includes(tags.parentRole)) validatedTags.parentRole = tags.parentRole
  if (tags?.difficulty && VALID_DIFFICULTIES.includes(tags.difficulty)) validatedTags.difficulty = tags.difficulty
  if (tags?.totalAmount?.value > 0) validatedTags.totalAmount = tags.totalAmount
  if (tags?.scheduleRule) validatedTags.scheduleRule = tags.scheduleRule // 保存排期规则

  const updates: string[] = []
  if (name) updates.push(`name = '${name.replace(/'/g, "''")}'`)
  if (mappedCategory) updates.push(`category = '${mappedCategory}'`)
  if (mappedType) updates.push(`type = '${mappedType}'`)
  if (timePerUnit !== undefined) updates.push(`time_per_unit = ${timePerUnit}`)
  if (Object.keys(validatedTags).length > 0) updates.push(`tags = '${JSON.stringify(validatedTags).replace(/'/g, "''")}'::jsonb`)

  if (updates.length > 0) await prisma.$executeRawUnsafe(`UPDATE tasks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ${id}`)
  
  const updated = await prisma.$queryRawUnsafe(`SELECT * FROM tasks WHERE id = ${id}`) as any[]
  res.json({ status: 'success', message: 'Task updated', data: updated[0] })
})

tasksRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const task = await prisma.$queryRawUnsafe(`SELECT family_id FROM tasks WHERE id = ${id}`) as any[]
  if (!task?.length) throw new AppError(404, '任务不存在')
  if (task[0].family_id !== familyId) throw new AppError(403, '无权限')
  await prisma.$executeRawUnsafe(`UPDATE tasks SET is_active = false WHERE id = ${id}`)
  res.json({ status: 'success', message: 'Task deleted' })
})

/**
 * POST /publish - 发布下周计划（支持避开节假日）
 * Body: { childIds, weekNo, taskRules?, skipHolidays?, holidayDates? }
 */
tasksRouter.post('/publish', async (req: AuthRequest, res: Response) => {
  try {
  const { childIds, weekNo, taskRules, skipHolidays, holidayDates } = req.body
  const { familyId } = req.user!

  console.log('[PUBLISH] Request:', { childIds, weekNo, taskRules, skipHolidays, holidayDates })

  if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
    console.error('[PUBLISH] Invalid childIds:', childIds)
    throw new AppError(400, 'Missing or invalid childIds')
  }

  if (!weekNo) {
    console.error('[PUBLISH] Missing weekNo')
    throw new AppError(400, 'Missing weekNo')
  }

  // 验证 weekNo 格式
  const weekNoMatch = weekNo.match(/^(\d{4})-(\d{2})$/)
  if (!weekNoMatch) {
    console.error('[PUBLISH] Invalid weekNo format:', weekNo)
    throw new AppError(400, `Invalid weekNo format: ${weekNo}. Expected format: YYYY-WW`)
  }

  // 获取所有活跃任务
  const tasks = await prisma.task.findMany({
    where: { familyId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  console.log('[PUBLISH] Found tasks:', tasks.length)

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

  console.log('[PUBLISH] Found children:', children.length)

  if (children.length !== childIds.length) {
    console.error('[PUBLISH] Children mismatch. Expected:', childIds.length, 'Found:', children.length)
    throw new AppError(400, 'Some children not found or do not belong to your family')
  }

  // 获取家庭设置
  const family = await prisma.family.findUnique({ where: { id: familyId } })
  const settings = family?.settings as { dailyTimeLimit?: number } | null
  const dailyTimeLimit = settings?.dailyTimeLimit || 210

  console.log('[PUBLISH] Daily time limit:', dailyTimeLimit)

  // 合并节假日列表
  const allHolidays = new Set(HOLIDAYS_2025)
  if (Array.isArray(holidayDates)) {
    holidayDates.forEach((d: string) => allHolidays.add(d))
  }

  // 解析 weekNo 获取周开始日期
  const [year, week] = weekNo.split('-').map(Number)
  const weekStartDate = getWeekStartDate(year, week)

  console.log('[PUBLISH] Week start:', weekStartDate, 'Skip holidays:', skipHolidays, 'Holidays:', Array.from(allHolidays))

  // 计算每周安排
  const results: any[] = []

  await prisma.$transaction(async (tx) => {
    for (const child of children) {
      // 删除该周的现有计划
      await tx.weeklyPlan.deleteMany({
        where: { childId: child.id, weekNo },
      })

      const allocation: any[] = []
      const dayTimeUsed = [0, 0, 0, 0, 0, 0, 0]

      // 过滤适用于该孩子的任务
      const childTasks = tasks.filter(task => {
        const appliesTo = task.appliesTo as number[] | null
        return !appliesTo || appliesTo.length === 0 || appliesTo.includes(child.id)
      })

      // 排序：固定任务优先
      const sortedTasks = [...childTasks].sort((a, b) => {
        if (a.type === 'fixed' && b.type !== 'fixed') return -1
        if (a.type !== 'fixed' && b.type === 'fixed') return 1
        return a.sortOrder - b.sortOrder
      })

      for (const task of sortedTasks) {
        // 应用自定义规则（如果有的话）
        const customRule = taskRules?.[task.id]
        const taskRule = customRule || (task.weeklyRule as any) || {}

        let allowedDays: number[] = []

        // 根据任务的 scheduleRule 确定允许的日期
        let scheduleRule = (task.tags as any)?.scheduleRule || 'daily'
        
        // 如果 customRule 是字符串，使用它作为 scheduleRule
        if (typeof customRule === 'string') {
          scheduleRule = customRule
        }

        // JavaScript getDay(): 0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
        if (scheduleRule === 'daily') {
          allowedDays = [0, 1, 2, 3, 4, 5, 6] // 每天（周日到周六）
        } else if (scheduleRule === 'school') {
          allowedDays = [1, 2, 4, 5] // 上学日：周一(1)、周二(2)、周四(4)、周五(5)，排除周三
        } else if (scheduleRule === 'weekend') {
          allowedDays = [0, 6] // 周末：周日(0)和周六(6)
        } else if (scheduleRule === 'flexible') {
          allowedDays = [0, 1, 2, 3, 4, 5, 6] // 灵活：每天都可安排
        } else {
          // 默认：每天
          allowedDays = [0, 1, 2, 3, 4, 5, 6]
        }

        // 应用自定义规则（只有当 taskRule 是对象时）
        if (typeof taskRule === 'object' && taskRule !== null) {
          if (taskRule.onlyWeekend) {
            allowedDays = allowedDays.filter(d => d === 0 || d === 6)
          }
          if (taskRule.excludeDays?.length > 0) {
            allowedDays = allowedDays.filter(d => !taskRule.excludeDays.includes(d))
          }
          if (taskRule.days?.length > 0) {
            allowedDays = taskRule.days
          }
        }

        // 关键：如果开启了避开节假日，过滤掉节假日
        if (skipHolidays !== false) { // 默认开启
          allowedDays = allowedDays.filter(dayIndex => {
            const date = new Date(weekStartDate)
            date.setDate(date.getDate() + dayIndex)
            const dateStr = date.toISOString().split('T')[0]
            const isHoliday = allHolidays.has(dateStr)
            if (isHoliday) {
              console.log(`[PUBLISH] Skipping holiday: ${dateStr} (${date.toLocaleDateString('zh-CN')}) for task ${task.name}`)
            }
            return !isHoliday
          })
        }

        // 分配任务到允许的日期
        const daysAllocated: number[] = []
        for (const day of allowedDays) {
          if (dayTimeUsed[day] + task.timePerUnit <= dailyTimeLimit) {
            daysAllocated.push(day)
            dayTimeUsed[day] += task.timePerUnit
          }
        }

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
            assignedDays: daysAllocated, // 保存实际分配的天数数组
          }
        })

        allocation.push({
          taskId: task.id,
          taskName: task.name,
          category: task.category,
          type: task.type,
          timePerUnit: task.timePerUnit,
          target,
          weeklyRule: taskRule,
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
      summary: {
        totalTasks: tasks.length,
        totalChildren: children.length,
        dailyTimeLimit,
        holidaysSkipped: skipHolidays !== false ? allHolidays.size : 0,
      },
    },
  })
  } catch (error) {
    console.error('[PUBLISH] ERROR:', error)
    if (error instanceof Error) {
      console.error('[PUBLISH] Error message:', error.message)
      console.error('[PUBLISH] Error stack:', error.stack)
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

  const task = await prisma.$queryRawUnsafe(
    `SELECT * FROM tasks WHERE id = ${id} AND family_id = ${familyId} LIMIT 1`
  ) as any[]

  if (!task || task.length === 0) {
    throw new AppError(404, 'Task not found')
  }

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
      tags: task[0].tags || {},
      appliesTo: task[0].applies_to || [],
      createdAt: task[0].created_at,
      updatedAt: task[0].updated_at,
    },
  })
})

/**
 * 辅助函数：根据年份和周数获取周开始日期
 */
function getWeekStartDate(year: number, week: number): Date {
  const jan1 = new Date(year, 0, 1)
  const dayOfWeek = jan1.getDay()
  const daysToAdd = (dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek)
  const firstMonday = new Date(jan1)
  firstMonday.setDate(jan1.getDate() + daysToAdd)
  
  const weekStart = new Date(firstMonday)
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7)
  
  return weekStart
}

export default tasksRouter