import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

function getSingleQueryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseLocalDate(value: unknown): Date | null {
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
    return null
  }

  return date
}

function parseLocalDateRange(startValue: unknown, endValue: unknown) {
  const startDate = parseLocalDate(startValue)
  const endDate = parseLocalDate(endValue)

  if (!startDate || !endDate || startDate > endDate) {
    return null
  }

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  return { startDate, endDate }
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

function getWeekNo(date: Date): string {
  const year = date.getFullYear()
  const firstDay = new Date(year, 0, 1)
  const dayOfWeek = firstDay.getDay()
  const firstMonday = new Date(firstDay)
  firstMonday.setDate(firstDay.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek))

  if (date < firstMonday) {
    return `${year - 1}-52`
  }

  const diffTime = date.getTime() - firstMonday.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weekNo = Math.floor(diffDays / 7) + 1

  return `${year}-${String(weekNo).padStart(2, '0')}`
}

function getWeekNosInRange(startDate: Date, endDate: Date): string[] {
  const weekNos = new Set<string>()
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= endDate) {
    weekNos.add(getWeekNo(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return Array.from(weekNos)
}

function getAllowedDays(scheduleRule: string, assignedDays: unknown): number[] {
  const storedDays = getAssignedDays(assignedDays)
  if (storedDays.length > 0) {
    return storedDays
  }

  switch (scheduleRule) {
    case 'school':
      return [1, 2, 4, 5]
    case 'weekend':
      return [0, 6]
    case 'flexible':
      return [1, 2, 3, 4, 5]
    case 'daily':
    default:
      return [0, 1, 2, 3, 4, 5, 6]
  }
}

function countAssignedDaysInRange(startDate: Date, endDate: Date, allowedDays: number[]): number {
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  let count = 0

  while (cursor <= endDate) {
    if (allowedDays.includes(cursor.getDay())) {
      count += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return count
}

function getTaskBucket(task: { category?: unknown; name?: unknown; tags?: unknown }): 'chinese' | 'math' | 'english' | 'reading' | 'other' {
  const tags = parseTaskTags(task.tags)
  const subject = typeof tags.subject === 'string' ? tags.subject : ''
  const category = typeof task.category === 'string' ? task.category : ''
  const name = typeof task.name === 'string' ? task.name : ''

  if (subject === 'chinese' || category === 'chinese') return 'chinese'
  if (subject === 'math' || category === 'math') return 'math'
  if (subject === 'english' || category === 'english') return 'english'

  if (category.includes('阅读') || name.includes('阅读') || name.toLowerCase().includes('read')) {
    return 'reading'
  }

  return 'other'
}

const taskBucketLabels: Record<string, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  reading: '阅读',
  other: '其他',
}

function getCountedStudyMinutes(checkin: any): number {
  if (!['completed', 'partial'].includes(checkin.status)) return 0
  if (checkin.completed_value !== null && checkin.completed_value !== undefined) {
    return Number(checkin.completed_value) || 0
  }
  return (Number(checkin.time_per_unit) || 0) * (Number(checkin.value) || 1)
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

  // Calculate study minutes for specified date/range or today
  const date = getSingleQueryValue(req.query.date)
  const requestedRange = parseLocalDateRange(req.query.startDate, req.query.endDate)
  const checkDate = requestedRange?.startDate || parseLocalDate(date) || new Date()
  if (!requestedRange) {
    checkDate.setHours(0, 0, 0, 0)
  }
  const checkDateEnd = requestedRange?.endDate || new Date(checkDate)
  if (!requestedRange) {
    checkDateEnd.setHours(23, 59, 59, 999)
  }

  const rangeAllCheckins = await prisma.$queryRawUnsafe(
    `SELECT
      dc.id,
      dc.child_id,
      dc.task_id,
      dc.plan_id,
      dc.status,
      dc.value,
      dc.completed_value,
      dc.check_date,
      dc.created_at,
      t.time_per_unit,
      t.name,
      t.category,
      t.schedule_rule,
      t.tags
    FROM daily_checkins dc
    LEFT JOIN weekly_plans wp ON wp.id = dc.plan_id
    LEFT JOIN tasks t ON t.id = wp.task_id
    WHERE dc.family_id = $1
      ${childId ? 'AND dc.child_id = $2' : ''}
      AND dc.check_date >= $${childId ? 3 : 2}
      AND dc.check_date <= $${childId ? 4 : 3}`,
    ...(childId ? [familyId, childId, checkDate, checkDateEnd] : [familyId, checkDate, checkDateEnd])
  ) as any[]
  const rangeCheckins = rangeAllCheckins.filter((checkin: any) => ['completed', 'partial'].includes(checkin.status))

  const todayStudyMinutes = rangeCheckins.reduce((sum, checkin: any) => {
    return sum + getCountedStudyMinutes(checkin)
  }, 0)
  const rangeCompletedTasks = rangeCheckins.length
  const taskStatusCounts = {
    completed: rangeAllCheckins.filter((checkin: any) => checkin.status === 'completed').length,
    partial: rangeAllCheckins.filter((checkin: any) => checkin.status === 'partial').length,
    notCompleted: rangeAllCheckins.filter((checkin: any) => checkin.status === 'not_completed').length,
    postponed: rangeAllCheckins.filter((checkin: any) => checkin.status === 'postponed').length,
    notInvolved: rangeAllCheckins.filter((checkin: any) => checkin.status === 'not_involved').length,
  }
  const taskTypeMinutes = {
    chinese: 0,
    math: 0,
    english: 0,
    reading: 0,
    other: 0,
  }

  rangeCheckins.forEach((checkin: any) => {
    const bucket = getTaskBucket({
      category: checkin.category,
      name: checkin.name,
      tags: checkin.tags,
    })
    taskTypeMinutes[bucket] += getCountedStudyMinutes(checkin)
  })

  // Calculate distinct books read for specified date/range or today.
  const todayReadingRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT book_id)::int AS count
    FROM reading_logs
    WHERE family_id = $1
      ${childId ? 'AND child_id = $2' : ''}
      AND read_date >= $${childId ? 3 : 2}
      AND read_date <= $${childId ? 4 : 3}`,
    ...(childId ? [familyId, childId, checkDate, checkDateEnd] : [familyId, checkDate, checkDateEnd])
  ) as any[]
  const todayReadingCount = todayReadingRows[0]?.count || 0

  const weekNos = getWeekNosInRange(checkDate, checkDateEnd)
  const rangePlans = await prisma.weeklyPlan.findMany({
    where: {
      familyId,
      status: 'active',
      weekNo: { in: weekNos },
      ...(childId ? { childId } : {}),
    },
    include: {
      task: {
        select: {
          id: true,
          name: true,
          category: true,
          timePerUnit: true,
          scheduleRule: true,
          tags: true,
        },
      },
    },
  })

  const rangePlannedTasks = rangePlans.reduce((sum, plan) => {
    const taskTags = parseTaskTags(plan.task.tags)
    const scheduleRule = plan.task.scheduleRule || taskTags.scheduleRule || 'daily'
    const allowedDays = getAllowedDays(scheduleRule, plan.assignedDays)
    return sum + countAssignedDaysInRange(checkDate, checkDateEnd, allowedDays)
  }, 0)

  const rangeCompletionRate = rangePlannedTasks > 0
    ? Math.round((rangeCompletedTasks / rangePlannedTasks) * 100)
    : 0
  const recordedStatusCount = Object.values(taskStatusCounts).reduce((sum, value) => sum + value, 0)
  taskStatusCounts.notCompleted += Math.max(rangePlannedTasks - recordedStatusCount, 0)
  const completionTrend = Array.from({ length: Math.min(14, Math.ceil((checkDateEnd.getTime() - checkDate.getTime()) / 86400000) + 1) }).map((_, index) => {
    const day = new Date(checkDate)
    day.setDate(checkDate.getDate() + index)
    day.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)
    const dayCompleted = rangeCheckins.filter((checkin: any) => {
      const checkinDate = new Date(checkin.check_date)
      return checkinDate >= day && checkinDate <= dayEnd
    }).length
    const dayPlanned = rangePlans.reduce((sum, plan) => {
      const taskTags = parseTaskTags(plan.task.tags)
      const scheduleRule = plan.task.scheduleRule || taskTags.scheduleRule || 'daily'
      const allowedDays = getAllowedDays(scheduleRule, plan.assignedDays)
      return allowedDays.includes(day.getDay()) ? sum + 1 : sum
    }, 0)

    return {
      date: day.toLocaleDateString('en-CA').slice(5),
      planned: dayPlanned,
      completed: dayCompleted,
      rate: dayPlanned > 0 ? Math.round((dayCompleted / dayPlanned) * 100) : 0,
    }
  })
  const taskTypeDistribution = Object.entries(taskTypeMinutes).map(([key, minutes]) => ({
    key,
    label: taskBucketLabels[key] || '其他',
    minutes,
  }))
  const checkinsByPlanId = new Map<number, any[]>()
  rangeAllCheckins.forEach((checkin: any) => {
    if (!checkin.plan_id) return
    const current = checkinsByPlanId.get(checkin.plan_id) || []
    current.push(checkin)
    checkinsByPlanId.set(checkin.plan_id, current)
  })
  const focusTasks = rangePlans
    .map((plan) => {
      const taskTags = parseTaskTags(plan.task.tags)
      const scheduleRule = plan.task.scheduleRule || taskTags.scheduleRule || 'daily'
      const allowedDays = getAllowedDays(scheduleRule, plan.assignedDays)
      const planned = countAssignedDaysInRange(checkDate, checkDateEnd, allowedDays)
      const checkins = checkinsByPlanId.get(plan.id) || []
      const completed = checkins.filter((checkin: any) => ['completed', 'partial'].includes(checkin.status)).length
      const postponed = checkins.filter((checkin: any) => checkin.status === 'postponed').length
      const notCompleted = Math.max(planned - completed - postponed, 0) + checkins.filter((checkin: any) => checkin.status === 'not_completed').length

      return {
        planId: plan.id,
        taskId: plan.taskId,
        name: plan.task.name,
        category: taskBucketLabels[getTaskBucket({ category: plan.task.category, name: plan.task.name, tags: plan.task.tags })],
        planned,
        completed,
        postponed,
        notCompleted,
        riskScore: notCompleted * 2 + postponed,
      }
    })
    .filter((task) => task.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5)
  const readingLogs = await prisma.readingLog.findMany({
    where: {
      ...readingLogWhereClause,
      readDate: {
        gte: checkDate,
        lte: checkDateEnd,
      },
    },
    orderBy: { readDate: 'desc' },
    take: 5,
    include: {
      book: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })
  const readingAggregate = await prisma.readingLog.aggregate({
    where: {
      ...readingLogWhereClause,
      readDate: {
        gte: checkDate,
        lte: checkDateEnd,
      },
    },
    _sum: {
      minutes: true,
      pages: true,
    },
  })
  const readingPerformance = {
    records: todayReadingCount,
    minutes: readingAggregate._sum.minutes || 0,
    pages: readingAggregate._sum.pages || 0,
    recentBooks: readingLogs.map((log) => ({
      id: log.book?.id || log.bookId,
      name: log.book?.name || '未命名图书',
      pages: log.pages || 0,
      minutes: log.minutes || 0,
      readDate: log.readDate.toLocaleDateString('en-CA'),
    })),
  }

  res.json({
    status: 'success',
    data: {
      totalTasks,
      plannedTasks: rangePlannedTasks,
      completedTasks: rangeCompletedTasks,
      weeklyCompletionRate: rangeCompletionRate,
      taskStatusCounts,
      completionTrend,
      taskTypeDistribution,
      focusTasks,
      readingPerformance,
      todayStudyMinutes,
      booksRead,
      todayReadingCount,
      rangeStartDate: checkDate.toLocaleDateString('en-CA'),
      rangeEndDate: checkDateEnd.toLocaleDateString('en-CA'),
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
    `SELECT DISTINCT ON (COALESCE(wp.task_id, dc.task_id))
      dc.id,
      dc.task_id,
      dc.child_id,
      dc.plan_id,
      dc.status,
      dc.value,
      dc.completed_value,
      dc.focus_minutes,
      dc.notes,
      dc.metadata,
      dc.evidence_url,
      dc.check_date,
      t.id AS resolved_task_id,
      t.name AS task_name,
      t.category AS task_category,
      t.time_per_unit
    FROM daily_checkins dc
    LEFT JOIN weekly_plans wp ON wp.id = dc.plan_id
    LEFT JOIN tasks t ON t.id = COALESCE(wp.task_id, dc.task_id)
    WHERE dc.family_id = $1
      ${childId !== null ? 'AND dc.child_id = $2' : ''}
      AND dc.check_date >= $${childId !== null ? 3 : 2}
      AND dc.check_date <= $${childId !== null ? 4 : 3}
    ORDER BY COALESCE(wp.task_id, dc.task_id), dc.id DESC`,
    ...(childId !== null ? [familyId, childId, checkDate, checkDateEnd] : [familyId, checkDate, checkDateEnd])
  ) as any[]

  // Format checkins for frontend
  const formattedCheckins = todayCheckins.map((checkin: any) => ({
    id: checkin.id,
    taskId: checkin.resolved_task_id || checkin.task_id,
    childId: checkin.child_id,
    planId: checkin.plan_id,
    status: checkin.status,
    value: checkin.value,
    completedValue: checkin.completed_value,
    focusMinutes: checkin.focus_minutes,
    notes: checkin.notes || '',
    metadata: checkin.metadata || {},
    evidenceUrl: checkin.evidence_url || '',
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
