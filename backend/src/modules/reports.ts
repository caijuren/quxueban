import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const reportsRouter: Router = Router()

// All routes require authentication
reportsRouter.use(authMiddleware)

// ============================================
// Reports Routes
// ============================================

/**
 * GET /daily - Get daily report
 * Query: { date?, childId? }
 * Returns: { completionRate, stats, taskDetails, totalStudyTime }
 */
reportsRouter.get('/daily', async (req: AuthRequest, res: Response) => {
  const { userId, familyId, role } = req.user!
  const { date, childId } = req.query

  const reportDate = date ? new Date(date as string) : new Date()
  reportDate.setHours(0, 0, 0, 0)

  const dayStart = new Date(reportDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(reportDate)
  dayEnd.setHours(23, 59, 59, 999)

  // Determine target child
  let targetChildId = userId
  if (role === 'parent' && childId) {
    // Verify child belongs to family
    const child = await prisma.user.findFirst({
      where: { id: parseInt(childId as string), familyId, role: 'child' },
    })
    if (!child) {
      throw new AppError(404, 'Child not found')
    }
    targetChildId = child.id
  } else if (role === 'parent' && !childId) {
    // Parent viewing all children's report
    return getAllChildrenDailyReport(familyId, reportDate, res)
  }

  // Get checkins for the day
  const checkins = await prisma.dailyCheckin.findMany({
    where: {
      childId: targetChildId,
      checkDate: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    include: {
      plan: {
        include: { task: true },
      },
    },
  })

  // Get weekly plans for the week
  const weekNo = getWeekNo(reportDate)
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      childId: targetChildId,
      weekNo,
    },
    include: { task: true },
  })

  // Calculate stats
  const totalTasks = checkins.length
  const completedTasks = checkins.filter(c => c.status === 'completed' || c.status === 'advance').length
  const partialTasks = checkins.filter(c => c.status === 'partial').length
  const postponedTasks = checkins.filter(c => c.status === 'postponed').length
  const notCompletedTasks = checkins.filter(c => c.status === 'not_completed').length
  const makeupTasks = checkins.filter(c => c.status === 'makeup').length
  const advanceTasks = checkins.filter(c => c.status === 'advance').length

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Calculate total study time
  let totalStudyTime = 0
  for (const checkin of checkins) {
    if (checkin.plan?.task?.timePerUnit) {
      totalStudyTime += checkin.plan.task.timePerUnit * (checkin.value || 1)
    }
  }

  // Task details
  const taskDetails = checkins.map(c => ({
    taskId: c.taskId,
    taskName: c.plan?.task?.name || 'Unknown Task',
    category: c.plan?.task?.category || '',
    status: c.status,
    value: c.value,
    timeSpent: c.plan?.task?.timePerUnit ? c.plan.task.timePerUnit * (c.value || 1) : 0,
  }))

  res.json({
    status: 'success',
    data: {
      date: reportDate.toISOString().split('T')[0],
      childId: targetChildId,
      completionRate,
      stats: {
        total: totalTasks,
        completed: completedTasks,
        partial: partialTasks,
        postponed: postponedTasks,
        notCompleted: notCompletedTasks,
        makeup: makeupTasks,
        advance: advanceTasks,
      },
      taskDetails,
      totalStudyTime,
      weeklyProgress: weeklyPlans.map(p => ({
        taskName: p.task.name,
        target: p.target,
        progress: p.progress,
      })),
    },
  })
})

/**
 * GET /weekly - Get weekly report
 * Query: { weekNo?, childId? }
 */
