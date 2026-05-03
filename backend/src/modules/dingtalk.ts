import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import fetch from 'node-fetch'
import crypto from 'crypto'
import { dedupeLatestDailyTaskCheckins, getCountedStudyMinutes } from '../utils/study-minutes'
import { getWeekNo } from '../utils/date-utils'
import { createLogger } from '../config/logger'

const logger = createLogger('DingTalk')

export const dingtalkRouter: Router = Router()

/**
 * Generate DingTalk signature
 * @param timestamp - Current timestamp in milliseconds
 * @param secret - DingTalk robot secret
 * @returns Base64 encoded signature
 */
function generateDingTalkSignature(timestamp: number, secret: string): string {
  const stringToSign = `${timestamp}\n${secret}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(stringToSign)
  return encodeURIComponent(hmac.digest('base64'))
}

/**
 * Append signature to webhook URL
 * @param webhookUrl - Original webhook URL
 * @param secret - DingTalk robot secret
 * @returns URL with signature parameters
 */
function appendSignatureToUrl(webhookUrl: string, secret: string): string {
  if (!secret) return webhookUrl

  const timestamp = Date.now()
  const sign = generateDingTalkSignature(timestamp, secret)

  const separator = webhookUrl.includes('?') ? '&' : '?'
  return `${webhookUrl}${separator}timestamp=${timestamp}&sign=${sign}`
}

function getEducationStageLabel(stage?: string): string {
  return stage === 'middle' ? '初中阶段' : '小学阶段'
}

function getStageDashboardAdvice(stage: string | undefined, completionRate: number, partialTasks: number, todayStudyMinutes: number): string[] {
  const advice: string[] = []
  const isMiddle = stage === 'middle'

  if (completionRate < 60) {
    advice.push(isMiddle
      ? '建议先确认薄弱学科和错题来源，避免问题累积到周末。'
      : '建议先确认孩子卡点，必要时把任务拆小，放进固定时间块。')
  } else {
    advice.push(isMiddle
      ? '今天整体节奏稳定，明天可继续按学科优先级推进。'
      : '今天整体节奏稳定，明天可继续保持阅读、专注和习惯节奏。')
  }

  if (partialTasks > 0) {
    advice.push(isMiddle
      ? '部分完成的任务建议明天优先补齐，并记录错因或薄弱点。'
      : '部分完成的任务建议明天优先补齐，同时记录孩子状态和家长观察。')
  }

  if (todayStudyMinutes < 60) {
    advice.push(isMiddle
      ? '今日学习时长偏少，建议明天预留复习和错题整理时间。'
      : '今日学习时长偏少，建议明天预留晨读、睡前阅读或放学后时间块。')
  }

  return advice
}

function getAssignedDaysForPlan(plan: any): number[] {
  let assignedDays: number[] = []
  if (plan.assignedDays) {
    try {
      const parsedDays = typeof plan.assignedDays === 'string' ? JSON.parse(plan.assignedDays) : plan.assignedDays
      if (Array.isArray(parsedDays)) {
        assignedDays = parsedDays
      }
    } catch (e) {
      logger.warn({ err: e }, 'Failed to parse assignedDays')
    }
  }

  if (assignedDays.length > 0) return assignedDays

  const taskTags = plan.task?.tags as any || {}
  const taskWeeklyRule = plan.task?.weeklyRule as any || {}
  const scheduleRule = taskTags.scheduleRule || taskWeeklyRule.scheduleRule || 'daily'

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

// All routes require authentication and parent role
dingtalkRouter.use(authMiddleware)
dingtalkRouter.use(requireRole('parent'))

/**
 * POST /push-weekly-plan - Push weekly plan to DingTalk
 * Body: { childId, weekStartDate }
 */
dingtalkRouter.post('/push-weekly-plan', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId, weekStartDate } = req.body

  if (!childId || !weekStartDate) {
    throw new AppError(400, 'Missing required fields: childId, weekStartDate')
  }

  // Get child information
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child' },
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  // Get webhook URL and secret from child's profile
  const webhookUrl = child.dingtalkWebhookUrl
  const dingtalkSecret = child.dingtalkSecret || ''

  if (!webhookUrl) {
    throw new AppError(400, 'DingTalk webhook URL not configured for this child')
  }

  // Append signature if secret is available
  const signedUrl = appendSignatureToUrl(webhookUrl, dingtalkSecret)

  // Get weekly plans for the child
  const weekNo = getWeekNo(new Date(weekStartDate))
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      childId,
      weekNo,
    },
    include: {
      task: true,
    },
  })

  // Generate weekly plan message
  const message = generateWeeklyPlanMessage(child.name, weeklyPlans, new Date(weekStartDate))

  // Push to DingTalk
  try {
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    const response = await fetch(signedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: `${child.name}的周学习计划`,
          text: message,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId);

    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`钉钉API返回错误: ${responseText}`)
    }

    // Parse response to check if DingTalk returned an error code
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = null
    }
    
    if (responseData && responseData.errcode !== 0) {
      throw new Error(`钉钉API错误: ${responseData.errmsg || '未知错误'} (错误码: ${responseData.errcode})`)
    }

    res.json({
      status: 'success',
      message: '已推送至钉钉',
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Push weekly plan failed')
    throw new AppError(500, `推送失败: ${error.message}`)
  }
})

/**
 * POST /tasks/:taskId/push-to-dingtalk - Push task to DingTalk for specific child
 * Body: { childId }
 */
dingtalkRouter.post('/tasks/:taskId/push-to-dingtalk', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { taskId } = req.params
  const { childId } = req.body

  if (!childId) {
    throw new AppError(400, 'Missing required field: childId')
  }

  // Get child information
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child' },
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  // Get webhook URL and secret from child's profile
  const webhookUrl = child.dingtalkWebhookUrl
  const dingtalkSecret = child.dingtalkSecret || ''

  if (!webhookUrl) {
    throw new AppError(400, 'DingTalk webhook URL not configured for this child')
  }

  // Append signature if secret is available
  const signedUrl = appendSignatureToUrl(webhookUrl, dingtalkSecret)

  // Get task information
  const task = await prisma.task.findFirst({
    where: { id: parseInt(taskId as string), familyId },
  })

  if (!task) {
    throw new AppError(404, 'Task not found')
  }

  // Generate task message
  const message = generateTaskMessage(child.name, task)

  // Push to DingTalk
  try {
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    const response = await fetch(signedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: `${child.name}的任务推送`,
          text: message,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId);

    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`钉钉API返回错误: ${responseText}`)
    }

    // Parse response to check if DingTalk returned an error code
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = null
    }
    
    if (responseData && responseData.errcode !== 0) {
      throw new Error(`钉钉API错误: ${responseData.errmsg || '未知错误'} (错误码: ${responseData.errcode})`)
    }

    res.json({
      status: 'success',
      message: '任务已推送至钉钉',
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Push task failed')
    throw new AppError(500, `推送失败: ${error.message}`)
  }
})

/**
 * POST /dashboard/share - Share task completion status to DingTalk
 * Body: { childId, date }
 */
dingtalkRouter.post('/dashboard/share', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId, date } = req.body

  if (!childId) {
    throw new AppError(400, 'Missing required field: childId')
  }

  if (!date || typeof date !== 'string') {
    throw new AppError(400, 'Missing required field: date')
  }

  // Get child information
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child' },
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  // Get webhook URL and secret from child's profile
  const webhookUrl = child.dingtalkWebhookUrl
  const dingtalkSecret = child.dingtalkSecret || ''

  if (!webhookUrl) {
    throw new AppError(400, 'DingTalk webhook URL not configured for this child')
  }

  // Append signature if secret is available
  const signedUrl = appendSignatureToUrl(webhookUrl, dingtalkSecret)

  // Get target date
  let targetDate: Date
  // 解析日期字符串为本地时间
  const [year, month, day] = date.split('-').map(Number)
  targetDate = new Date(year, month - 1, day)
  targetDate.setHours(0, 0, 0, 0)
  const targetDateEnd = new Date(targetDate)
  targetDateEnd.setHours(23, 59, 59, 999)
  const targetWeekNo = getWeekNo(targetDate)

  // Get child's weekly plans
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      childId,
      weekNo: targetWeekNo,
      status: 'active'
    },
    include: {
      task: true
    }
  })

  // Get target date's checkins
  const todayCheckins = await prisma.dailyCheckin.findMany({
    where: {
      childId,
      checkDate: {
        gte: targetDate,
        lte: targetDateEnd
      }
    },
    include: {
      plan: {
        include: { task: true }
      }
    }
  })
  const directTaskIds = Array.from(new Set(todayCheckins.map(checkin => checkin.taskId).filter(Boolean)))
  const directTasks = directTaskIds.length > 0
    ? await prisma.task.findMany({
      where: { id: { in: directTaskIds }, familyId },
      select: { id: true, timePerUnit: true },
    })
    : []
  const directTaskMinutes = new Map(directTasks.map(task => [task.id, task.timePerUnit]))
  const checkinsWithTaskMinutes = todayCheckins.map(checkin => ({
    ...checkin,
    taskTimePerUnit: directTaskMinutes.get(checkin.taskId),
  }))
  const activeTodayCheckins = dedupeLatestDailyTaskCheckins(checkinsWithTaskMinutes)

  // Get all active plans
  const allActivePlans = weeklyPlans

  // Get target date's day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const todayDayOfWeek = targetDate.getDay()

  // Filter plans that are scheduled for target date's day of week
  const todayScheduledPlans = allActivePlans.filter(plan => getAssignedDaysForPlan(plan).includes(todayDayOfWeek))

  // Log debug information

  // Calculate study time (only completed and partial tasks)
  const todayStudyMinutes = activeTodayCheckins
    .filter(checkin => checkin.status === 'completed' || checkin.status === 'partial')
    .reduce((sum, checkin) => sum + getCountedStudyMinutes(checkin), 0)

  // Group tasks by completion status
  const tasksByStatus: any = {
    completed: [],
    partial: [],
    notCompleted: [],
    postponed: [],
    notInvolved: []
  }

  // Create maps for quick lookup
  const checkinMapByPlanId = new Map<number, any>()
  const checkinMapByTaskId = new Map<number, any>()
  activeTodayCheckins.forEach(checkin => {
    if (checkin.planId) {
      checkinMapByPlanId.set(checkin.planId, checkin)
    }
    if (checkin.taskId) {
      checkinMapByTaskId.set(checkin.taskId, checkin)
    }
  })

  // Process each scheduled plan for the target date
  todayScheduledPlans.forEach(plan => {
    const checkin = checkinMapByPlanId.get(plan.id) || checkinMapByTaskId.get(plan.task.id)
    if (checkin) {
      // Task has a checkin record
      const taskWithCheckin = {
        ...plan.task,
        checkinId: checkin.id,
        checkinStatus: checkin.status,
        actualTime: getCountedStudyMinutes(checkin) || plan.task.timePerUnit,
        notes: checkin.notes
      }
      if (checkin.status === 'completed') {
        tasksByStatus.completed.push(taskWithCheckin)
      } else if (checkin.status === 'partial') {
        tasksByStatus.partial.push(taskWithCheckin)
      } else if (checkin.status === 'postponed') {
        tasksByStatus.postponed.push(taskWithCheckin)
      } else if (checkin.status === 'not_involved') {
        tasksByStatus.notInvolved.push(taskWithCheckin)
      } else {
        tasksByStatus.notCompleted.push(taskWithCheckin)
      }
    } else {
      tasksByStatus.notCompleted.push({
        ...plan.task,
        actualTime: plan.task.timePerUnit,
        notes: ''
      })
    }
  })

  const totalTasks = todayScheduledPlans.length
  const completedTasks = tasksByStatus.completed.length
  const partialTasks = tasksByStatus.partial.length
  const postponedTasks = tasksByStatus.postponed.length
  const notInvolvedTasks = tasksByStatus.notInvolved.length
  const notCompletedTasks = tasksByStatus.notCompleted.length
  const actionableTasks = totalTasks - notInvolvedTasks
  const completionRate = actionableTasks > 0 ? Math.round(((completedTasks + partialTasks) / actionableTasks) * 100) : 0

  // Log debug information about task grouping
  
  // Log checkin statuses and full checkins

  // Generate dashboard message
  const message = generateDashboardMessage(
    child.name,
    child.educationStage,
    totalTasks,
    completedTasks,
    partialTasks,
    postponedTasks,
    notCompletedTasks,
    notInvolvedTasks,
    completionRate,
    todayStudyMinutes,
    tasksByStatus,
    targetDate
  )

  // Push to DingTalk
  try {
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    const response = await fetch(signedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: `${child.name}的今日学习情况`,
          text: message,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId);

    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`钉钉API返回错误: ${responseText}`)
    }

    // Parse response to check if DingTalk returned an error code
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = null
    }
    
    if (responseData && responseData.errcode !== 0) {
      throw new Error(`钉钉API错误: ${responseData.errmsg || '未知错误'} (错误码: ${responseData.errcode})`)
    }

    res.json({
      status: 'success',
      message: '今日学习情况已分享至钉钉',
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Share dashboard failed')
    throw new AppError(500, `分享失败: ${error.message}`)
  }
})

// Helper function to generate task message
function generateTaskMessage(childName: string, task: any): string {
  let message = `# ${childName}的任务推送
`
  message += `> 时间：${new Date().toLocaleString('zh-CN')}

`
  message += `## 任务详情
`
  message += `- **任务名称**：${task.name}
`
  message += `- **分类**：${task.category}
`
  message += `- **类型**：${task.type}
`
  message += `- **时长**：${task.timePerUnit}分钟
`
  message += `- **状态**：${task.isActive ? '活跃' : '暂停'}

`
  message += `## 温馨提示
`
  message += `- 请按时完成任务
`
  message += `- 如有疑问，请及时与家长沟通
`
  message += `- 加油！💪
`

  return message
}

// Helper functions
function generateWeeklyPlanMessage(childName: string, plans: any[], weekStart: Date): string {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  let message = `# ${childName}的周学习计划\n`
  message += `> 时间：${weekStart.getMonth() + 1}月${weekStart.getDate()}日 - ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日\n\n`
  message += `## 任务安排\n`

  // Group tasks by day
  const tasksByDay: any = {}
  weekDays.forEach((_, index) => {
    tasksByDay[index] = []
  })

  plans.forEach(plan => {
    const weeklyRule = plan.task.weeklyRule as { days?: number[] } | null
    let assignedDays: number[] = []

    if (plan.assignedDays) {
      try {
        const parsedDays = typeof plan.assignedDays === 'string' ? JSON.parse(plan.assignedDays) : plan.assignedDays
        if (Array.isArray(parsedDays)) {
          assignedDays = parsedDays
        }
      } catch (e) {
        logger.warn({ err: e }, 'Failed to parse assignedDays')
      }
    } else if (weeklyRule?.days && weeklyRule.days.length > 0) {
      assignedDays = weeklyRule.days
    } else {
      // Get scheduleRule from task tags
      const taskTags = plan.task.tags as any || {}
      const taskWeeklyRule = plan.task.weeklyRule as any || {}
      const scheduleRule = taskTags.scheduleRule || taskWeeklyRule.scheduleRule || 'daily'
      
      if (scheduleRule === 'daily') {
        assignedDays = [0, 1, 2, 3, 4, 5, 6]
      } else if (scheduleRule === 'school') {
        assignedDays = [1, 2, 4, 5] // 周一、周二、周四、周五
      } else if (scheduleRule === 'weekend') {
        assignedDays = [0, 6] // 周日、周六
      } else if (scheduleRule === 'flexible') {
        assignedDays = [1, 2, 3, 4, 5] // 周一到周五
      } else {
        assignedDays = [0, 1, 2, 3, 4, 5, 6]
      }
    }

    assignedDays.forEach(day => {
      tasksByDay[day].push(plan)
    })
  })

  // Add tasks for each day
  weekDays.forEach((day, index) => {
    const dayTasks = tasksByDay[index]
    if (dayTasks.length > 0) {
      message += `### ${day}\n`
      dayTasks.forEach((task: any) => {
        message += `- ${task.task.name} (${task.task.timePerUnit}分钟)\n`
      })
      message += '\n'
    }
  })

  message += `## 温馨提示\n`
  message += `- 请按照计划完成每日任务\n`
  message += `- 如有特殊情况，请及时调整计划\n`
  message += `- 坚持就是胜利！💪\n`

  return message
}

