import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const dashboardRouter: Router = Router()

// All routes require authentication
dashboardRouter.use(authMiddleware)
dashboardRouter.use(requireRole('parent'))

/**
 * GET /stats - Get dashboard statistics
 */
dashboardRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  // Get total tasks
  const totalTasks = await prisma.task.count({
    where: { familyId, isActive: true }
  })

  // Get books count
  const booksRead = await prisma.book.count({
    where: { familyId, status: 'active' }
  })

  // Calculate weekly completion rate (mock for now)
  const weeklyCompletionRate = 0
  const todayStudyMinutes = 0

  res.json({
    status: 'success',
    data: {
      totalTasks,
      weeklyCompletionRate,
      todayStudyMinutes,
      booksRead
    }
  })
})

/**
 * GET /activities - Get recent activities
 */
dashboardRouter.get('/activities', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  // Get recent reading logs
  const readingLogs = await prisma.readingLog.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      child: { select: { id: true, name: true, avatar: true } },
      book: { select: { id: true, name: true } }
    }
  })

  // Get recent checkins
  const checkins = await prisma.dailyCheckin.findMany({
    where: { familyId },
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
      childName: log.child?.name || '',
      childAvatar: log.child?.avatar,
      action: '阅读图书',
      book: log.book?.name,
      time: '刚刚',
      type: 'book_read'
    })),
    ...checkins.map(c => ({
      id: `checkin-${c.id}`,
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
    data: activities
  })
})
