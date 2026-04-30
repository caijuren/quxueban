import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { env } from '../config/env'

function parseAssignedDays(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((day) => Number(day)).filter((day) => Number.isInteger(day))
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.map((day) => Number(day)).filter((day) => Number.isInteger(day))
        : []
    } catch {
      return []
    }
  }

  return []
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, any>
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, any>
      }
    } catch {
      return {}
    }
  }

  return {}
}

function getEffectiveScheduleRule(task: {
  task_schedule_rule?: unknown
  schedule_rule?: unknown
  task_tags?: unknown
  tags?: unknown
  task_weekly_rule?: unknown
  weekly_rule?: unknown
}): string {
  const taskTags = parseJsonObject(task.task_tags ?? task.tags)
  const taskWeeklyRule = parseJsonObject(task.task_weekly_rule ?? task.weekly_rule)
  const scheduleRuleFromColumn =
    typeof task.task_schedule_rule === 'string'
      ? task.task_schedule_rule
      : (typeof task.schedule_rule === 'string' ? task.schedule_rule : '')
  const scheduleRuleFromTags = typeof taskTags.scheduleRule === 'string' ? taskTags.scheduleRule : ''
  const scheduleRuleFromWeeklyRule = typeof taskWeeklyRule.scheduleRule === 'string' ? taskWeeklyRule.scheduleRule : ''

  const validRules = ['daily', 'school', 'weekend', 'flexible']
  const isValidRule = (value: string) => validRules.includes(value)

  if (isValidRule(scheduleRuleFromTags) && (scheduleRuleFromColumn === 'daily' || !isValidRule(scheduleRuleFromColumn))) {
    return scheduleRuleFromTags
  }
  if (isValidRule(scheduleRuleFromColumn)) return scheduleRuleFromColumn
  if (isValidRule(scheduleRuleFromTags)) return scheduleRuleFromTags
  if (isValidRule(scheduleRuleFromWeeklyRule)) return scheduleRuleFromWeeklyRule
  return 'daily'
}

export const plansRouter: Router = Router()

// All routes require authentication
plansRouter.use(authMiddleware)

// ============================================
// Plans Routes
// ============================================

/**
 * GET /today - Get today's tasks for logged-in child
 *
 * Features:
 * - Apply day-of-week filtering (Wednesday exclude school homework, weekend only for advanced tasks)
 * - Include makeup tasks (yesterday's incomplete)
 * - Include advance tasks if remaining time >= 30min
 *
 * Returns: { fixedTasks, flexibleTasks, makeupTasks, advanceTasks, usedTime, remainingTime }
 */
