import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import fetch from 'node-fetch'
import crypto from 'crypto'
import { createLogger } from '../config/logger'

const logger = createLogger('Settings')

export const settingsRouter: Router = Router()

type FamilySettings = Record<string, any>
type StoredGoal = {
  id?: string
  source?: string
  title: string
  description: string
  level: string
  abilityCategory: string
  abilityPoint: string
  linkedTasks: string[]
  linkedTaskIds: number[]
  reviewCadence: string
  progress: number
  target: string
  current: string
  suggestion: string
  status: 'on-track' | 'attention' | 'strong'
  reviewNotes?: Array<{
    id: string
    date: string
    summary: string
    adjustment: string
  }>
}

function normalizeGoalStatus(status: unknown): StoredGoal['status'] {
  return status === 'strong' || status === 'on-track' || status === 'attention' ? status : 'attention'
}

function normalizeStoredGoal(input: any): StoredGoal | null {
  if (!input || typeof input !== 'object') return null

  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 80) : ''
  if (!title) return null

  const linkedTasks = Array.isArray(input.linkedTasks)
    ? input.linkedTasks
        .filter((task: unknown) => typeof task === 'string')
        .map((task: string) => task.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 8)
    : []
  const linkedTaskIds = Array.isArray(input.linkedTaskIds)
    ? input.linkedTaskIds
        .map((id: unknown) => Number(id))
        .filter((id: number) => Number.isInteger(id) && id > 0)
        .slice(0, 50)
    : []
  const reviewNotes = Array.isArray(input.reviewNotes)
    ? input.reviewNotes
        .filter((note: unknown) => note && typeof note === 'object')
        .map((note: any) => ({
          id: typeof note.id === 'string' ? note.id.trim().slice(0, 80) : `review-${Date.now()}`,
          date: typeof note.date === 'string' ? note.date.trim().slice(0, 20) : new Date().toISOString().slice(0, 10),
          summary: typeof note.summary === 'string' ? note.summary.trim().slice(0, 500) : '',
          adjustment: typeof note.adjustment === 'string' ? note.adjustment.trim().slice(0, 500) : '',
        }))
        .filter((note: { summary: string; adjustment: string }) => note.summary || note.adjustment)
        .slice(0, 30)
    : []

  const progress = Number(input.progress)

  return {
    id: typeof input.id === 'string' ? input.id.trim().slice(0, 80) : undefined,
    source: input.source === 'ability-model' ? 'ability-model' : undefined,
    title,
    description: typeof input.description === 'string' ? input.description.trim().slice(0, 500) : '',
    level: typeof input.level === 'string' ? input.level.trim().slice(0, 40) : '',
    abilityCategory: typeof input.abilityCategory === 'string' ? input.abilityCategory.trim().slice(0, 40) : '',
    abilityPoint: typeof input.abilityPoint === 'string' ? input.abilityPoint.trim().slice(0, 80) : '',
    linkedTasks,
    linkedTaskIds,
    reviewCadence: typeof input.reviewCadence === 'string' ? input.reviewCadence.trim().slice(0, 40) : '每周复盘',
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0,
    target: typeof input.target === 'string' ? input.target.trim().slice(0, 80) : '',
    current: typeof input.current === 'string' ? input.current.trim().slice(0, 80) : '尚未开始',
    suggestion: typeof input.suggestion === 'string' ? input.suggestion.trim().slice(0, 300) : '',
    status: normalizeGoalStatus(input.status),
    reviewNotes,
  }
}

function getSettingsGoals(settings: FamilySettings, childId: number): StoredGoal[] {
  const goalsByChild = settings.goalsByChild || {}
  const goals = goalsByChild[String(childId)]
  return Array.isArray(goals) ? goals.map(normalizeStoredGoal).filter(Boolean) as StoredGoal[] : []
}

