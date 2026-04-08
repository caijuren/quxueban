import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { validateChildAccess, ChildContextRequest } from '../middleware/childContext'

export const dashboardRouter: Router = Router()

// All routes require authentication
dashboardRouter.use(authMiddleware)
dashboardRouter.use(requireRole('parent'))
dashboardRouter.use(validateChildAccess)

/**
 * GET /stats - Get dashboard statistics
 * Query: ?childId= (optional) - Filter stats by specific child
 */
dashboardRouter.get('/stats', async (req: ChildContextRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId } = req.childContext!

  // Build where clauses based on child context
  const taskWhereClause: any = { familyId, isActive: true }
  const bookWhereClause: any = { familyId, status: 'active' }
  const checkinWhereClause: any = { familyId }
  const weeklyPlanWhereClause: any = { familyId }

  // If specific child is selected, filter by childId
  if (childId) {
    checkinWhereClause.childId = childId
    weeklyPlanWhereClause.childId = childId
  }

  // Get total tasks (family level)
  const totalTasks = await prisma.task.count({
    where: taskWhereClause
  })

  // Get books count (family level)
  const booksRead = await prisma.book.count({
    where: bookWhereClause
  })

  // Calculate today's study minutes from checkins
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const todayCheckins = await prisma.dailyCheckin.findMany({
    where: {
      ...checkinWhereClause,
      checkDate: {
        gte: today,
        lte: todayEnd
      },
      status: { in: ['completed', 'advance'] }
    },
    include: {
      plan: {
        include: { task: true }
      }
    }
  })

  const todayStudyMinutes = todayCheckins.reduce((sum, checkin) => {
    return sum + (checkin.plan?.task?.timePerUnit || 0) * (checkin.value || 1)
  }, 0)

  // Calculate weekly completion rate
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      ...weeklyPlanWhereClause,
      status: 'active'
    }
  })

  const totalTarget = weeklyPlans.reduce((sum, plan) => sum + plan.target, 0)
  const totalProgress = weeklyPlans.reduce((sum, plan) => sum + plan.progress, 0)
  const weeklyCompletionRate = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0

  res.json({
    status: 'success',
    data: {
      totalTasks,
      weeklyCompletionRate,
      todayStudyMinutes,
      booksRead,
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
dashboardRouter.get('/activities', async (req: ChildContextRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId } = req.childContext!

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
      time: '刚刚',
      type: 'book_read'
    })),
    ...checkins.map(c => ({
      id: `checkin-${c.id}`,
      childId: c.child?.id,
      childName: c.child?.name || '',
      childAvatar: c.child?.avatar,
      action: c.status === 'completed' ? '完成任务' : '打卡',
      task: c.plan?.task?.name,
      time: '刚刚',
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
