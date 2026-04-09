import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const childrenRouter: Router = Router()

childrenRouter.use(authMiddleware)
childrenRouter.use(requireRole('parent'))

// 获取家庭下所有孩子列表
childrenRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  
  const children = await prisma.user.findMany({
    where: { 
      familyId,
      role: 'child',
      status: 'active'
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      status: true
    },
    orderBy: { id: 'asc' }
  })
  
  res.json({ status: 'success', data: children })
})

// 获取孩子的钉钉配置
childrenRouter.get('/:childId/dingtalk-config', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId } = req.params

  const child = await prisma.user.findFirst({
    where: { 
      id: parseInt(childId),
      familyId,
      role: 'child'
    },
    select: {
      id: true,
      name: true,
      dingtalkWebhookUrl: true,
      dingtalkSecret: true
    }
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  res.json({ 
    status: 'success', 
    data: {
      childId: child.id,
      childName: child.name,
      webhookUrl: child.dingtalkWebhookUrl,
      secret: child.dingtalkSecret
    } 
  })
})

// 更新孩子的钉钉配置
childrenRouter.put('/:childId/dingtalk-config', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId } = req.params
  const { webhookUrl, secret } = req.body

  if (!webhookUrl) {
    throw new AppError(400, 'Missing required field: webhookUrl')
  }

  const child = await prisma.user.findFirst({
    where: { 
      id: parseInt(childId),
      familyId,
      role: 'child'
    }
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  const updateData: any = {
    dingtalkWebhookUrl: webhookUrl
  }
  
  // Only update secret if provided
  if (secret !== undefined) {
    updateData.dingtalkSecret = secret
  }

  const updatedChild = await prisma.user.update({
    where: { id: parseInt(childId) },
    data: updateData,
    select: {
      id: true,
      name: true,
      dingtalkWebhookUrl: true,
      dingtalkSecret: true
    }
  })

  res.json({ 
    status: 'success', 
    data: {
      childId: updatedChild.id,
      childName: updatedChild.name,
      webhookUrl: updatedChild.dingtalkWebhookUrl,
      secret: updatedChild.dingtalkSecret
    } 
  })
})

export default childrenRouter
