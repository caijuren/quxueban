import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const statisticsRouter: Router = Router()

// All routes require authentication and parent role
statisticsRouter.use(authMiddleware)
statisticsRouter.use(requireRole('parent'))

// Category mapping for display names
const categoryLabels: Record<string, string> = {
  school: '校内巩固',
  advanced: '校内拔高',
  extra: '课外课程',
  english: '英语阅读',
  chinese: '中文阅读',
  sports: '体育运动',
}

const subjectLabels: Record<string, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  sports: '体育',
}

const formatLabels: Record<string, string> = {
  paper: '纸质作业',
  tablet: '平板/在线',
  app: 'App打卡',
  reading: '阅读活动',
  recite: '口头诵读',
  exercise: '运动锻炼',
}

const participationLabels: Record<string, string> = {
  independent: '独立完成',
  accompany: '家长陪同',
  interactive: '亲子互动',
  parent: '家长主导',
}

/**
 * Helper function to get week number for a date
 */
function getWeekNo(date: Date): string {
  const year = date.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  return `${year}-${week.toString().padStart(2, '0')}`
}

/**
 * Helper function to get weekNos for the last N days
 */
function getWeekNosForDays(days: number): string[] {
  const weekNos: Set<string> = new Set()
  const now = new Date()
  
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    weekNos.add(getWeekNo(d))
  }
  
  return Array.from(weekNos)
}

/**
 * GET /overview - Get overview statistics for the family
 * Query: ?childId=&weekNo=2025-14&days=7
 */
statisticsRouter.get('/overview', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = req.query.childId ? parseInt(req.query.childId as string) : undefined
  const weekNo = req.query.weekNo as string | undefined
  const days = req.query.days ? parseInt(req.query.days as string) : undefined

  // Get children in family
  const children = await prisma.user.findMany({
    where: {
      familyId,
      role: 'child',
      status: 'active',
    },
    select: { id: true, name: true, avatar: true },
  })

  const childIds = childId ? [childId] : children.map(c => c.id)

  // Build where clause
  const whereClause: any = {
    familyId,
    childId: { in: childIds },
  }
  
  // Support days parameter for time range filtering
  if (days && !weekNo) {
    const weekNos = getWeekNosForDays(days)
    whereClause.weekNo = { in: weekNos }
  } else if (weekNo) {
    whereClause.weekNo = weekNo
  }

  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: whereClause,
    include: {
      task: true,
      checkins: true,
    },
  })

  // Calculate statistics
  const totalTasks = weeklyPlans.length
  const totalTarget = weeklyPlans.reduce((sum, p) => sum + p.target, 0)
  const totalProgress = weeklyPlans.reduce((sum, p) => sum + p.progress, 0)
  const completionRate = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0

  // Calculate time by category
  const categoryTime: Record<string, number> = {}
  weeklyPlans.forEach(plan => {
    const category = plan.task?.category
    if (category) {
      const time = (plan.task?.timePerUnit || 30) * plan.target
      categoryTime[category] = (categoryTime[category] || 0) + time
    }
  })

  // Calculate time by subject tag
  const subjectTime: Record<string, number> = {}
  weeklyPlans.forEach(plan => {
    const tags = plan.task?.tags as { subject?: string } | null
    if (tags?.subject) {
      const time = (plan.task?.timePerUnit || 30) * plan.target
      subjectTime[tags.subject] = (subjectTime[tags.subject] || 0) + time
    }
  })

  // Calculate format distribution
  const formatDistribution: Record<string, number> = {}
  weeklyPlans.forEach(plan => {
    const tags = plan.task?.tags as { format?: string[] } | null
    if (tags?.format && Array.isArray(tags.format)) {
      tags.format.forEach(fmt => {
        const time = (plan.task?.timePerUnit || 30) * plan.target
        formatDistribution[fmt] = (formatDistribution[fmt] || 0) + time
      })
    }
  })

  // Calculate participation distribution
  const participationDistribution: Record<string, number> = {}
  weeklyPlans.forEach(plan => {
    const tags = plan.task?.tags as { participation?: string } | null
    if (tags?.participation) {
      const time = (plan.task?.timePerUnit || 30) * plan.target
      participationDistribution[tags.participation] = (participationDistribution[tags.participation] || 0) + time
    }
  })

  // Daily completion data for the period
  const dailyCompletion: Record<string, { completed: number; total: number }> = {}
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  weekDays.forEach(day => {
    dailyCompletion[day] = { completed: 0, total: 0 }
  })

  weeklyPlans.forEach(plan => {
    plan.checkins.forEach(checkin => {
      const dayName = weekDays[checkin.checkDate.getDay()]
      dailyCompletion[dayName].total += 1
      if (checkin.status === 'completed' || checkin.status === 'advance' || checkin.status === 'makeup') {
        dailyCompletion[dayName].completed += 1
      }
    })
  })

  // Calculate total time
  const totalTime = Object.values(categoryTime).reduce((a, b) => a + b, 0)
  const hasCategoryData = Object.keys(categoryTime).length > 0
  const hasSubjectData = Object.keys(subjectTime).length > 0
  const hasFormatData = Object.keys(formatDistribution).length > 0
  const hasParticipationData = Object.keys(participationDistribution).length > 0

  res.json({
    status: 'success',
    data: {
      summary: {
        totalTasks,
        totalTarget,
        totalProgress,
        completionRate,
        totalTime,
      },
      byCategory: Object.entries(categoryTime).map(([key, value]) => ({
        name: categoryLabels[key] || key,
        value,
        percentage: hasCategoryData ? Math.round((value / totalTime) * 100) : 0,
      })),
      bySubject: Object.entries(subjectTime).map(([key, value]) => ({
        name: subjectLabels[key] || key,
        value,
        percentage: hasSubjectData ? Math.round((value / Object.values(subjectTime).reduce((a, b) => a + b, 0)) * 100) : 0,
      })),
      byFormat: Object.entries(formatDistribution).map(([key, value]) => ({
        name: formatLabels[key] || key,
        value,
        percentage: hasFormatData ? Math.round((value / Object.values(formatDistribution).reduce((a, b) => a + b, 0)) * 100) : 0,
      })),
      byParticipation: Object.entries(participationDistribution).map(([key, value]) => ({
        name: participationLabels[key] || key,
        value,
        percentage: hasParticipationData ? Math.round((value / Object.values(participationDistribution).reduce((a, b) => a + b, 0)) * 100) : 0,
      })),
      dailyCompletion: weekDays.map(day => ({
        day,
        completed: dailyCompletion[day].completed,
        total: dailyCompletion[day].total,
        rate: dailyCompletion[day].total > 0
          ? Math.round((dailyCompletion[day].completed / dailyCompletion[day].total) * 100)
          : 0,
      })),
      children: children.map(c => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar,
      })),
    },
  })
})

