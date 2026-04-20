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
      id: parseInt(childId as string),
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
      id: parseInt(childId as string),
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
    where: { id: parseInt(childId as string) },
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

// 获取孩子的学习统计数据
childrenRouter.get('/:childId/stats', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId } = req.params

  // 验证孩子是否存在
  const child = await prisma.user.findFirst({
    where: { 
      id: parseInt(childId as string),
      familyId,
      role: 'child'
    }
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  // 计算本周开始和结束时间
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  // 获取本周打卡记录
  const weeklyCheckins = await prisma.dailyCheckin.findMany({
    where: {
      childId: parseInt(childId as string),
      checkDate: {
        gte: startOfWeek,
        lte: endOfWeek
      },
      status: 'completed'
    },
    select: {
      value: true,
      completedValue: true
    }
  })

  // 计算本周学习时间（分钟）
  const weeklyStudyMinutes = weeklyCheckins.reduce((sum, checkin) => {
    return sum + (checkin.completedValue || checkin.value || 0)
  }, 0)

  // 获取完成的任务数（本周打卡数）
  const completedTasks = weeklyCheckins.length

  // 获取成就数
  const achievements = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM achievement_logs WHERE child_id = ${parseInt(childId as string)}
  `.then((result: any) => Number(result[0]?.count ?? 0))

  // 获取今日学习时间
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const dailyCheckins = await prisma.dailyCheckin.findMany({
    where: {
      childId: parseInt(childId as string),
      checkDate: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: 'completed'
    },
    select: {
      value: true,
      completedValue: true
    }
  })

  // 计算今日学习时间（分钟）
  const dailyMinutes = dailyCheckins.reduce((sum, checkin) => {
    return sum + (checkin.completedValue || checkin.value || 0)
  }, 0)

  // 计算本周进度（示例：基于完成任务数）
  // 假设每周目标是20个任务
  const weeklyTarget = 20
  const weeklyProgress = Math.min(Math.round((completedTasks / weeklyTarget) * 100), 100)

  res.json({ 
    status: 'success', 
    data: {
      childId: child.id,
      childName: child.name,
      weeklyStudyTime: weeklyStudyMinutes,
      completedTasks,
      achievements,
      dailyMinutes: dailyMinutes,
      weeklyProgress
    } 
  })
})

export default childrenRouter