async function enrichGoalsWithProgress(goals: StoredGoal[], familyId: number, childId: number): Promise<StoredGoal[]> {
  const linkedTaskIds = Array.from(new Set(goals.flatMap((goal) => goal.linkedTaskIds || [])))
  if (linkedTaskIds.length === 0) return goals

  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  startDate.setDate(startDate.getDate() - 27)

  const checkins = await prisma.dailyCheckin.findMany({
    where: {
      familyId,
      childId,
      taskId: { in: linkedTaskIds },
      checkDate: { gte: startDate },
    },
    select: {
      taskId: true,
      status: true,
    },
  })

  const statsByTask = new Map<number, { planned: number; score: number }>()

  checkins.forEach((checkin) => {
    if (checkin.status === 'not_involved') return

    const current = statsByTask.get(checkin.taskId) || { planned: 0, score: 0 }
    current.planned += 1

    if (checkin.status === 'completed' || checkin.status === 'advance' || checkin.status === 'makeup') {
      current.score += 1
    } else if (checkin.status === 'partial') {
      current.score += 0.5
    }

    statsByTask.set(checkin.taskId, current)
  })

  return goals.map((goal) => {
    const taskIds = goal.linkedTaskIds || []
    if (taskIds.length === 0) return goal

    const summary = taskIds.reduce(
      (total, taskId) => {
        const stats = statsByTask.get(taskId)
        if (!stats) return total
        return {
          planned: total.planned + stats.planned,
          score: total.score + stats.score,
        }
      },
      { planned: 0, score: 0 }
    )

    const progress = summary.planned > 0 ? Math.round((summary.score / summary.planned) * 100) : 0
    const completedText = Number.isInteger(summary.score) ? String(summary.score) : summary.score.toFixed(1)

    return {
      ...goal,
      progress,
      current: summary.planned > 0 ? `近28天完成 ${completedText}/${summary.planned} 次` : '近28天暂无打卡',
      status: progress >= 80 ? 'strong' : progress >= 50 ? 'on-track' : 'attention',
    }
  })
}

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
settingsRouter.use(authMiddleware)
settingsRouter.use(requireRole('parent'))

/**
 * GET / - Get family settings
 */
settingsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!


  const family = await prisma.family.findUnique({
    where: { id: familyId },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }


  res.json({
    status: 'success',
    data: {
      familyName: family.name,
      familyCode: family.familyCode,
      memberCount: await prisma.user.count({
        where: {
          familyId,
          status: 'active',
        },
      }),
      settings: family.settings || {},
    },
  })
})

/**
 * PUT / - Update family settings
 * Body: { familyName, dingtalkWebhook, dailyTimeLimit }
 */
settingsRouter.put('/', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { familyName, dingtalkWebhook, dailyTimeLimit } = req.body


  if (!familyName) {
    throw new AppError(400, '请输入家庭名称')
  }

  // Get current family
  const family = await prisma.family.findUnique({
    where: { id: familyId },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  // Update family settings
  const updatedFamily = await prisma.family.update({
    where: { id: familyId },
    data: {
      name: familyName,
      settings: {
        ...(family.settings as any || {}),
        dingtalkWebhook: dingtalkWebhook || '',
        dailyTimeLimit: dailyTimeLimit || 210,
      },
    },
  })


  res.json({
    status: 'success',
    message: '设置已保存',
    data: updatedFamily,
  })
})

/**
 * GET /ability-model - Get family ability model
 */
settingsRouter.get('/ability-model', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const settings = (family.settings as any) || {}

  res.json({
    status: 'success',
    data: settings.abilityModel || null,
  })
})

/**
 * PUT /ability-model - Save family ability model
 */
settingsRouter.put('/ability-model', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { model } = req.body

  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    throw new AppError(400, '能力模型格式不正确')
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const currentSettings = (family.settings as any) || {}

  await prisma.family.update({
    where: { id: familyId },
    data: {
      settings: {
        ...currentSettings,
        abilityModel: model,
      },
    },
  })

  res.json({
    status: 'success',
    message: '能力模型已保存',
    data: model,
  })
})

/**
 * DELETE /ability-model - Reset family ability model
 */
settingsRouter.delete('/ability-model', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const currentSettings = (family.settings as any) || {}
  const { abilityModel, ...nextSettings } = currentSettings

  await prisma.family.update({
    where: { id: familyId },
    data: { settings: nextSettings },
  })

  res.json({
    status: 'success',
    message: '能力模型已恢复默认',
    data: null,
  })
})

/**
 * GET /goals - Get child goals stored in family settings
 */
settingsRouter.get('/goals', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = Number(req.query.childId)

  if (!Number.isInteger(childId) || childId <= 0) {
    throw new AppError(400, '请选择孩子')
  }

  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child' },
    select: { id: true },
  })

  if (!child) {
    throw new AppError(404, '孩子不存在')
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const settings = (family.settings as FamilySettings) || {}
  const goals = getSettingsGoals(settings, childId)
  const enrichedGoals = await enrichGoalsWithProgress(goals, familyId, childId)

  res.json({
    status: 'success',
    data: enrichedGoals,
  })
})

/**
 * PUT /goals - Save child goals stored in family settings
 */
