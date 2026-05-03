import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const childRouter: Router = Router()

// All routes require authentication and child role
childRouter.use(authMiddleware, requireRole('child'))

// ============================================
// Child Routes
// ============================================

/**
 * GET /child/achievements - Get child's achievements
 */
childRouter.get('/achievements', async (req: AuthRequest, res: Response) => {
  const { userId: childId, familyId } = req.user!

  try {
    // Get all achievements
    const achievements = await prisma.achievement.findMany({
      where: { familyId },
      include: {
        logs: {
          where: { childId },
          select: { unlockedAt: true }
        }
      }
    })

    // Transform the data to match frontend expectations
    const transformedAchievements = achievements.map(achievement => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      unlocked: achievement.unlockedChildren.length > 0,
      unlockedAt: achievement.unlockedChildren[0]?.createdAt.toISOString(),
      progress: 0, // TODO: Calculate actual progress
      maxProgress: 1
    }))

    res.json(transformedAchievements)
  } catch (error: any) {
    throw new AppError(500, `获取成就失败: ${error.message}`)
  }
})

/**
 * GET /child/achievements/stats - Get child's achievement stats
 */
childRouter.get('/achievements/stats', async (req: AuthRequest, res: Response) => {
  const { userId: childId, familyId } = req.user!

  try {
    // Get total achievements
    const totalAchievements = await prisma.achievement.count({ where: { familyId } })
    
    // Get unlocked achievements
    const unlockedAchievements = await prisma.achievementLog.count({
      where: { childId }
    })

    // TODO: Calculate actual stats
    const stats = {
      streakDays: 0,
      totalStudyTime: 0,
      completionRate: 0,
      totalAchievements,
      unlockedAchievements
    }

    res.json(stats)
  } catch (error: any) {
    throw new AppError(500, `获取成就统计失败: ${error.message}`)
  }
})

/**
 * GET /child/books - Get child's books
 */
childRouter.get('/books', async (req: AuthRequest, res: Response) => {
  const { userId: childId, familyId } = req.user!

  try {
    const books = await prisma.book.findMany({
      where: {
        familyId,
        childId,
        status: 'active'
      },
      include: {
        readingLogs: {
          where: { childId },
          select: { pages: true }
        }
      }
    })

    // Transform the data to match frontend expectations
    const transformedBooks = books.map(book => {
      const readPages = book.readingLogs.reduce((sum, log) => sum + (log.pages || 0), 0)
      return {
        id: book.id,
        title: book.name,
        author: book.author,
        cover: book.coverUrl,
        totalPages: book.totalPages,
        readPages,
        category: book.type
      }
    })

    res.json(transformedBooks)
  } catch (error: any) {
    throw new AppError(500, `获取书籍失败: ${error.message}`)
  }
})

/**
 * POST /child/books/:id/read-log - Add reading log for a book
 */
childRouter.post('/books/:id/read-log', async (req: AuthRequest, res: Response) => {
  const bookId = parseInt(req.params.id)
  const { userId: childId, familyId } = req.user!
  const { pages, notes } = req.body

  if (!pages || pages <= 0) {
    throw new AppError(400, '请输入有效的页数')
  }

  try {
    // Verify book belongs to the child
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        familyId,
        childId,
        status: 'active'
      }
    })

    if (!book) {
      throw new AppError(404, '书籍不存在')
    }

    // Create reading log
    const log = await prisma.readingLog.create({
      data: {
        familyId,
        childId,
        bookId,
        pages,
        note: notes || '',
        readDate: new Date()
      }
    })

    // Update book read count
    await prisma.book.update({
      where: { id: bookId },
      data: { readCount: { increment: 1 } }
    })

    res.status(201).json({ message: '阅读记录添加成功' })
  } catch (error: any) {
    throw new AppError(500, `添加阅读记录失败: ${error.message}`)
  }
})
