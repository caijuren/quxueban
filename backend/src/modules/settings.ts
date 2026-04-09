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
