import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { env } from '../config/env'

export const readingRouter: Router = Router()

// All routes require authentication and parent role
readingRouter.use(authMiddleware)
readingRouter.use(requireRole('parent'))

/**
 * GET / - List all active readings (currently reading books)
 * Query: ?childId=
 */
readingRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { familyId, name } = req.user!
  const childId = req.query.childId ? parseInt(req.query.childId as string) : undefined

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock active readings
    const mockActiveReadings = [
      {
        id: 1,
        familyId: familyId,
        childId: 2,
        bookId: 1,
        readPages: 100,
        readCount: 2,
        status: 'reading',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        book: {
          id: 1,
          name: '哈利·波特与魔法石',
          author: 'J.K.罗琳',
          coverUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=harry%20potter%20book%20cover&image_size=square',
          totalPages: 223,
        },
        child: {
          id: 2,
          name: '小明',
          avatar: '👶',
        },
      },
    ]

    // Apply childId filter
    let filteredReadings = mockActiveReadings
    if (childId) {
      filteredReadings = filteredReadings.filter(reading => reading.childId === childId)
    }

    res.json({
      status: 'success',
      data: filteredReadings,
    })
    return
  }

  let whereClause: any = {
    familyId,
    status: 'reading',
  }

  if (childId) {
    whereClause.childId = childId
  }

  const activeReadings = await prisma.activeReading.findMany({
    where: whereClause,
    include: {
      book: true,
      child: {
        select: { id: true, name: true, avatar: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  res.json({
    status: 'success',
    data: activeReadings,
  })
})

/**
 * POST /:id/progress - Update reading progress
 * Body: { pagesRead }
 */
readingRouter.post('/:id/progress', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const { pagesRead } = req.body

  if (!pagesRead || pagesRead < 1) {
    throw new AppError(400, '请填写本次阅读的页数')
  }

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock progress update
    const mockActiveReading = {
      id: id,
      readPages: 100,
      childId: 2,
      bookId: 1,
      book: {
        totalPages: 223,
      },
    }

    const newReadPages = mockActiveReading.readPages + pagesRead
    const totalPages = mockActiveReading.book.totalPages

    // Check if book is completed
    const isCompleted = totalPages > 0 && newReadPages >= totalPages

    if (isCompleted) {
      res.json({
        status: 'success',
        message: '恭喜！这本书已读完，AI分析正在生成中',
        data: { completed: true },
      })
    } else {
      res.json({
        status: 'success',
        message: '阅读进度已更新',
        data: {
          completed: false,
          readPages: newReadPages,
          totalPages,
          progress: Math.round((newReadPages / totalPages) * 100),
        },
      })
    }
    return
  }

  const activeReading = await prisma.activeReading.findFirst({
    where: { id, familyId, status: 'reading' },
    include: { book: true },
  })

  if (!activeReading) {
    throw new AppError(404, '阅读记录不存在')
  }

  const newReadPages = activeReading.readPages + pagesRead
  const totalPages = activeReading.book.totalPages

  // Create progress log
  await prisma.readingProgressLog.create({
    data: {
      familyId,
      childId: activeReading.childId,
      bookId: activeReading.bookId,
      activeReadingId: id,
      pagesRead,
      totalReadPages: newReadPages,
      readDate: new Date(),
    },
  })

  // Check if book is completed
  const isCompleted = totalPages > 0 && newReadPages >= totalPages

  if (isCompleted) {
    // Update active reading as completed
    await prisma.activeReading.update({
      where: { id },
      data: {
        readPages: totalPages,
        readCount: { increment: 1 },
        status: 'completed',
        completedAt: new Date(),
      },
    })

    // Update book read count
    await prisma.book.update({
      where: { id: activeReading.bookId },
      data: { readCount: { increment: 1 } },
    })

    // Create AI insight record for completed book
    await prisma.bookAIInsight.create({
      data: {
        familyId,
        bookId: activeReading.bookId,
        childId: activeReading.childId,
        status: 'pending',
      },
    })

    res.json({
      status: 'success',
      message: '恭喜！这本书已读完，AI分析正在生成中',
      data: { completed: true },
    })
  } else {
    // Update progress
    await prisma.activeReading.update({
      where: { id },
      data: {
        readPages: newReadPages,
        readCount: { increment: 1 },
      },
    })

    res.json({
      status: 'success',
      message: '阅读进度已更新',
      data: {
        completed: false,
        readPages: newReadPages,
        totalPages,
        progress: Math.round((newReadPages / totalPages) * 100),
      },
    })
  }
})

/**
 * DELETE /:id - Stop reading (return to library without completing)
 */
readingRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!

  const activeReading = await prisma.activeReading.findFirst({
    where: { id, familyId, status: 'reading' },
  })

  if (!activeReading) {
    throw new AppError(404, '阅读记录不存在')
  }

  await prisma.activeReading.delete({
    where: { id },
  })

  res.json({
    status: 'success',
    message: '已停止阅读',
  })
})

/**
 * GET /stats - Get reading statistics
 */
readingRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = req.query.childId ? parseInt(req.query.childId as string) : undefined

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock statistics
    const mockStats = {
      readingCount: 2,
      weekReadCount: 5,
      monthReadCount: 15,
    }

    res.json({
      status: 'success',
      data: mockStats,
    })
    return
  }

  let whereClause: any = { familyId, status: 'reading' }
  if (childId) {
    whereClause.childId = childId
  }

  // Currently reading count
  const readingCount = await prisma.activeReading.count({
    where: whereClause,
  })

  // This week reading count
  const thisWeek = new Date()
  thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay())
  thisWeek.setHours(0, 0, 0, 0)

  const weekProgressLogs = await prisma.readingProgressLog.findMany({
    where: {
      familyId,
      ...(childId && { childId }),
      readDate: { gte: thisWeek },
    },
  })

  const weekReadCount = weekProgressLogs.length

  // This month reading count
  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)

  const monthProgressLogs = await prisma.readingProgressLog.findMany({
    where: {
      familyId,
      ...(childId && { childId }),
      readDate: { gte: thisMonth },
    },
  })

  const monthReadCount = monthProgressLogs.length

  res.json({
    status: 'success',
    data: {
      readingCount,
      weekReadCount,
      monthReadCount,
    },
  })
})
