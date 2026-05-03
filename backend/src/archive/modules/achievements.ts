import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

interface AchievementInput {
  name: string
  description: string
  icon: string
  condition: string
}

export const achievementsRouter: Router = Router()

// ============================================
// Achievement Routes
// ============================================

/**
 * GET /achievements - Get all achievements
 * Auth required, parent only
 */
achievementsRouter.get('/', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  try {
    const achievements = await prisma.achievement.findMany({
      where: {
        familyId
      },
      include: {
        logs: {
          include: {
            child: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match frontend expectations
    const transformedAchievements = achievements.map(achievement => ({
      id: achievement.id.toString(),
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      condition: achievement.condition,
      isActive: achievement.isActive,
      unlockedChildren: achievement.unlockedChildren.map(unlock => ({
        id: unlock.child.id.toString(),
        name: unlock.child.name,
        avatar: unlock.child.avatar,
        unlockedAt: unlock.createdAt.toISOString()
      }))
    }))

    res.json(transformedAchievements)
  } catch (error: any) {
    throw new AppError(500, `获取成就列表失败: ${error.message}`)
  }
})

/**
 * POST /achievements - Create a new achievement
 * Auth required, parent only
 */
achievementsRouter.post('/', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { name, description, icon, condition } = req.body as AchievementInput

  if (!name || !description || !icon || !condition) {
    throw new AppError(400, '缺少必要参数')
  }

  try {
    const achievement = await prisma.achievement.create({
      data: {
        name,
        description,
        icon,
        condition,
        isActive: true,
        familyId
      }
    })

    res.status(201).json({
      id: achievement.id.toString(),
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      condition: achievement.condition,
      isActive: achievement.isActive
    })
  } catch (error: any) {
    throw new AppError(500, `创建成就失败: ${error.message}`)
  }
})

/**
 * PUT /achievements/:id - Update an achievement
 * Auth required, parent only
 */
achievementsRouter.put('/:id', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const achievementId = parseInt(req.params.id)
  const { name, description, icon, condition } = req.body as AchievementInput

  if (!name || !description || !icon || !condition) {
    throw new AppError(400, '缺少必要参数')
  }

  try {
    // Check if achievement exists and belongs to the family
    const existingAchievement = await prisma.achievement.findFirst({
      where: {
        id: achievementId,
        familyId
      }
    })

    if (!existingAchievement) {
      throw new AppError(404, '成就不存在')
    }

    const updatedAchievement = await prisma.achievement.update({
      where: {
        id: achievementId
      },
      data: {
        name,
        description,
        icon,
        condition
      }
    })

    res.json({
      id: updatedAchievement.id.toString(),
      name: updatedAchievement.name,
      description: updatedAchievement.description,
      icon: updatedAchievement.icon,
      condition: updatedAchievement.condition,
      isActive: updatedAchievement.isActive
    })
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error
    }
    throw new AppError(500, `更新成就失败: ${error.message}`)
  }
})

/**
 * DELETE /achievements/:id - Delete an achievement
 * Auth required, parent only
 */
achievementsRouter.delete('/:id', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const achievementId = parseInt(req.params.id)

  try {
    // Check if achievement exists and belongs to the family
    const existingAchievement = await prisma.achievement.findFirst({
      where: {
        id: achievementId,
        familyId
      }
    })

    if (!existingAchievement) {
      throw new AppError(404, '成就不存在')
    }

    // Delete associated unlock records
    await prisma.achievementLog.deleteMany({
      where: {
        achievementId
      }
    })

    // Delete the achievement
    await prisma.achievement.delete({
      where: {
        id: achievementId
      }
    })

    res.json({ message: '成就删除成功' })
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error
    }
    throw new AppError(500, `删除成就失败: ${error.message}`)
  }
})

/**
 * PATCH /achievements/:id/toggle - Toggle achievement active status
 * Auth required, parent only
 */
achievementsRouter.patch('/:id/toggle', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const achievementId = parseInt(req.params.id)
  const { isActive } = req.body

  if (isActive === undefined) {
    throw new AppError(400, '缺少isActive参数')
  }

  try {
    // Check if achievement exists and belongs to the family
    const existingAchievement = await prisma.achievement.findFirst({
      where: {
        id: achievementId,
        familyId
      }
    })

    if (!existingAchievement) {
      throw new AppError(404, '成就不存在')
    }

    const updatedAchievement = await prisma.achievement.update({
      where: {
        id: achievementId
      },
      data: {
        isActive
      }
    })

    res.json({
      id: updatedAchievement.id.toString(),
      name: updatedAchievement.name,
      description: updatedAchievement.description,
      icon: updatedAchievement.icon,
      condition: updatedAchievement.condition,
      isActive: updatedAchievement.isActive
    })
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error
    }
    throw new AppError(500, `更新成就状态失败: ${error.message}`)
  }
})