plansRouter.get('/today', async (req: AuthRequest, res: Response) => {
  const { userId, role, familyId } = req.user!

  // Only children can view their today's tasks
  if (role !== 'child') {
    throw new AppError(403, 'This endpoint is only for children')
  }

  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sunday, 6=Saturday
  const weekNo = getWeekNo(today)

  // Get family settings
  const family = await prisma.family.findUnique({
    where: { id: familyId },
  })
  const settings = family?.settings as { dailyTimeLimit?: number } | null
  const dailyTimeLimit = settings?.dailyTimeLimit || 210

  // Get today's checkins to calculate used time
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const todayCheckins = await prisma.dailyCheckin.findMany({
    where: {
      childId: userId,
      checkDate: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: {
      plan: {
        include: { task: true },
      },
    },
  })

  // Calculate used time from completed tasks today
  let usedTime = 0
  for (const checkin of todayCheckins) {
    if (checkin.status === 'completed' || checkin.status === 'partial' || checkin.status === 'advance') {
      usedTime += (checkin.plan?.task?.timePerUnit || 0) * (checkin.value || 1)
    }
  }

  const remainingTime = Math.max(0, dailyTimeLimit - usedTime)

  // Get active weekly plans for this child
  const weeklyPlans = await prisma.$queryRaw`
    SELECT
      wp.id,
      wp.child_id,
      wp.task_id,
      wp.target,
      wp.progress,
      wp.week_no,
      wp.status,
      wp.assigned_days,
      wp.created_at,
      wp.updated_at,
      t.name AS task_name,
      t.category AS task_category,
      t.type AS task_type,
      t.time_per_unit,
      t.tags AS task_tags,
      t.weekly_rule AS task_weekly_rule,
      t.schedule_rule AS task_schedule_rule
    FROM weekly_plans wp
    JOIN tasks t ON t.id = wp.task_id
    WHERE wp.child_id = ${userId}
      AND wp.week_no = ${weekNo}
      AND wp.status = 'active'
  ` as any[]

  // Filter tasks by day of week
  const fixedTasks: any[] = []
  const flexibleTasks: any[] = []

  for (const plan of weeklyPlans) {
    const task = {
      id: plan.task_id,
      name: plan.task_name,
      category: plan.task_category,
      type: plan.task_type,
      timePerUnit: plan.time_per_unit,
      tags: parseJsonObject(plan.task_tags),
      weeklyRule: parseJsonObject(plan.task_weekly_rule),
      scheduleRule: getEffectiveScheduleRule(plan),
    }
    const weeklyRule = task.weeklyRule as {
      excludeDays?: number[]
      onlyWeekend?: boolean
      days?: number[]
    } | null

    // Check if task should be shown today
    let showToday = true

    // 首先检查任务是否分配到了今天
    let assignedDays = parseAssignedDays((plan as any).assigned_days)
    
    // 如果没有实际分配，根据 scheduleRule 计算默认值
    if (assignedDays.length === 0) {
      const scheduleRule = task.scheduleRule || getEffectiveScheduleRule({
        schedule_rule: task.scheduleRule,
        tags: task.tags,
        weekly_rule: task.weeklyRule,
      })
      
      switch (scheduleRule) {
        case 'daily':
          assignedDays = [0, 1, 2, 3, 4, 5, 6] // 每天
          break
        case 'school':
          assignedDays = [1, 2, 4, 5] // 周一、周二、周四、周五
          break
        case 'flexible':
          assignedDays = [1, 2, 3, 4, 5] // 周一到周五
          break
        case 'weekend':
          assignedDays = [0, 6] // 周日、周六
          break
        default:
          assignedDays = [0, 1, 2, 3, 4, 5, 6] // 默认为每天
      }
    }
    
    if (!assignedDays.includes(dayOfWeek)) {
      showToday = false
    }

    // School homework: exclude Wednesday (day 3)
    if (showToday && (task.category === 'school' || task.category === 'advanced')) {
      console.log(`Task: ${task.name}, Category: ${task.category}, Day: ${dayOfWeek}`)
      if (task.name.includes('培优') || task.name.includes('高思') || task.name.includes('全新英语')) {
        // Advanced: weekend only
        console.log(`Advanced task, should only show on weekend: ${dayOfWeek === 0 || dayOfWeek === 6}`)
        showToday = dayOfWeek === 0 || dayOfWeek === 6
      } else {
        // Regular school homework: exclude Wednesday
        console.log(`Regular school task, should exclude Wednesday: ${dayOfWeek !== 3}`)
        showToday = dayOfWeek !== 3
      }
    }
    console.log(`Task: ${task.name}, Show today: ${showToday}, Assigned days: ${assignedDays}`)

    // Apply weekly rule overrides
    if (showToday && weeklyRule?.onlyWeekend) {
      showToday = showToday && (dayOfWeek === 0 || dayOfWeek === 6)
    }
    if (showToday && weeklyRule?.excludeDays && weeklyRule.excludeDays.length > 0) {
      showToday = showToday && !weeklyRule.excludeDays.includes(dayOfWeek)
    }
    if (showToday && weeklyRule?.days && weeklyRule.days.length > 0) {
      showToday = weeklyRule.days.includes(dayOfWeek)
    }

    // Check if already completed today
    const todayCheckin = todayCheckins.find(c => c.planId === plan.id)

    const taskData = {
      planId: plan.id,
      taskId: task.id,
      name: task.name,
      category: task.category,
      type: task.type,
      timePerUnit: task.timePerUnit,
      target: plan.target,
      progress: plan.progress,
      completedToday: todayCheckin?.status === 'completed',
      todayStatus: todayCheckin?.status || null,
      // 精细化记录字段
      trackingType: (task as any).trackingType || 'simple',
      trackingUnit: (task as any).trackingUnit || null,
      targetValue: (task as any).targetValue || null,
    }

    if (showToday && !todayCheckin) {
      if (task.type === 'fixed') {
        fixedTasks.push(taskData)
      } else {
        flexibleTasks.push(taskData)
      }
    }
  }

  // Get makeup tasks (yesterday's incomplete)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStart = new Date(yesterday)
  yesterdayStart.setHours(0, 0, 0, 0)
  const yesterdayEnd = new Date(yesterday)
  yesterdayEnd.setHours(23, 59, 59, 999)

  const yesterdayCheckins = await prisma.dailyCheckin.findMany({
    where: {
      childId: userId,
      checkDate: {
        gte: yesterdayStart,
        lte: yesterdayEnd,
      },
      status: {
        in: ['postponed', 'not_completed', 'partial'],
      },
    },
    include: {
      plan: {
        include: { task: true },
      },
    },
  })

  const makeupTasks = yesterdayCheckins.map(checkin => ({
    checkinId: checkin.id,
    planId: checkin.planId,
    taskId: checkin.taskId,
    name: checkin.plan?.task?.name || 'Unknown Task',
    category: checkin.plan?.task?.category || '',
    timePerUnit: checkin.plan?.task?.timePerUnit || 30,
    originalStatus: checkin.status,
    // 精细化记录字段
    trackingType: (checkin.plan?.task as any)?.trackingType || 'simple',
    trackingUnit: (checkin.plan?.task as any)?.trackingUnit || null,
    targetValue: (checkin.plan?.task as any)?.targetValue || null,
  }))

  // Advance tasks: show if remaining time >= 30min and all fixed tasks completed
  let advanceTasks: any[] = []
  if (remainingTime >= 30 && fixedTasks.length === 0) {
    // Get tasks that are ahead of schedule (progress > target proportionally)
    const daysPassed = dayOfWeek === 0 ? 7 : dayOfWeek
    for (const plan of weeklyPlans) {
      const expectedProgress = Math.ceil((plan.target / 7) * daysPassed)
      if (plan.progress >= expectedProgress && plan.progress < plan.target) {
        advanceTasks.push({
          planId: plan.id,
          taskId: plan.task.id,
          name: plan.task.name,
          category: plan.task.category,
          timePerUnit: plan.task.timePerUnit,
          currentProgress: plan.progress,
          target: plan.target,
          // 精细化记录字段
          trackingType: (plan.task as any).trackingType || 'simple',
          trackingUnit: (plan.task as any).trackingUnit || null,
          targetValue: (plan.task as any).targetValue || null,
        })
      }
    }
  }

  res.json({
    status: 'success',
    data: {
      date: today.toISOString().split('T')[0],
      dayOfWeek,
      weekNo,
      fixedTasks,
      flexibleTasks,
      makeupTasks,
      advanceTasks,
      usedTime,
      remainingTime,
      dailyTimeLimit,
    },
  })
})

/**
 * POST /checkin - Save daily checkin
 * Body: { taskId, planId, status, value, completedValue, notes, date }
 *
 * Statuses: completed, partial, postponed, not_involved, not_completed, makeup, advance
 */
plansRouter.post('/checkin', async (req: AuthRequest, res: Response) => {
  const { taskId, planId, status, value, completedValue, focusMinutes, notes, metadata, evidenceUrl, childId, date } = req.body
  const { userId, familyId, role } = req.user!
  const parsedTaskId = parseInt(String(taskId))
  const parsedPlanId = planId ? parseInt(String(planId)) : null
  const parsedCompletedValue =
    completedValue === undefined || completedValue === null || completedValue === ''
      ? null
      : parseInt(String(completedValue))
  const normalizedNotes = typeof notes === 'string' ? notes.trim() : ''
  const parsedFocusMinutes =
    focusMinutes === undefined || focusMinutes === null || focusMinutes === ''
      ? null
      : parseInt(String(focusMinutes))
  const normalizedEvidenceUrl = typeof evidenceUrl === 'string' ? evidenceUrl.trim() : ''
  const normalizedMetadata = parseJsonObject(metadata)

  // For parents, use provided childId; for children, use their own userId.
  const targetChildId = Number(role === 'parent' ? childId : userId)
  
  // Validate childId for parents
  if (role === 'parent' && !childId) {
    throw new AppError(400, 'Missing required field: childId')
  }

  if (!taskId || !status || Number.isNaN(parsedTaskId) || !Number.isInteger(targetChildId)) {
    throw new AppError(400, 'Missing required fields: taskId, status')
  }

  // Validate status
  const validStatuses = ['completed', 'partial', 'postponed', 'not_involved', 'not_completed', 'makeup', 'advance']
  if (!validStatuses.includes(status)) {
    throw new AppError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`)
  }

  // Use provided date or today, always parse as local date to avoid timezone drift
  let checkDate: Date
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number)
    checkDate = new Date(year, month - 1, day)
  } else {
    checkDate = date ? new Date(date) : new Date()
  }
  // Set to start of day in local time
  checkDate.setHours(0, 0, 0, 0)

  const result = await prisma.$transaction(async (tx) => {
    const lockKey = `${targetChildId}:${parsedTaskId}:${checkDate.toISOString().slice(0, 10)}`
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${familyId}, hashtext(${lockKey})::int)`

    const existingCheckins = await tx.dailyCheckin.findMany({
      where: {
        familyId,
        childId: targetChildId,
        taskId: parsedTaskId,
        checkDate,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const existingCheckin = existingCheckins[0]

    if (existingCheckin) {
      const updatedCheckin = await tx.dailyCheckin.update({
        where: { id: existingCheckin.id },
        data: {
          status,
          value: value || 1,
          planId: parsedPlanId || existingCheckin.planId,
          completedValue: parsedCompletedValue,
          focusMinutes: parsedFocusMinutes,
          notes: normalizedNotes || null,
          metadata: normalizedMetadata,
          evidenceUrl: normalizedEvidenceUrl || existingCheckin.evidenceUrl || '',
        },
      })

      if (existingCheckins.length > 1) {
        await tx.dailyCheckin.deleteMany({
          where: {
            familyId,
            childId: targetChildId,
            taskId: parsedTaskId,
            checkDate,
            id: { not: existingCheckin.id },
          },
        })
      }

      return {
        statusCode: 200,
        message: existingCheckins.length > 1 ? 'Checkin updated; duplicate rows removed' : 'Checkin updated',
        checkin: updatedCheckin,
      }
    }

    const checkin = await tx.dailyCheckin.create({
      data: {
        familyId,
        childId: targetChildId,
        taskId: parsedTaskId,
        planId: parsedPlanId,
        status,
        value: value || 1,
        completedValue: parsedCompletedValue,
        focusMinutes: parsedFocusMinutes,
        notes: normalizedNotes || null,
        metadata: normalizedMetadata,
        evidenceUrl: normalizedEvidenceUrl,
        checkDate,
      },
    })

    if (parsedPlanId && (status === 'completed' || status === 'advance')) {
      await tx.$executeRaw`
        UPDATE weekly_plans
        SET progress = progress + 1, updated_at = NOW()
        WHERE id = ${parsedPlanId}
      `
    }

    return {
      statusCode: 201,
      message: 'Checkin recorded',
      checkin,
    }
  })

  res.status(result.statusCode).json({
    status: 'success',
    message: result.message,
    data: result.checkin,
  })
})

/**
 * GET /week/:weekStart - Get weekly plan
 * For parents: Returns WeeklyPlan[] for all children in the family
 * For children: Returns WeeklyPlan[] only for the current child
 */
plansRouter.get('/week/:weekStart', async (req: AuthRequest, res: Response) => {
  const { familyId, role, userId } = req.user!
  const weekStart = req.params.weekStart as string
  const childId = req.query.childId ? parseInt(req.query.childId as string) : null

  const weekNo = getWeekNo(new Date(weekStart))

  // 强制要求提供childId参数，确保数据隔离
  if (role === 'parent' && !childId) {
    throw new AppError(400, 'Missing required parameter: childId. Data isolation is mandatory for parents.')
  }

  // Handle mock mode
  if (!env.DATABASE_URL) {
    const mockChildren = [
      { id: 2, name: '小明', avatar: '👶' },
      { id: 3, name: '小红', avatar: '🧒' }
    ]

    let children = mockChildren

    if (role === 'parent') {
      // 强制过滤：家长必须指定childId
      children = mockChildren.filter(c => c.id === childId)
    } else if (role === 'child') {
      children = mockChildren.filter(c => c.id === userId)
    }

    // Group by child and format for frontend
    const plansByChild = children.map(child => {
      return {
        child,
        plans: []
      }
    })

    res.json({ status: 'success', data: plansByChild })
    return
  }

  let children = []
  let weeklyPlans: any[] = []

  if (role === 'parent') {
    // 强制要求childId，确保数据隔离
    if (!childId) {
      throw new AppError(400, 'Missing required parameter: childId. Data isolation is mandatory.')
    }
    
    // Parents can view specific child's plans only
    const child = await prisma.user.findUnique({
      where: {
        id: childId,
        familyId,
        role: 'child',
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        avatar: true,
      },
    })

    if (!child) {
      throw new AppError(404, 'Child not found')
    }

    children = [child]

    // Get weekly plans only for the specific child - 严格隔离
    weeklyPlans = await prisma.$queryRaw`
      SELECT
        wp.id,
        wp.child_id,
        wp.task_id,
        wp.target,
        wp.progress,
        wp.week_no,
        wp.status,
        wp.assigned_days,
        wp.created_at,
        wp.updated_at,
        t.name AS task_name,
        t.category AS task_category,
        t.time_per_unit,
        t.sort_order,
        t.tags AS task_tags,
        t.weekly_rule AS task_weekly_rule,
        t.schedule_rule AS task_schedule_rule
      FROM weekly_plans wp
      JOIN tasks t ON t.id = wp.task_id
      WHERE wp.child_id = ${childId} AND wp.week_no = ${weekNo}
    ` as any[]
  } else if (role === 'child') {
    // Children can only view their own plans
    const child = await prisma.user.findUnique({
      where: {
        id: userId,
        role: 'child',
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        avatar: true,
      },
    })

    if (!child) {
      throw new AppError(404, 'Child not found')
    }

    children = [child]

    // Get weekly plans only for the current child
    weeklyPlans = await prisma.$queryRaw`
      SELECT
        wp.id,
        wp.child_id,
        wp.task_id,
        wp.target,
        wp.progress,
        wp.week_no,
        wp.status,
        wp.created_at,
        wp.updated_at,
        t.name AS task_name,
        t.category AS task_category,
        t.time_per_unit,
        t.sort_order,
        t.tags AS task_tags,
        t.weekly_rule AS task_weekly_rule,
        t.schedule_rule AS task_schedule_rule
      FROM weekly_plans wp
      JOIN tasks t ON t.id = wp.task_id
      WHERE wp.child_id = ${userId} AND wp.week_no = ${weekNo}
    ` as any[]
  } else {
    throw new AppError(403, 'Unauthorized')
  }

  const weekStartDate = new Date(weekStart)
  weekStartDate.setHours(0, 0, 0, 0)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 6)
  weekEndDate.setHours(23, 59, 59, 999)
  const childIds = children.map(child => child.id)
  const weekCheckins = childIds.length > 0
    ? await prisma.dailyCheckin.findMany({
        where: {
          familyId,
          childId: { in: childIds },
          checkDate: {
            gte: weekStartDate,
            lte: weekEndDate,
          },
        },
        select: {
          childId: true,
          taskId: true,
          status: true,
          checkDate: true,
          completedValue: true,
          focusMinutes: true,
        },
      })
    : []
  const checkinsByChildTaskDay = new Map<string, typeof weekCheckins[number]>()
  for (const checkin of weekCheckins) {
    const checkDate = new Date(checkin.checkDate)
    checkDate.setHours(0, 0, 0, 0)
    const dayIndex = Math.round((checkDate.getTime() - weekStartDate.getTime()) / (24 * 60 * 60 * 1000))
    if (dayIndex < 0 || dayIndex > 6) continue
    checkinsByChildTaskDay.set(`${checkin.childId}:${checkin.taskId}:${dayIndex}`, checkin)
  }

  // Group by child and format for frontend
  const plansByChild = children.map(child => {
    const childPlans = weeklyPlans.filter(p => p.child_id === child.id)
    
    return {
      id: `plan-${child.id}`,
      childId: String(child.id),
      childName: child.name,
      weekStartDate: weekStart,
      allocations: childPlans.map(p => {
        // 优先使用数据库存储的 assignedDays（JavaScript 标准索引：0=周日, 6=周六）
        const storedAssignedDays = parseAssignedDays((p as any).assigned_days)
        let assignedDays: number[] = []

        // 获取任务的 scheduleRule
        const taskTags = parseJsonObject((p as any).task_tags)
        const scheduleRule = getEffectiveScheduleRule(p)

        // 优先使用实际分配的天数
        if (storedAssignedDays && storedAssignedDays.length > 0) {
          assignedDays = storedAssignedDays
        } else if (scheduleRule === 'daily') {
          assignedDays = [0, 1, 2, 3, 4, 5, 6] // 每天
        } else if (scheduleRule === 'school') {
          assignedDays = [1, 2, 4, 5] // 周一、周二、周四、周五
        } else if (scheduleRule === 'weekend') {
          assignedDays = [0, 6] // 周日、周六
        } else if (scheduleRule === 'flexible') {
          assignedDays = [1, 2, 3, 4, 5] // 周一到周五
        } else {
          assignedDays = [0, 1, 2, 3, 4, 5, 6]
        }

        // 确保 subject 是字符串类型
        let subject = 'other'
        subject = taskTags.subject || 'other'

        return {
          taskId: String(p.task_id),
          taskName: p.task_name,
          category: p.task_category,
          timePerUnit: p.time_per_unit,
          sortOrder: Number(p.sort_order || 0),
          assignedDays: assignedDays,
          timeSegment: taskTags?.timeSegment || taskTags?.preferredTimeSegment || '放学后',
          subject:subject,
          difficulty: taskTags?.difficulty || 'basic',
          taskKind: taskTags?.taskKind || '',
          abilityCategory: taskTags?.abilityCategory || '',
          abilityPoint: taskTags?.abilityPoint || '',
          scheduleRule,
          target: p.target,
          progress: p.progress,
          dayStatuses: Array.from({ length: 7 }, (_, dayIndex) => {
            const checkin = checkinsByChildTaskDay.get(`${child.id}:${p.task_id}:${dayIndex}`)
            return {
              day: dayIndex,
              status: checkin?.status || null,
              completedValue: checkin?.completedValue || 0,
              focusMinutes: checkin?.focusMinutes || 0,
            }
          }),
        }
      }),
      dailyProgress: Array.from({ length: 7 }, (_, i) => ({
        day: i,
        completed: weekCheckins.filter((checkin) => checkin.childId === child.id && ['completed', 'advance'].includes(checkin.status) && Math.round((new Date(checkin.checkDate).setHours(0, 0, 0, 0) - weekStartDate.getTime()) / (24 * 60 * 60 * 1000)) === i).length,
        total: childPlans.length,
      })),
    }
  })

  res.json({
    status: 'success',
    data: plansByChild,
  })
})

/**
 * GET /week - Get weekly progress overview (for child)
 * Returns: { weekNo, totalTarget, totalProgress, completionRate, dailyStats }
 */
plansRouter.get('/week', async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.user!

  // Only children can view their weekly progress
  if (role !== 'child') {
    throw new AppError(403, 'This endpoint is only for children')
  }

  const today = new Date()
  const weekNo = getWeekNo(today)

  // Get all weekly plans for this week
  const weeklyPlans = await prisma.$queryRaw`
    SELECT
      wp.id,
      wp.child_id,
      wp.task_id,
      wp.target,
      wp.progress,
      wp.week_no,
      wp.status,
      wp.created_at,
      wp.updated_at,
      t.name AS task_name,
      t.category AS task_category,
      t.time_per_unit,
      t.tags AS task_tags,
      t.schedule_rule AS task_schedule_rule
    FROM weekly_plans wp
    JOIN tasks t ON t.id = wp.task_id
    WHERE wp.child_id = ${userId}
      AND wp.week_no = ${weekNo}
  ` as any[]

  // Calculate totals
  const totalTarget = weeklyPlans.reduce((sum, p) => sum + p.target, 0)
  const totalProgress = weeklyPlans.reduce((sum, p) => sum + p.progress, 0)
  const completionRate = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0

  // Get daily stats
  const weekStart = getWeekStart(today)
  const dailyStats = []

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekStart)
    dayDate.setDate(dayDate.getDate() + i)
    const dayStart = new Date(dayDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayDate)
    dayEnd.setHours(23, 59, 59, 999)

    const dayCheckins = await prisma.dailyCheckin.findMany({
      where: {
        childId: userId,
        checkDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    })

    const completed = dayCheckins.filter(c => c.status === 'completed' || c.status === 'advance').length
    const total = dayCheckins.length

    dailyStats.push({
      day: i,
      date: dayDate.toISOString().split('T')[0],
      completed,
      total,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    })
  }

  res.json({
    status: 'success',
    data: {
      weekNo,
      totalTarget,
      totalProgress,
      completionRate,
      allocations: weeklyPlans.map(p => {
        const taskTags = parseJsonObject((p as any).task_tags)
        return {
          planId: p.id,
          taskId: p.task_id,
          taskName: p.task_name,
          category: p.task_category,
          timePerUnit: p.time_per_unit,
          target: p.target,
          progress: p.progress,
          status: p.status,
          assignedDays: parseAssignedDays((p as any).assigned_days),
          scheduleRule: getEffectiveScheduleRule(p),
          subject: taskTags?.subject || 'other',
        }
      }),
      dailyStats,
    },
  })
})