reportsRouter.get('/weekly', async (req: AuthRequest, res: Response) => {
  const { userId, familyId, role } = req.user!
  const { weekNo, childId } = req.query

  const reportWeekNo = (weekNo as string) || getWeekNo(new Date())

  // Determine target child
  let targetChildId = userId
  if (role === 'parent' && childId) {
    const child = await prisma.user.findFirst({
      where: { id: parseInt(childId as string), familyId, role: 'child' },
    })
    if (!child) {
      throw new AppError(404, 'Child not found')
    }
    targetChildId = child.id
  } else if (role === 'parent' && !childId) {
    return getAllChildrenWeeklyReport(familyId, reportWeekNo, res)
  }

  // Get weekly plans
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      childId: targetChildId,
      weekNo: reportWeekNo,
    },
    include: { task: true },
  })

  // Get week date range
  const weekDates = getWeekDates(reportWeekNo)

  // Get all checkins for the week
  const checkins = await prisma.dailyCheckin.findMany({
    where: {
      childId: targetChildId,
      checkDate: {
        gte: weekDates.start,
        lte: weekDates.end,
      },
    },
    include: {
      plan: {
        include: { task: true },
      },
    },
  })

  // Calculate totals
  const totalTarget = weeklyPlans.reduce((sum, p) => sum + p.target, 0)
  const totalProgress = weeklyPlans.reduce((sum, p) => sum + p.progress, 0)
  const completionRate = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0

  // Daily stats
  const dailyStats = []
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekDates.start)
    dayDate.setDate(dayDate.getDate() + i)
    const dayStart = new Date(dayDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayDate)
    dayEnd.setHours(23, 59, 59, 999)

    const dayCheckins = checkins.filter(c => {
      const checkDate = new Date(c.checkDate)
      return checkDate >= dayStart && checkDate <= dayEnd
    })

    const completed = dayCheckins.filter(c => c.status === 'completed' || c.status === 'advance').length
    const total = dayCheckins.length

    let studyTime = 0
    for (const c of dayCheckins) {
      if (c.plan?.task?.timePerUnit) {
        studyTime += c.plan.task.timePerUnit * (c.value || 1)
      }
    }

    dailyStats.push({
      day: i,
      date: dayDate.toISOString().split('T')[0],
      completed,
      total,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      studyTime,
    })
  }

  // Task breakdown
  const taskBreakdown = weeklyPlans.map(p => {
    const taskCheckins = checkins.filter(c => c.taskId === p.taskId)
    const completed = taskCheckins.filter(c => c.status === 'completed' || c.status === 'advance').length

    return {
      taskId: p.taskId,
      taskName: p.task.name,
      category: p.task.category,
      type: p.task.type,
      target: p.target,
      progress: p.progress,
      completionRate: p.target > 0 ? Math.round((p.progress / p.target) * 100) : 0,
      checkinsCompleted: completed,
    }
  })

  // Total study time
  let totalStudyTime = 0
  for (const c of checkins) {
    if (c.plan?.task?.timePerUnit) {
      totalStudyTime += c.plan.task.timePerUnit * (c.value || 1)
    }
  }

  res.json({
    status: 'success',
    data: {
      weekNo: reportWeekNo,
      childId: targetChildId,
      totalTarget,
      totalProgress,
      completionRate,
      totalStudyTime,
      dailyStats,
      taskBreakdown,
    },
  })
})

/**
 * POST /push-dingtalk - Push report to DingTalk webhook (Parent only)
 * Body: { reportType, childId?, message? }
 */
reportsRouter.post('/push-dingtalk', requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { reportType, childId, message } = req.body
  const { familyId } = req.user!

  if (!reportType || !['daily', 'weekly'].includes(reportType)) {
    throw new AppError(400, 'Invalid reportType. Must be "daily" or "weekly"')
  }

  // Get family settings for DingTalk webhook
  const family = await prisma.family.findUnique({
    where: { id: familyId },
  })

  const settings = family?.settings as { dingtalkWebhook?: string } | null
  const webhookUrl = settings?.dingtalkWebhook

  if (!webhookUrl) {
    throw new AppError(400, 'DingTalk webhook URL not configured in family settings')
  }

  // Get report data
  let reportData: any
  let childName = 'All Children'

  if (reportType === 'daily') {
    const targetChildId = childId ? parseInt(childId) : undefined

    if (targetChildId) {
      const child = await prisma.user.findFirst({
        where: { id: targetChildId, familyId, role: 'child' },
      })
      if (!child) {
        throw new AppError(404, 'Child not found')
      }
      childName = child.name
    }

    // Get today's report
    const today = new Date()
    const dayStart = new Date(today)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(today)
    dayEnd.setHours(23, 59, 59, 999)

    const checkins = await prisma.dailyCheckin.findMany({
      where: {
        familyId,
        ...(targetChildId && { childId: targetChildId }),
        checkDate: { gte: dayStart, lte: dayEnd },
      },
      include: { plan: { include: { task: true } } },
    })

    const completed = checkins.filter(c => c.status === 'completed' || c.status === 'advance').length
    const total = checkins.length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    reportData = {
      date: today.toISOString().split('T')[0],
      completionRate,
      completed,
      total,
    }
  } else {
    // Weekly report
    const weekNo = getWeekNo(new Date())

    const weeklyPlans = await prisma.weeklyPlan.findMany({
      where: { familyId, weekNo },
      include: { task: true, child: true },
    })

    const totalTarget = weeklyPlans.reduce((sum, p) => sum + p.target, 0)
    const totalProgress = weeklyPlans.reduce((sum, p) => sum + p.progress, 0)
    const completionRate = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0

    reportData = {
      weekNo,
      completionRate,
      totalProgress,
      totalTarget,
    }
  }

  // Build markdown message for DingTalk
  const title = reportType === 'daily' ? '📚 每日学习报告' : '📊 每周学习报告'
  let markdownContent = `## ${title}\n\n`
  markdownContent += `**家庭**: ${family?.name}\n`
  markdownContent += `**孩子**: ${childName}\n\n`

  if (reportType === 'daily') {
    markdownContent += `**日期**: ${reportData.date}\n`
    markdownContent += `**完成率**: ${reportData.completionRate}%\n`
    markdownContent += `**完成任务**: ${reportData.completed}/${reportData.total}\n`
  } else {
    markdownContent += `**周次**: ${reportData.weekNo}\n`
    markdownContent += `**完成率**: ${reportData.completionRate}%\n`
    markdownContent += `**进度**: ${reportData.totalProgress}/${reportData.totalTarget}\n`
  }

  if (message) {
    markdownContent += `\n**备注**: ${message}\n`
  }

  markdownContent += `\n---\n*自动推送自学习计划系统*`

  // Send to DingTalk
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title,
          text: markdownContent,
        },
      }),
    })

    const result = await response.json() as { errcode: number; errmsg: string }

    if (result.errcode !== 0) {
      throw new AppError(500, `DingTalk API error: ${result.errmsg}`)
    }

    res.json({
      status: 'success',
      message: 'Report pushed to DingTalk successfully',
      data: {
        reportType,
        childName,
        sent: true,
      },
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(500, 'Failed to push to DingTalk. Please check webhook URL.')
  }
})

