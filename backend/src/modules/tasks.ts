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

/**
 * 获取指定年份的中国法定节假日
 */
function getHolidaysByYear(year: number): Set<string> {
  const holidays = new Set<string>()
  
  // 元旦
  holidays.add(`${year}-01-01`)
  
  // 春节（简化处理，实际需要根据农历计算）
  // 这里使用固定日期作为示例，实际应用中应使用农历计算
  if (year === 2025) {
    holidays.add('2025-01-28')
    holidays.add('2025-01-29')
    holidays.add('2025-01-30')
    holidays.add('2025-01-31')
    holidays.add('2025-02-01')
    holidays.add('2025-02-02')
    holidays.add('2025-02-03')
    holidays.add('2025-02-04')
  } else if (year === 2026) {
    // 2026年春节：2月16日-2月23日
    holidays.add('2026-02-16')
    holidays.add('2026-02-17')
    holidays.add('2026-02-18')
    holidays.add('2026-02-19')
    holidays.add('2026-02-20')
    holidays.add('2026-02-21')
    holidays.add('2026-02-22')
    holidays.add('2026-02-23')
  }
  
  // 清明节（4月4日或5日）
  holidays.add(`${year}-04-04`)
  holidays.add(`${year}-04-05`)
  holidays.add(`${year}-04-06`)
  
  // 劳动节
  holidays.add(`${year}-05-01`)
  holidays.add(`${year}-05-02`)
  holidays.add(`${year}-05-03`)
  holidays.add(`${year}-05-04`)
  holidays.add(`${year}-05-05`)
  
  // 端午节（6月1日左右）
  holidays.add(`${year}-05-31`)
  holidays.add(`${year}-06-01`)
  holidays.add(`${year}-06-02`)
  
  // 国庆节
  holidays.add(`${year}-10-01`)
  holidays.add(`${year}-10-02`)
  holidays.add(`${year}-10-03`)
  holidays.add(`${year}-10-04`)
  holidays.add(`${year}-10-05`)
  holidays.add(`${year}-10-06`)
  holidays.add(`${year}-10-07`)
  holidays.add(`${year}-10-08`)
  
  return holidays
}

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
      // 从 tags 中提取 scheduleRule
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
        scheduleRule: scheduleRule || 'daily',
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
  
  const existing = await prisma.$queryRaw`SELECT id FROM tasks WHERE id = ${id} AND family_id = ${familyId}` as any[]
  if (!existing?.length) throw new AppError(404, 'Task not found')

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
      updatedAt: new Date()
    }
  })
  
  res.json({ status: 'success', message: 'Task updated', data: task })
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
 * POST /publish - 发布下周计划（支持避开节假日）
 * Body: { childIds, weekNo, taskRules?, skipHolidays?, holidayDates? }
 */
tasksRouter.post('/publish', async (req: AuthRequest, res: Response) => {
  try {
  const { childIds, weekNo, taskRules, skipHolidays, holidayDates } = req.body
  const { familyId } = req.user!

  console.log('[PUBLISH] Request:', { childIds, weekNo, taskRules, skipHolidays, holidayDates })

  if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
    throw new AppError(400, 'Missing or invalid childIds')
  }

  if (!weekNo) {
    throw new AppError(400, 'Missing weekNo')
  }

  // 获取所有活跃任务
  const tasks = await prisma.task.findMany({
    where: { familyId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

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

  // 获取家庭设置
  const family = await prisma.family.findUnique({ where: { id: familyId } })
  const settings = family?.settings as { dailyTimeLimit?: number } | null
  const dailyTimeLimit = settings?.dailyTimeLimit || 210

  // 解析 weekNo 获取周开始日期
  const [year, week] = weekNo.split('-').map(Number)
  const weekStartDate = getWeekStartDate(year, week)

  // 合并节假日列表
  const allHolidays = getHolidaysByYear(year)
  if (Array.isArray(holidayDates)) {
    holidayDates.forEach((d: string) => allHolidays.add(d))
  }

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

        if (scheduleRule === 'daily') {
          allowedDays = [0, 1, 2, 3, 4, 5, 6] // 每天（JavaScript标准索引：0=周日，1=周一，...，6=周六）
        } else if (scheduleRule === 'school') {
          allowedDays = [1, 2, 4, 5] // 周一、周二、周四、周五（JavaScript标准索引）
        } else if (scheduleRule === 'weekend') {
          allowedDays = [0, 6] // 周六和周日（JavaScript标准索引：0=周日，6=周六）
        } else if (scheduleRule === 'flexible') {
          allowedDays = [1, 2, 3, 4, 5] // 周一到周五（JavaScript标准索引）
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
            // 计算实际日期（JavaScript标准索引：0=周日，1=周一，...，6=周六）
            const actualDate = new Date(weekStartDate)
            actualDate.setDate(actualDate.getDate() + day)

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
            assignedDays: daysAllocated, // 存储 JavaScript 标准索引
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
 * 辅助函数：根据年份和周数获取周开始日期（周日）
 */
function getWeekStartDate(year: number, week: number): Date {
  const jan1 = new Date(year, 0, 1)
  const dayOfWeek = jan1.getDay() // 0=周日, 1=周一, ..., 6=周六
  const daysToAdd = (dayOfWeek === 0 ? 0 : 7 - dayOfWeek)
  const firstSunday = new Date(jan1)
  firstSunday.setDate(jan1.getDate() + daysToAdd)
  
  const weekStart = new Date(firstSunday)
  weekStart.setDate(firstSunday.getDate() + (week - 1) * 7)
  
  return weekStart
}

export default tasksRouter