/**
 * GET /history - Get checkin history
 * Query: { startDate?, endDate? }
 */
plansRouter.get('/history', async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.user!
  const { startDate, endDate } = req.query

  if (role !== 'child') {
    throw new AppError(403, 'This endpoint is only for children')
  }

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const end = endDate ? new Date(endDate as string) : new Date()

  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const checkins = await prisma.dailyCheckin.findMany({
    where: {
      childId: userId,
      checkDate: {
        gte: start,
        lte: end,
      },
    },
    include: {
      plan: {
        include: { task: true },
      },
    },
    orderBy: { checkDate: 'desc' },
  })

  res.json({
    status: 'success',
    data: checkins.map(c => ({
      id: c.id,
      date: c.checkDate.toISOString().split('T')[0],
      taskId: c.taskId,
      taskName: c.plan?.task?.name || 'Unknown',
      status: c.status,
      value: c.value,
    })),
  })
})



/**
 * POST /modify - Modify weekly plan (remove/move task on specific day)
 * Body: { taskId, childId, action: 'remove'|'move', date?, fromDate?, toDate? }
 */
plansRouter.post('/modify', async (req: AuthRequest, res: Response) => {
  try {
    const { familyId, role } = req.user!
    const { taskId, childId, action, date, fromDate, toDate } = req.body

    console.log('[MODIFY] Request:', { taskId, childId, action, date, fromDate, toDate })

    if (role !== 'parent') {
      throw new AppError(403, 'Only parents can modify plans')
    }

    if (!taskId || !action) {
      throw new AppError(400, 'Missing required fields: taskId, action')
    }

    if (!['remove', 'move'].includes(action)) {
      throw new AppError(400, "Invalid action. Must be 'remove' or 'move'")
    }

    // Validate taskId is a valid number
    const parsedTaskId = parseInt(taskId)
    if (isNaN(parsedTaskId)) {
      throw new AppError(400, 'Invalid taskId: must be a number')
    }

    const parsedChildId = parseInt(childId)
    if (isNaN(parsedChildId)) {
      throw new AppError(400, 'Invalid childId: must be a number')
    }

    // Parse the target date to get day of week
    const targetDate = action === 'move' ? new Date(fromDate!) : new Date(date!)
    const dayOfWeek = targetDate.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
    const weekNo = getWeekNo(targetDate)

    // Find the weekly plan for this task and child. The same task can exist in multiple children's plans.
    const weeklyPlan = await prisma.weeklyPlan.findFirst({
      where: {
        familyId,
        childId: parsedChildId,
        taskId: parsedTaskId,
        weekNo,
      },
    })

    if (!weeklyPlan) {
      throw new AppError(404, '未找到该任务的周计划')
    }

    const currentAssignedDays = (weeklyPlan.assignedDays as number[]) || []

    if (action === 'remove') {
      // Remove the specific day from assignedDays
      const newAssignedDays = currentAssignedDays.filter(d => d !== dayOfWeek)
      const newTarget = Math.max(0, newAssignedDays.length)

      await prisma.weeklyPlan.update({
        where: { id: weeklyPlan.id },
        data: {
          assignedDays: newAssignedDays,
          target: newTarget,
          status: newTarget > 0 ? 'active' : 'inactive',
        },
      })

      console.log(`[MODIFY] Removed day ${dayOfWeek} from task ${taskId}, remaining days:`, newAssignedDays)

      res.json({
        status: 'success',
        message: '已删除该日安排',
        data: { assignedDays: newAssignedDays, target: newTarget },
      })
    } else if (action === 'move') {
      // Move from one day to another
      const fromDateObj = new Date(fromDate!)
      const toDateObj = new Date(toDate!)
      const fromDay = fromDateObj.getDay()
      const toDay = toDateObj.getDay()

      if (fromDay === toDay) {
        throw new AppError(400, '源日期和目标日期不能相同')
      }

      // Check if already assigned to target day
      if (currentAssignedDays.includes(toDay)) {
        throw new AppError(400, '该任务已在目标日期安排')
      }

      // Remove from source day and add to target day
      const newAssignedDays = currentAssignedDays
        .filter(d => d !== fromDay)
        .concat(toDay)
        .sort((a, b) => a - b)

      await prisma.weeklyPlan.update({
        where: { id: weeklyPlan.id },
        data: {
          assignedDays: newAssignedDays,
        },
      })

      console.log(`[MODIFY] Moved task ${taskId} from day ${fromDay} to day ${toDay}, days:`, newAssignedDays)

      res.json({
        status: 'success',
        message: '已移动到新日期',
        data: { assignedDays: newAssignedDays },
      })
    }
  } catch (error: any) {
    console.error('[MODIFY] Error:', error)
    if (error instanceof AppError) {
      throw error
    }
    throw new AppError(500, '操作失败: ' + error.message)
  }
})

// ============================================
// Helper Functions
// ============================================

/**
 * Get week number in format "YYYY-WW"
 */
function getWeekNo(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-${weekNum.toString().padStart(2, '0')}`
}

/**
 * Get the start of the week (Sunday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}
