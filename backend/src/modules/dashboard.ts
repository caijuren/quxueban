import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

function getSingleQueryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getAssignedDays(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((day): day is number => typeof day === 'number')
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((day): day is number => typeof day === 'number')
        : []
    } catch {
      return []
    }
  }

  return []
}

function parseTaskTags(value: unknown): Record<string, any> {
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

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffHour < 48) return '昨天'
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export const dashboardRouter: Router = Router()

// All routes require authentication
dashboardRouter.use(authMiddleware)
dashboardRouter.use(requireRole('parent'))

/**
 * GET /stats - Get dashboard statistics
 * Query: ?childId= (optional) - Filter stats by specific child
 */
dashboardRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childIdParam = req.query.childId
  const childId = childIdParam ? parseInt(childIdParam as string) : null

  // Build where clauses based on child context
  const checkinWhereClause: any = { familyId }
  const weeklyPlanWhereClause: any = { familyId }

  // If specific child is selected, filter by childId
  if (childId) {
    checkinWhereClause.childId = childId
    weeklyPlanWhereClause.childId = childId
  }

  // Get total tasks — filter by childId via appliesTo JSON array
  let totalTasks: number
  if (childId) {
    const allTasks = await prisma.task.findMany({
      where: { familyId, isActive: true },
      select: { appliesTo: true }
    })
    totalTasks = allTasks.filter(t => {
      const arr = Array.isArray(t.appliesTo) ? t.appliesTo as number[] : []
      return arr.includes(childId)
    }).length
  } else {
    totalTasks = await prisma.task.count({
      where: { familyId, isActive: true }
    })
  }

  // 当前线上 books 表没有 child_id，先按家庭统计
  const booksReadRows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM books
    WHERE family_id = ${familyId} AND status = 'active'
  ` as any[]
  const booksRead = booksReadRows[0]?.count || 0

  // Prepare reading log where clause
  const readingLogWhereClause: any = { familyId }
  if (childId) {
    readingLogWhereClause.childId = childId
  }

  // Calculate study minutes for specified date or today
  const date = getSingleQueryValue(req.query.date)
  // Use local time to match frontend date handling
  const checkDate = date ? new Date(date) : new Date()
  // Set to start of day in local time
  checkDate.setHours(0, 0, 0, 0)
  const checkDateEnd = new Date(checkDate)
  checkDateEnd.setHours(23, 59, 59, 999)

  const todayCheckins = await prisma.$queryRawUnsafe(
    `SELECT
      dc.id,
      dc.child_id,
      dc.task_id,
      dc.plan_id,
      dc.status,
      dc.value,
      dc.check_date,
      dc.created_at,
      t.time_per_unit,
      t.schedule_rule,
      t.tags
    FROM daily_checkins dc
    LEFT JOIN weekly_plans wp ON wp.id = dc.plan_id
    LEFT JOIN tasks t ON t.id = wp.task_id
    WHERE dc.family_id = $1
      ${childId ? 'AND dc.child_id = $2' : ''}
      AND dc.check_date >= $${childId ? 3 : 2}
      AND dc.check_date <= $${childId ? 4 : 3}
      AND dc.status IN ('completed', 'partial', 'advance')`,
    ...(childId ? [familyId, childId, checkDate, checkDateEnd] : [familyId, checkDate, checkDateEnd])
  ) as any[]

  const todayStudyMinutes = todayCheckins.reduce((sum, checkin: any) => {
    const minutes = checkin.time_per_unit || 0
    return sum + minutes * (checkin.value || 1)
  }, 0)

  // Calculate reading count for specified date or today
  const todayReadingCount = await prisma.readingLog.count({
    where: {
      ...readingLogWhereClause,
      createdAt: {
        gte: checkDate,
        lte: checkDateEnd
      }
    }
  })

  // Calculate weekly completion rate (based on today's actual checkins)
  // Get all weekly plans for the child
  const weeklyPlans = await prisma.$queryRawUnsafe(
    `SELECT
      wp.id,
      wp.target,
      t.schedule_rule,
      t.tags
    FROM weekly_plans wp
    JOIN tasks t ON t.id = wp.task_id
    WHERE wp.family_id = $1
      ${childId ? 'AND wp.child_id = $2' : ''}
      AND wp.status = 'active'`,
    ...(childId ? [familyId, childId] : [familyId])
  ) as any[]

  // Calculate today's expected tasks and actual completion
  const dayOfWeek = checkDate.getDay() // 0 = Sunday, 1 = Monday, etc.
  const todayExpected = weeklyPlans.filter((plan: any) => {
    const taskTags = parseTaskTags(plan.tags)
    const scheduleRule = plan.schedule_rule || taskTags.scheduleRule || 'daily'

    let allowedDays: number[]
    switch (scheduleRule) {
      case 'school':
        allowedDays = [1, 2, 4, 5]
        break
      case 'weekend':
        allowedDays = [0, 6]
        break
      case 'flexible':
        allowedDays = [1, 2, 3, 4, 5]
        break
      case 'daily':
      default:
        allowedDays = [0, 1, 2, 3, 4, 5, 6]
    }

    return allowedDays.includes(dayOfWeek)
  }).reduce((sum: number, plan: any) => sum + plan.target, 0)

  const todayActual = todayCheckins
    .filter(checkin => checkin.status === 'completed' || checkin.status === 'partial')
    .reduce((sum, checkin) => sum + (checkin.value || 1), 0)

  const weeklyCompletionRate = todayExpected > 0 ? Math.round((todayActual / todayExpected) * 100) : 0

  res.json({
    status: 'success',
    data: {
      totalTasks,
      weeklyCompletionRate,
      todayStudyMinutes,
      booksRead,
      todayReadingCount,
      // Include child context for frontend reference
      childId,
      childFilterActive: !!childId
    }
  })
})

/**
 * GET /activities - Get recent activities
 * Query: ?childId= (optional) - Filter activities by specific child
 */
dashboardRouter.get('/activities', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childIdParam = req.query.childId
  const childId = childIdParam ? parseInt(childIdParam as string) : null

  // Build where clauses based on child context
  const readingLogWhereClause: any = { familyId }
  const checkinWhereClause: any = { familyId }

  // If specific child is selected, filter by childId
  if (childId) {
    readingLogWhereClause.childId = childId
    checkinWhereClause.childId = childId
  }

  // Get recent reading logs
  const readingLogs = await prisma.readingLog.findMany({
    where: readingLogWhereClause,
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      child: { select: { id: true, name: true, avatar: true } },
      book: { select: { id: true, name: true } }
    }
  })

  // Get recent checkins
  const checkins = await prisma.dailyCheckin.findMany({
    where: checkinWhereClause,
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      child: { select: { id: true, name: true, avatar: true } },
      plan: { include: { task: { select: { name: true } } } }
    }
  })

  // Combine and format activities
  const activities = [
    ...readingLogs.map(log => ({
      id: `reading-${log.id}`,
      childId: log.child?.id,
      childName: log.child?.name || '',
      childAvatar: log.child?.avatar,
      action: '阅读图书',
      book: log.book?.name,
      time: formatRelativeTime(log.createdAt),
      type: 'book_read'
    })),
    ...checkins.map(c => ({
      id: `checkin-${c.id}`,
      childId: c.child?.id,
      childName: c.child?.name || '',
      childAvatar: c.child?.avatar,
      action: c.status === 'completed' ? '完成任务' : '打卡',
      task: c.plan?.task?.name,
      time: formatRelativeTime(c.createdAt),
      type: 'task_complete'
    }))
  ].slice(0, 5)

  res.json({
    status: 'success',
    data: activities,
    meta: {
      childId,
      childFilterActive: !!childId
    }
  })
})

/**
 * GET /today-checkins - Get checkins for selected child and date
 * Query: ?date=YYYY-MM-DD (optional, defaults to today)
 */
dashboardRouter.get('/today-checkins', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childIdParam = req.query.childId
  const childId = childIdParam ? parseInt(childIdParam as string) : null
  const { date } = req.query

  // Get checkins for specified date or today
  // Use local time to match frontend date handling
  let checkDate: Date
  if (date) {
    // Parse date string as local time
    const [year, month, day] = (date as string).split('-').map(Number)
    checkDate = new Date(year, month - 1, day)
  } else {
    checkDate = new Date()
  }
  // Set to start of day in local time
  checkDate.setHours(0, 0, 0, 0)
  const checkDateEnd = new Date(checkDate)
  checkDateEnd.setHours(23, 59, 59, 999)

  const todayCheckins = await prisma.$queryRawUnsafe(
    `SELECT
      dc.id,
      dc.task_id,
      dc.child_id,
      dc.plan_id,
      dc.status,
      dc.value,
      dc.check_date,
      t.name AS task_name,
      t.category AS task_category,
      t.time_per_unit
    FROM daily_checkins dc
    LEFT JOIN weekly_plans wp ON wp.id = dc.plan_id
    LEFT JOIN tasks t ON t.id = wp.task_id
    WHERE dc.family_id = $1
      ${childId !== null ? 'AND dc.child_id = $2' : ''}
      AND dc.check_date >= $${childId !== null ? 3 : 2}
      AND dc.check_date <= $${childId !== null ? 4 : 3}`,
    ...(childId !== null ? [familyId, childId, checkDate, checkDateEnd] : [familyId, checkDate, checkDateEnd])
  ) as any[]

  // Format checkins for frontend
  const formattedCheckins = todayCheckins.map((checkin: any) => ({
    id: checkin.id,
    taskId: checkin.task_id,
    childId: checkin.child_id,
    planId: checkin.plan_id,
    status: checkin.status,
    value: checkin.value,
    completedValue: null,
    notes: '',
    checkDate: checkin.check_date,
    taskName: checkin.task_name,
    taskCategory: checkin.task_category,
    timePerUnit: checkin.time_per_unit
  }))

  res.json({
    status: 'success',
    data: formattedCheckins,
    meta: {
      childId,
      date: checkDate.toLocaleDateString('en-CA')
    }
  })
})