settingsRouter.put('/goals', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = Number(req.body.childId)
  const { goals } = req.body

  if (!Number.isInteger(childId) || childId <= 0) {
    throw new AppError(400, '请选择孩子')
  }

  if (!Array.isArray(goals)) {
    throw new AppError(400, '目标格式不正确')
  }

  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child' },
    select: { id: true },
  })

  if (!child) {
    throw new AppError(404, '孩子不存在')
  }

  const normalizedGoals = goals
    .map(normalizeStoredGoal)
    .filter(Boolean)
    .slice(0, 50) as StoredGoal[]

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const currentSettings = (family.settings as FamilySettings) || {}
  const goalsByChild = currentSettings.goalsByChild || {}

  await prisma.family.update({
    where: { id: familyId },
    data: {
      settings: {
        ...currentSettings,
        goalsByChild: {
          ...goalsByChild,
          [String(childId)]: normalizedGoals,
        },
      },
    },
  })

  const enrichedGoals = await enrichGoalsWithProgress(normalizedGoals, familyId, childId)

  res.json({
    status: 'success',
    message: '目标已保存',
    data: enrichedGoals,
  })
})

/**
 * POST /test-webhook - Test DingTalk webhook
 * Body: { webhook } or { childId }
 */
settingsRouter.post('/test-webhook', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { webhook, childId } = req.body

  let webhookUrl = webhook
  let dingtalkSecret = ''

  // If childId is provided, get webhook from child's config
  if (childId && !webhook) {
    const child = await prisma.user.findFirst({
      where: { id: childId, familyId, role: 'child' },
    })

    if (!child) {
      throw new AppError(404, '孩子不存在')
    }

    webhookUrl = child.dingtalkWebhookUrl
    dingtalkSecret = child.dingtalkSecret || ''

    if (!webhookUrl) {
      throw new AppError(400, '该孩子尚未配置钉钉Webhook地址')
    }
  }

  if (!webhookUrl) {
    throw new AppError(400, '请输入webhook地址')
  }

  // Append signature if secret is available
  const signedUrl = appendSignatureToUrl(webhookUrl, dingtalkSecret)

  // Test webhook by sending a test message
  try {
    
    const requestBody = {
      msgtype: 'markdown',
      markdown: {
        title: '测试消息',
        text: '# 测试消息\n> 这是一条测试消息，用于验证钉钉机器人配置是否正确\n\n测试成功！✅',
      },
    }
    
    const response = await fetch(signedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

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
      message: '测试消息发送成功',
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Test webhook failed')
    throw new AppError(500, `测试失败: ${error.message}`)
  }
})

/**
 * DELETE /family-data - Delete all family data
 * WARNING: This is a destructive operation
 */
