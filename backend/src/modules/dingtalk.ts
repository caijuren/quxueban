import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import fetch from 'node-fetch'
import crypto from 'crypto'

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
    console.log('[Push Weekly Plan] Sending to:', webhookUrl)
    console.log('[Push Weekly Plan] With signature:', signedUrl !== webhookUrl)
    console.log('[Push Weekly Plan] Message:', message)
    
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
    console.log('[Push Weekly Plan] Response status:', response.status)
    console.log('[Push Weekly Plan] Response body:', responseText)

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
    console.error('[Push Weekly Plan] Error:', error)
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
    where: { id: parseInt(taskId), familyId },
  })

  if (!task) {
    throw new AppError(404, 'Task not found')
  }

  // Generate task message
  const message = generateTaskMessage(child.name, task)

  // Push to DingTalk
  try {
    console.log('[Push Task] Sending to:', webhookUrl)
    console.log('[Push Task] With signature:', signedUrl !== webhookUrl)
    console.log('[Push Task] Message:', message)
    
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
    console.log('[Push Task] Response status:', response.status)
    console.log('[Push Task] Response body:', responseText)

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
    console.error('[Push Task] Error:', error)
    throw new AppError(500, `推送失败: ${error.message}`)
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
function getWeekNo(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-${weekNum.toString().padStart(2, '0')}`
}

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
        console.error('Failed to parse assignedDays:', e)
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
