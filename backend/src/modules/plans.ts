import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest } from '../middleware/auth'

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
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      childId: userId,
      weekNo,
      status: 'active',
    },
    include: {
      task: true,
    },
  })

  // Filter tasks by day of week
  const fixedTasks: any[] = []
  const flexibleTasks: any[] = []

  for (const plan of weeklyPlans) {
    const task = plan.task
    const weeklyRule = task.weeklyRule as {
      excludeDays?: number[]
      onlyWeekend?: boolean
      days?: number[]
    } | null

    // Check if task should be shown today
    let showToday = true

    // School homework: exclude Wednesday (day 3)
    if (task.category === 'school') {
      if (task.name.includes('培优') || task.name.includes('高思') || task.name.includes('全新英语')) {
        // Advanced: weekend only
        showToday = dayOfWeek === 0 || dayOfWeek === 6
      } else {
        // Regular school homework: exclude Wednesday
        showToday = dayOfWeek !== 3
      }
    }

    // Apply weekly rule overrides
    if (weeklyRule?.onlyWeekend) {
      showToday = showToday && (dayOfWeek === 0 || dayOfWeek === 6)
    }
    if (weeklyRule?.excludeDays && weeklyRule.excludeDays.length > 0) {
      showToday = showToday && !weeklyRule.excludeDays.includes(dayOfWeek)
    }
    if (weeklyRule?.days && weeklyRule.days.length > 0) {
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
 * Body: { taskId, planId, status, value }
 *
 * Statuses: completed, partial, postponed, not_involved, not_completed, makeup, advance
 */
plansRouter.post('/checkin', async (req: AuthRequest, res: Response) => {
  const { taskId, planId, status, value } = req.body
  const { userId, familyId, role } = req.user!

  // Only children can check in
  if (role !== 'child') {
    throw new AppError(403, 'Only children can check in')
  }

  if (!taskId || !status) {
    throw new AppError(400, 'Missing required fields: taskId, status')
  }

  // Validate status
  const validStatuses = ['completed', 'partial', 'postponed', 'not_involved', 'not_completed', 'makeup', 'advance']
  if (!validStatuses.includes(status)) {
    throw new AppError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check if already checked in today for this task
  const existingCheckin = await prisma.dailyCheckin.findFirst({
    where: {
      childId: userId,
      taskId,
      checkDate: today,
    },
  })

  if (existingCheckin) {
    // Update existing checkin
    const updatedCheckin = await prisma.dailyCheckin.update({
      where: { id: existingCheckin.id },
      data: {
        status,
        value: value || 1,
        planId: planId || existingCheckin.planId,
      },
    })

    // Update weekly plan progress
    if (planId && (status === 'completed' || status === 'advance')) {
      await prisma.weeklyPlan.update({
        where: { id: planId },
        data: { progress: { increment: 1 } },
      })
    }

    res.json({
      status: 'success',
      message: 'Checkin updated',
      data: updatedCheckin,
    })
  } else {
    // Create new checkin
    const checkin = await prisma.dailyCheckin.create({
      data: {
        familyId,
        childId: userId,
        taskId,
        planId,
        status,
        value: value || 1,
        checkDate: today,
      },
    })

    // Update weekly plan progress
    if (planId && (status === 'completed' || status === 'advance')) {
      await prisma.weeklyPlan.update({
        where: { id: planId },
        data: { progress: { increment: 1 } },
      })
    }

    res.status(201).json({
      status: 'success',
      message: 'Checkin recorded',
      data: checkin,
    })
  }
})

/**
 * GET /week/:weekStart - Get weekly plan for parent view
 * Returns: WeeklyPlan[] for all children in the family
 */
plansRouter.get('/week/:weekStart', async (req: AuthRequest, res: Response) => {
  const { familyId, role } = req.user!
  const weekStart = req.params.weekStart as string

  // Only parents can view family weekly plans
  if (role !== 'parent') {
    throw new AppError(403, 'This endpoint is only for parents')
  }

  const weekNo = getWeekNo(new Date(weekStart))

  // Get all children in the family
  const children = await prisma.user.findMany({
    where: {
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

  // Get weekly plans for all children
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      familyId,
      weekNo,
    },
    include: {
      task: true,
      child: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
  })

  // Group by child and format for frontend
  const plansByChild = children.map(child => {
    const childPlans = weeklyPlans.filter(p => p.childId === child.id)
    
    return {
      id: `plan-${child.id}`,
      childId: String(child.id),
      childName: child.name,
      weekStartDate: weekStart,
      allocations: childPlans.map(p => {
        const weeklyRule = p.task.weeklyRule as { days?: number[] } | null
        let assignedDays: number[] = []
        
        // 获取任务的 scheduleRule
        const taskTags = p.task.tags as any || {}
        const taskWeeklyRule = p.task.weeklyRule as any || {}
        const scheduleRule = taskTags.scheduleRule || taskWeeklyRule.scheduleRule || 'daily'
        
        // 优先从数据库读取实际分配的天数
        if (p.assignedDays && Array.isArray(p.assignedDays)) {
          assignedDays = p.assignedDays as number[]
        } else {
          // 如果没有保存的数据，则根据 scheduleRule 推算（兼容旧数据）
          if (weeklyRule?.days && weeklyRule.days.length > 0) {
            assignedDays = weeklyRule.days
          } else if (scheduleRule === 'daily') {
            assignedDays = [0, 1, 2, 3, 4, 5, 6]
          } else if (scheduleRule === 'school') {
            assignedDays = [0, 1, 3, 4]
          } else if (scheduleRule === 'weekend') {
            assignedDays = [5, 6]
          } else if (scheduleRule === 'flexible') {
            assignedDays = [0, 1, 2, 3, 4, 5, 6]
          } else {
            assignedDays = [0, 1, 2, 3, 4, 5, 6]
          }
        }
        
        // 确保 subject 是字符串类型
        let subject = 'other'
        if (p.task.tags && typeof p.task.tags === 'object') {
          subject = (p.task.tags as any).subject || 'other'
        }
        
        return {
          taskId: String(p.taskId),
          taskName: p.task.name,
          category: p.task.category,
          timePerUnit: p.task.timePerUnit,
          assignedDays: assignedDays,
          subject: subject,
          difficulty: (p.task.tags as any)?.difficulty || 'basic',
          isTemporary: (p.task.tags as any)?.isTemporary || false,
          scheduleRule: scheduleRule,
          target: p.target,
          progress: p.progress,
        }
      }),
      dailyProgress: Array.from({ length: 7 }, (_, i) => ({
        day: i,
        completed: 0,
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
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      childId: userId,
      weekNo,
    },
    include: {
      task: true,
    },
  })

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
      plans: weeklyPlans.map(p => ({
        planId: p.id,
        taskId: p.taskId,
        taskName: p.task.name,
        category: p.task.category,
        target: p.target,
        progress: p.progress,
        status: p.status,
      })),
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
 * POST /temp-task - Create a temporary task
 * Body: { name, subject, due, urgency, childId }
 */
plansRouter.post('/temp-task', async (req: AuthRequest, res: Response) => {
  try {
    const { familyId, role } = req.user!
    const { name, subject, due, urgency, childId } = req.body

    console.log('Creating temporary task:', { name, subject, due, urgency, childId })

    // Only parents can create temporary tasks
    if (role !== 'parent') {
      throw new AppError(403, 'Only parents can create temporary tasks')
    }

    if (!name || !childId) {
      throw new AppError(400, 'Missing required fields: name, childId')
    }

    // Validate child exists
    console.log('Finding child with id:', childId, 'and familyId:', familyId)
    const child = await prisma.user.findFirst({
      where: { id: childId, familyId, role: 'child' },
    })

    console.log('Found child:', child)
    if (!child) {
      throw new AppError(404, 'Child not found')
    }

    // Create temporary task
    console.log('Creating task...')
    try {
      const task = await prisma.task.create({
        data: {
          familyId,
          name,
          category: '临时任务',
          type: 'flexible',
          timePerUnit: 30, // Default duration
          weeklyRule: JSON.stringify({ scheduleRule: 'flexible' }),
          tags: JSON.stringify({
            subject: subject || 'other',
            urgency: urgency || 'normal',
            isTemporary: true,
          }),
          isActive: true,
        },
      })

      console.log('Created task:', task)

      // Create weekly plan for the task
      const today = new Date()
      const weekNo = getWeekNo(today)

      // Determine assigned days based on due date
      let assignedDays: number[] = []
      const dayOfWeek = today.getDay() // 0=Sunday, 6=Saturday

      switch (due) {
        case 'today':
          assignedDays = [dayOfWeek]
          break
        case 'tomorrow':
          assignedDays = [(dayOfWeek + 1) % 7]
          break
        case 'weekend':
          // This weekend (Saturday and Sunday)
          if (dayOfWeek === 0) { // Sunday
            assignedDays = [0, 6] // Sunday and Saturday
          } else if (dayOfWeek === 6) { // Saturday
            assignedDays = [6, 0] // Saturday and Sunday
          } else {
            // Find next Saturday and Sunday
            assignedDays = [6, 0] // Saturday and Sunday
          }
          break
        default:
          assignedDays = [dayOfWeek] // Default to today
      }

      console.log('Assigned days:', assignedDays)

      console.log('Creating weekly plan...')
      try {
        const weeklyPlan = await prisma.weeklyPlan.create({
        data: {
          familyId,
          childId,
          taskId: task.id,
          target: 1,
          progress: 0,
          weekNo,
          status: 'active',
        },
      })

        console.log('Created weekly plan:', weeklyPlan)

        res.status(201).json({
          status: 'success',
          message: '临时任务已创建',
          data: {
            task,
            weeklyPlan,
          },
        })
      } catch (weekPlanError: any) {
        console.error('Error creating weekly plan:', weekPlanError)
        throw new AppError(500, `创建周计划失败: ${weekPlanError.message}`)
      }
    } catch (taskError: any) {
      console.error('Error creating task:', taskError)
      throw new AppError(500, `创建任务失败: ${taskError.message}`)
    }
  } catch (error: any) {
    console.error('Error creating temporary task:', error)
    if (error instanceof AppError) {
      throw error
    }
    throw new AppError(500, `创建临时任务失败: ${error.message}`)
  }
})

// ============================================
// Diagnostic Endpoint (临时诊断用)
// ============================================

/**
 * GET /debug/plans - 诊断端点，查看数据库中的 assignedDays 数据
 */
plansRouter.get('/debug/plans', async (req: AuthRequest, res: Response) => {
  try {
    const plans = await prisma.weeklyPlan.findMany({
      where: { status: 'active' },
      include: { task: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const diagnosticData = plans.map(plan => ({
      taskName: plan.task.name,
      taskId: plan.taskId,
      target: plan.target,
      assignedDays: plan.assignedDays,
      assignedDaysMeaning: Array.isArray(plan.assignedDays) 
        ? plan.assignedDays.map(d => {
            const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            return `${d}(${dayNames[d]})`;
          })
        : 'null',
      scheduleRule: plan.task.scheduleRule,
      weeklyRule: plan.task.weeklyRule,
    }));

    res.json({
      status: 'success',
      message: '诊断数据',
      data: diagnosticData,
      tips: {
        'assignedDays为null': '说明数据未保存，需要重新发布计划',
        'assignedDays有值': '检查索引是否正确：周末任务应该是 [0, 6] 或 [5, 6]',
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
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