settingsRouter.delete('/family-data', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  try {
    // Start a transaction to delete all family data
    await prisma.$transaction(async (prisma) => {
      // Delete daily checkins
      await prisma.dailyCheckin.deleteMany({ where: { familyId } })

      // Delete weekly plans
      await prisma.weeklyPlan.deleteMany({ where: { familyId } })

      // Delete tasks
      await prisma.task.deleteMany({ where: { familyId } })

      // Delete reading logs
      await prisma.readingLog.deleteMany({ where: { familyId } })

      // Delete books
      await prisma.book.deleteMany({ where: { familyId } })

      // Delete children (but not the parent)
      await prisma.user.deleteMany({ where: { familyId, role: 'child' } })

      // Reset family settings
      await prisma.family.update({
        where: { id: familyId },
        data: {
          settings: {},
        },
      })
    })

    res.json({
      status: 'success',
      message: '数据已删除',
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Delete family data failed')
    throw new AppError(500, `删除失败: ${error.message}`)
  }
})

/**
 * GET /export - Export all family data
 * Returns a JSON file with all family data
 */
settingsRouter.get('/export', async (req: AuthRequest, res: Response) => {
  const { familyId, userId } = req.user!

  try {
    // Fetch all family data
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        name: true,
        familyCode: true,
        settings: true,
        createdAt: true,
      },
    })

    if (!family) {
      throw new AppError(404, '家庭不存在')
    }

    // Fetch children
    const children = await prisma.user.findMany({
      where: { familyId, role: 'child', status: 'active' },
      select: {
        id: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
    })

    // Fetch tasks
    const tasks = await prisma.task.findMany({
      where: { familyId, isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        type: true,
        timePerUnit: true,
        scheduleRule: true,
        tags: true,
        appliesTo: true,
        createdAt: true,
      },
    })

    // Fetch weekly plans
    const weeklyPlans = await prisma.weeklyPlan.findMany({
      where: { familyId },
      select: {
        id: true,
        childId: true,
        taskId: true,
        weekNo: true,
        target: true,
        progress: true,
        status: true,
        assignedDays: true,
        createdAt: true,
      },
    })

    // Fetch daily checkins
    const dailyCheckins = await prisma.dailyCheckin.findMany({
      where: { familyId },
      select: {
        id: true,
        childId: true,
        taskId: true,
        planId: true,
        status: true,
        value: true,
        completedValue: true,
        checkDate: true,
        notes: true,
        createdAt: true,
      },
    })

    // Fetch books
    const books = await prisma.book.findMany({
      where: { familyId, status: 'active' },
      select: {
        id: true,
        name: true,
        author: true,
        isbn: true,
        publisher: true,
        type: true,
        totalPages: true,
        wordCount: true,
        description: true,
        coverUrl: true,
        createdAt: true,
      },
    })

    // Fetch reading logs
    const readingLogs = await prisma.readingLog.findMany({
      where: { familyId },
      select: {
        id: true,
        childId: true,
        bookId: true,
        pages: true,
        minutes: true,
        readDate: true,
        effect: true,
        performance: true,
        note: true,
        readStage: true,
        focusRating: true,
        tags: true,
        startPage: true,
        endPage: true,
        createdAt: true,
      },
    })

    // Fetch achievements
    const achievements = await prisma.achievement.findMany({
      where: { familyId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        condition: true,
        createdAt: true,
      },
    })

    // Fetch achievement logs
    const achievementLogs = await prisma.achievementLog.findMany({
      where: { familyId },
      select: {
        id: true,
        childId: true,
        achievementId: true,
        unlockedAt: true,
      },
    })

    // Compile export data
    const exportData = {
      exportInfo: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        exportedBy: userId,
      },
      family,
      children,
      tasks,
      weeklyPlans,
      dailyCheckins,
      books,
      readingLogs,
      achievements,
      achievementLogs,
    }

    // Set headers for file download
    const filename = `quxueban_backup_${family.familyCode}_${new Date().toISOString().split('T')[0]}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    res.json({
      status: 'success',
      data: exportData,
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Export data failed')
    throw new AppError(500, `导出失败: ${error.message}`)
  }
})

/**
 * DELETE /account - Delete user account and all associated data
 * WARNING: This is a destructive operation that cannot be undone
 */
settingsRouter.delete('/account', async (req: AuthRequest, res: Response) => {
  const { familyId, userId } = req.user!

  try {
    // Check if user is the only parent in the family
    const parentCount = await prisma.user.count({
      where: { familyId, role: 'parent', status: 'active' },
    })

    const isOnlyParent = parentCount === 1

    await prisma.$transaction(async (prisma) => {
      if (isOnlyParent) {
        // If only parent, delete all family data
        // Delete in correct order to respect foreign keys

        // Delete achievement logs
        await prisma.achievementLog.deleteMany({ where: { familyId } })

        // Delete achievements
        await prisma.achievement.deleteMany({ where: { familyId } })

        // Delete reading progress logs
        await prisma.readingProgressLog.deleteMany({
          where: {
            activeReadingId: {
              in: (await prisma.activeReading.findMany({
                where: { familyId },
                select: { id: true },
              })).map(a => a.id),
            },
          },
        })

        // Delete active readings
        await prisma.activeReading.deleteMany({ where: { familyId } })

        // Delete book AI insights
        await prisma.bookAIInsight.deleteMany({ where: { familyId } })

        // Delete book read states
        await prisma.bookReadState.deleteMany({ where: { familyId } })

        // Delete reading logs
        await prisma.readingLog.deleteMany({ where: { familyId } })

        // Delete books
        await prisma.book.deleteMany({ where: { familyId } })

        // Delete daily checkins
        await prisma.dailyCheckin.deleteMany({ where: { familyId } })

        // Delete weekly plans
        await prisma.weeklyPlan.deleteMany({ where: { familyId } })

        // Delete child tasks
        await prisma.childTask.deleteMany({ where: { familyId } })

        // Delete tasks
        await prisma.task.deleteMany({ where: { familyId } })

        // Delete task templates
        await prisma.taskTemplate.deleteMany({ where: { familyId } })

        // Delete AI configs
        await prisma.userAIConfig.deleteMany({ where: { familyId } })

        // Delete all users in family
        await prisma.user.deleteMany({ where: { familyId } })

        // Delete family
        await prisma.family.delete({ where: { id: familyId } })
      } else {
        // If not the only parent, just delete this user
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'inactive' },
        })
      }
    })

    res.json({
      status: 'success',
      message: isOnlyParent
        ? '账户及所有数据已永久删除'
        : '账户已注销',
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Delete account failed')
    throw new AppError(500, `注销失败: ${error.message}`)
  }
})