// ============================================
// Helper Functions
// ============================================

async function getAllChildrenDailyReport(familyId: number, reportDate: Date, res: Response) {
  const dayStart = new Date(reportDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(reportDate)
  dayEnd.setHours(23, 59, 59, 999)

  const children = await prisma.user.findMany({
    where: { familyId, role: 'child', status: 'active' },
  })

  const reports = await Promise.all(
    children.map(async (child) => {
      const checkins = await prisma.dailyCheckin.findMany({
        where: {
          childId: child.id,
          checkDate: { gte: dayStart, lte: dayEnd },
        },
        include: { plan: { include: { task: true } } },
      })

      const completed = checkins.filter(c => c.status === 'completed' || c.status === 'advance').length
      const total = checkins.length
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

      let studyTime = 0
      for (const c of checkins) {
        if (c.plan?.task?.timePerUnit) {
          studyTime += c.plan.task.timePerUnit * (c.value || 1)
        }
      }

      return {
        childId: child.id,
        childName: child.name,
        avatar: child.avatar,
        completionRate,
        completed,
        total,
        studyTime,
      }
    })
  )

  res.json({
    status: 'success',
    data: {
      date: reportDate.toISOString().split('T')[0],
      children: reports,
    },
  })
}

async function getAllChildrenWeeklyReport(familyId: number, weekNo: string, res: Response) {
  const children = await prisma.user.findMany({
    where: { familyId, role: 'child', status: 'active' },
  })

  const weekDates = getWeekDates(weekNo)

  const reports = await Promise.all(
    children.map(async (child) => {
      const weeklyPlans = await prisma.weeklyPlan.findMany({
        where: { childId: child.id, weekNo },
        include: { task: true },
      })

      const checkins = await prisma.dailyCheckin.findMany({
        where: {
          childId: child.id,
          checkDate: { gte: weekDates.start, lte: weekDates.end },
        },
        include: { plan: { include: { task: true } } },
      })

      const totalTarget = weeklyPlans.reduce((sum, p) => sum + p.target, 0)
      const totalProgress = weeklyPlans.reduce((sum, p) => sum + p.progress, 0)
      const completionRate = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0

      let studyTime = 0
      for (const c of checkins) {
        if (c.plan?.task?.timePerUnit) {
          studyTime += c.plan.task.timePerUnit * (c.value || 1)
        }
      }

      return {
        childId: child.id,
        childName: child.name,
        avatar: child.avatar,
        totalTarget,
        totalProgress,
        completionRate,
        studyTime,
      }
    })
  )

  res.json({
    status: 'success',
    data: {
      weekNo,
      children: reports,
    },
  })
}

function getWeekNo(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-${weekNum.toString().padStart(2, '0')}`
}

function getWeekDates(weekNo: string): { start: Date; end: Date } {
  const [year, week] = weekNo.split('-').map(Number)
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dayOfWeek = simple.getDay()
  const ISOweekStart = new Date(simple)
  if (dayOfWeek <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
  }
  const ISOweekEnd = new Date(ISOweekStart)
  ISOweekEnd.setDate(ISOweekStart.getDate() + 6)

  ISOweekStart.setHours(0, 0, 0, 0)
  ISOweekEnd.setHours(23, 59, 59, 999)

  return { start: ISOweekStart, end: ISOweekEnd }
}