// Helper function to generate dashboard message
function generateDashboardMessage(
  childName: string,
  educationStage: string | undefined,
  totalTasks: number,
  completedTasks: number,
  partialTasks: number,
  postponedTasks: number,
  notCompletedTasks: number,
  notInvolvedTasks: number,
  completionRate: number,
  todayStudyMinutes: number,
  tasksByStatus: any,
  targetDate: Date
): string {
  const hours = Math.floor(todayStudyMinutes / 60)
  const minutes = todayStudyMinutes % 60
  const studyTime = hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`
  const actionableTasks = totalTasks - notInvolvedTasks

  let message = `# ${childName}的今日学习情况
`
  message += `> 时间：${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日\n\n`
  message += `> 学习阶段：${getEducationStageLabel(educationStage)}\n\n`
  message += `## 今日摘要\n`
  message += `- **今日应做**：${actionableTasks}项\n`
  message += `- **已完成**：${completedTasks}项\n`
  message += `- **部分完成**：${partialTasks}项\n`
  message += `- **未完成**：${notCompletedTasks}项\n`
  message += `- **推迟**：${postponedTasks}项\n`
  if (notInvolvedTasks > 0) {
    message += `- **今日不涉及**：${notInvolvedTasks}项\n`
  }
  message += `- **完成率**：${completionRate}%\n`
  message += `- **学习时长**：${studyTime}\n\n`

  if (tasksByStatus.completed.length > 0) {
    message += `### 已完成任务\n`
    tasksByStatus.completed.forEach((task: any, index: number) => {
      message += `${index + 1}. **${task.name}**（${task.actualTime}分钟）\n`
      if (task.notes) {
        message += `   备注：${task.notes}\n`
      }
    })
    message += `\n`
  }

  if (tasksByStatus.partial.length > 0) {
    message += `### 部分完成\n`
    tasksByStatus.partial.forEach((task: any, index: number) => {
      message += `${index + 1}. **${task.name}**（${task.actualTime}分钟）\n`
      if (task.notes) {
        message += `   备注：${task.notes}\n`
      }
    })
    message += `\n`
  }

  const pendingTasks = [...tasksByStatus.notCompleted, ...tasksByStatus.postponed]
  if (pendingTasks.length > 0) {
    message += `### 待跟进任务\n`
    pendingTasks.forEach((task: any, index: number) => {
      const minutesLabel = task.actualTime || task.timePerUnit
      message += `${index + 1}. **${task.name}**（预计${minutesLabel}分钟）\n`
      if (task.notes) {
        message += `   备注：${task.notes}\n`
      }
    })
    message += `\n`
  }

  message += `### 建议\n`
  getStageDashboardAdvice(educationStage, completionRate, partialTasks, todayStudyMinutes)
    .forEach((item) => {
      message += `- ${item}\n`
    })

  return message
}
