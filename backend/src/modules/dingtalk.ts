import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import fetch from 'node-fetch'

export const dingtalkRouter: Router = Router()

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

  // Get family settings to get DingTalk webhook URL
  const family = await prisma.family.findUnique({
    where: { id: familyId },
  })

  if (!family) {
    throw new AppError(404, 'Family not found')
  }

  const settings = family.settings as { dingtalkWebhook?: string } | null
  const webhookUrl = settings?.dingtalkWebhook

  if (!webhookUrl) {
    throw new AppError(400, 'DingTalk webhook URL not configured')
  }

  // Get child information
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child' },
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

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
    console.log('Sending to DingTalk webhook:', webhookUrl)
    console.log('Message:', message)
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    const response = await fetch(webhookUrl, {
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

    console.log('DingTalk response status:', response.status)
    console.log('DingTalk response text:', await response.text())

    if (!response.ok) {
      throw new Error(`DingTalk API error: ${await response.text()}`)
    }

    res.json({
      status: 'success',
      message: '已推送至钉钉',
    })
  } catch (error: any) {
    console.error('DingTalk push error:', error)
    throw new AppError(500, `推送失败: ${error.message}`)
  }
})

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

    if (plan.daysAllocated) {
      try {
        const parsedDays = typeof plan.daysAllocated === 'string' ? JSON.parse(plan.daysAllocated) : plan.daysAllocated
        if (Array.isArray(parsedDays)) {
          assignedDays = parsedDays
        }
      } catch (e) {
        console.error('Failed to parse daysAllocated:', e)
      }
    } else if (weeklyRule?.days && weeklyRule.days.length > 0) {
      assignedDays = weeklyRule.days
    } else if (plan.task.scheduleRule === 'daily') {
      assignedDays = [0, 1, 2, 3, 4, 5, 6]
    } else if (plan.task.scheduleRule === 'school') {
      assignedDays = [0, 1, 3, 4]
    } else if (plan.task.scheduleRule === 'weekend') {
      assignedDays = [5, 6]
    } else {
      assignedDays = [0, 1, 2, 3, 4, 5, 6]
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
