import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import fetch from 'node-fetch'
import crypto from 'crypto'

export const settingsRouter: Router = Router()

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

  console.log('[GET SETTINGS] Family ID:', familyId)

  const family = await prisma.family.findUnique({
    where: { id: familyId },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  console.log('[GET SETTINGS] Family settings:', family.settings)

  res.json({
    status: 'success',
    data: {
      familyName: family.name,
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

  console.log('[PUT SETTINGS] Request:', { familyId, familyName, dailyTimeLimit })

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

  console.log('[PUT SETTINGS] Updated settings:', updatedFamily.settings)

  res.json({
    status: 'success',
    message: '设置已保存',
    data: updatedFamily,
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
    console.log('[Test Webhook] Sending to:', webhookUrl)
    console.log('[Test Webhook] With signature:', signedUrl !== webhookUrl)
    
    const requestBody = {
      msgtype: 'markdown',
      markdown: {
        title: '测试消息',
        text: '# 测试消息\n> 这是一条测试消息，用于验证钉钉机器人配置是否正确\n\n测试成功！✅',
      },
    }
    console.log('[Test Webhook] Request body:', JSON.stringify(requestBody))
    
    const response = await fetch(signedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    console.log('[Test Webhook] Response status:', response.status)
    console.log('[Test Webhook] Response body:', responseText)

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
    console.error('[Test Webhook] Error:', error)
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
    console.error('Delete family data error:', error)
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
    const filename = `quxueban_backup_${family.name}_${new Date().toISOString().split('T')[0]}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    res.json({
      status: 'success',
      data: exportData,
    })
  } catch (error: any) {
    console.error('Export data error:', error)
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
    console.error('Delete account error:', error)
    throw new AppError(500, `注销失败: ${error.message}`)
  }
})
