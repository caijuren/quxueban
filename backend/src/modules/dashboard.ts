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

  // Get books count — filter by childId if selected
  const bookWhereClause: any = { familyId, status: 'active' }
  if (childId) {
    bookWhereClause.childId = childId
  }
  const booksRead = await prisma.book.count({
    where: bookWhereClause
  })

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

  const todayCheckins = await prisma.dailyCheckin.findMany({
    where: {
      ...checkinWhereClause,
      checkDate: {
        gte: checkDate,
        lte: checkDateEnd
      },
      status: { in: ['completed', 'partial', 'advance'] }
    },
    include: {
      plan: {
        include: { task: true }
      }
    }
  })

  const todayStudyMinutes = todayCheckins.reduce((sum, checkin) => {
    // 优先使用用户填写的实际用时（包括0），否则使用任务默认时间
    const minutes = checkin.completedValue !== null && checkin.completedValue !== undefined ? checkin.completedValue : (checkin.plan?.task?.timePerUnit || 0)
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
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      ...weeklyPlanWhereClause,
      status: 'active'
    },
    include: {
      task: true
    }
  })

  // Calculate today's expected tasks and actual completion
  const dayOfWeek = checkDate.getDay() // 0 = Sunday, 1 = Monday, etc.
  const todayExpected = weeklyPlans.filter(plan => {
    const assignedDays = getAssignedDays(plan.assignedDays)
    // Handle Sunday (dayOfWeek === 0 corresponds to "0" in assignedDays)
    const targetDay = dayOfWeek === 0 ? 0 : dayOfWeek
    return assignedDays.includes(targetDay)
  }).reduce((sum, plan) => sum + plan.target, 0)

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

  const todayCheckins = await prisma.dailyCheckin.findMany({
    where: {
      familyId,
      ...(childId !== null ? { childId } : {}),
      checkDate: {
        gte: checkDate,
        lte: checkDateEnd
      }
    },
    include: {
      plan: {
        include: { task: true }
      }
    }
  })

  // Format checkins for frontend
  const formattedCheckins = todayCheckins.map(checkin => ({
    id: checkin.id,
    taskId: checkin.taskId,
    childId: checkin.childId,
    planId: checkin.planId,
    status: checkin.status,
    value: checkin.value,
    completedValue: checkin.completedValue,
    notes: checkin.notes,
    checkDate: checkin.checkDate,
    taskName: checkin.plan?.task?.name,
    taskCategory: checkin.plan?.task?.category,
    timePerUnit: checkin.plan?.task?.timePerUnit
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