/**
 * GET /trends - Get completion trends over time
 * Query: ?childId=&weeks=4
 */
statisticsRouter.get('/trends', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = req.query.childId ? parseInt(req.query.childId as string) : undefined
  const weeks = parseInt(req.query.weeks as string) || 4

  let childIds: number[] = childId ? [childId] : []
  if (!childId) {
    const children = await prisma.user.findMany({
      where: { familyId, role: 'child', status: 'active' },
      select: { id: true },
    })
    childIds = children.map(c => c.id)
  }

  // Get last N weeks of data
  const weekNos: string[] = []
  const now = new Date()
  for (let i = weeks - 1; i >= 0; i--) {
    weekNos.push(getWeekNo(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)))
  }

  const trends = await Promise.all(
    weekNos.map(async (weekNo) => {
      const plans = await prisma.weeklyPlan.findMany({
        where: {
          familyId,
          childId: { in: childIds },
          weekNo,
        },
        include: {
          checkins: true,
          task: true,
        },
      })

      const totalTarget = plans.reduce((sum, p) => sum + p.target, 0)
      const totalProgress = plans.reduce((sum, p) => sum + p.progress, 0)
      const totalTime = plans.reduce((sum, p) => sum + (p.task?.timePerUnit || 30) * p.target, 0)

      return {
        weekNo,
        completionRate: totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0,
        totalTasks: plans.length,
        totalTime,
      }
    })
  )

  res.json({
    status: 'success',
    data: { trends },
  })
})

/**
 * GET /insights - Get AI-generated learning insights (placeholder)
 * Query: ?childId=
 */
statisticsRouter.get('/insights', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = req.query.childId ? parseInt(req.query.childId as string) : undefined

  // Get children info
  let childIds: number[] = childId ? [childId] : []
  if (!childId) {
    const children = await prisma.user.findMany({
      where: { familyId, role: 'child', status: 'active' },
      select: { id: true },
    })
    childIds = children.map(c => c.id)
  }

  // Get current week stats
  const currentWeekNo = getWeekNo(new Date())
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      familyId,
      childId: { in: childIds },
      weekNo: currentWeekNo,
    },
    include: {
      task: true,
      checkins: true,
    },
  })

  // Calculate metrics for insights
  const totalTarget = weeklyPlans.reduce((sum, p) => sum + p.target, 0)
  const totalProgress = weeklyPlans.reduce((sum, p) => sum + p.progress, 0)
  const completionRate = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0

  // Generate insights based on data
  const insights: Array<{ type: 'success' | 'warning' | 'info'; text: string }> = []

  if (completionRate >= 80) {
    insights.push({
      type: 'success',
      text: `本周完成率高达 ${completionRate}%，学习状态良好，继续保持！`,
    })
  } else if (completionRate < 50) {
    insights.push({
      type: 'warning',
      text: `本周完成率仅 ${completionRate}%，建议检查任务难度是否匹配，并适当增加专注时段。`,
    })
  }

  // Time analysis
  const totalTime = weeklyPlans.reduce((sum, p) => sum + (p.task?.timePerUnit || 30) * p.target, 0)
  const totalHours = Math.round(totalTime / 60)
  if (totalHours > 20) {
    insights.push({
      type: 'info',
      text: `本周预计学习时长 ${totalHours} 小时，注意劳逸结合。`,
    })
  }

  res.json({
    status: 'success',
    data: { insights },
  })
})