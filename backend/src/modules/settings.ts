import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import fetch from 'node-fetch'

export const settingsRouter: Router = Router()

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
 * Body: { webhook }
 */
settingsRouter.post('/test-webhook', async (req: AuthRequest, res: Response) => {
  const { webhook } = req.body

  if (!webhook) {
    throw new AppError(400, '请输入webhook地址')
  }

  // Test webhook by sending a test message
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: '测试消息',
          text: '# 测试消息\n> 这是一条测试消息，用于验证钉钉机器人配置是否正确\n\n测试成功！✅',
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`DingTalk API error: ${await response.text()}`)
    }

    res.json({
      status: 'success',
      message: '测试消息发送成功',
    })
  } catch (error: any) {
    console.error('Test webhook error:', error)
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
