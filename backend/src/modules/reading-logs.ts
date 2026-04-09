import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { env } from '../config/env'

export const readingRouter: Router = Router()

// All routes require authentication
readingRouter.use(authMiddleware)

/**
 * GET /books/:bookId/logs - Get all reading logs for a book
 */
readingRouter.get('/books/:bookId/logs', async (req: AuthRequest, res: Response) => {
  const bookId = parseInt(req.params.bookId as string)
  const { familyId, name } = req.user!

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock reading logs
    const mockLogs = [
      {
        id: 1,
        bookId: bookId,
        childId: 2,
        readDate: new Date().toISOString(),
        effect: '很好',
        performance: '孩子很喜欢，能够理解主要内容',
        note: '这是一本非常棒的书，推荐给所有孩子',
        readStage: '中班上',
        pages: 50,
        minutes: 30,
        startPage: 1,
        endPage: 50,
        evidenceUrl: '',
        child: {
          id: 2,
          name: '小明',
          avatar: '👶',
        },
      },
      {
        id: 2,
        bookId: bookId,
        childId: 2,
        readDate: new Date(Date.now() - 86400000).toISOString(),
        effect: '较好',
        performance: '孩子能够专注阅读',
        note: '继续加油！',
        readStage: '中班上',
        pages: 50,
        minutes: 25,
        startPage: 51,
        endPage: 100,
        evidenceUrl: '',
        child: {
          id: 2,
          name: '小明',
          avatar: '👶',
        },
      },
    ]

    res.json({
      status: 'success',
      data: mockLogs,
    })
    return
  }

  // Verify book belongs to family
  const book = await prisma.book.findFirst({
    where: { id: bookId, familyId }
  })

  if (!book) {
    throw new AppError(404, '书籍不存在')
  }

  const logs = await prisma.readingLog.findMany({
    where: { bookId, familyId },
    orderBy: { readDate: 'desc' },
    include: {
      child: { select: { id: true, name: true, avatar: true } }
    }
  })

  res.json({
    status: 'success',
    data: logs,
  })
})

/**
 * POST /books/:bookId/logs - Add a reading log
 */
readingRouter.post('/books/:bookId/logs', requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const bookId = parseInt(req.params.bookId as string)
  const { familyId, name } = req.user!
  const { childId, readDate, effect, performance, note, readStage, pages, minutes, startPage, endPage, evidenceUrl } = req.body

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock reading log
    const mockLog = {
      id: Math.floor(Math.random() * 10000),
      bookId: bookId,
      childId: childId || 2,
      readDate: new Date(readDate || Date.now()).toISOString(),
      effect: effect || '',
      performance: performance || '',
      note: note || '',
      readStage: readStage || '',
      pages: pages || 0,
      minutes: minutes || 0,
      startPage: startPage || 0,
      endPage: endPage || 0,
      evidenceUrl: evidenceUrl || '',
      child: {
        id: childId || 2,
        name: '小明',
        avatar: '👶',
      },
    }

    res.status(201).json({
      status: 'success',
      message: '阅读记录添加成功',
      data: mockLog,
    })
    return
  }

  // Verify book belongs to family
  const book = await prisma.book.findFirst({
    where: { id: bookId, familyId }
  })

  if (!book) {
    throw new AppError(404, '书籍不存在')
  }

  const log = await prisma.readingLog.create({
    data: {
      familyId,
      bookId,
      childId: childId || null,
      readDate: new Date(readDate || Date.now()),
      effect: effect || '',
      performance: performance || '',
      note: note || '',
      readStage: readStage || '',
      pages: pages || 0,
      minutes: minutes || 0,
      startPage: startPage || 0,
      endPage: endPage || 0,
      evidenceUrl: evidenceUrl || '',
    },
    include: {
      child: { select: { id: true, name: true, avatar: true } }
    }
  })

  // Update book read count
  await prisma.book.update({
    where: { id: bookId },
    data: { readCount: { increment: 1 } }
  })

  res.status(201).json({
    status: 'success',
    message: '阅读记录添加成功',
    data: log,
  })
})

/**
 * PUT /logs/:id - Update a reading log
 */
readingRouter.put('/logs/:id', requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const { readDate, effect, performance, note, readStage, pages, minutes, startPage, endPage, evidenceUrl } = req.body

  const log = await prisma.readingLog.findFirst({
    where: { id, familyId }
  })

  if (!log) {
    throw new AppError(404, '阅读记录不存在')
  }

  const updatedLog = await prisma.readingLog.update({
    where: { id },
    data: {
      readDate: readDate ? new Date(readDate) : undefined,
      effect,
      performance,
      note,
      readStage,
      pages,
      minutes,
      startPage,
      endPage,
      evidenceUrl,
    },
    include: {
      child: { select: { id: true, name: true, avatar: true } }
    }
  })

  res.json({
    status: 'success',
    message: '阅读记录更新成功',
    data: updatedLog,
  })
})

/**
 * DELETE /logs/:id - Delete a reading log
 */
readingRouter.delete('/logs/:id', requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!

  const log = await prisma.readingLog.findFirst({
    where: { id, familyId }
  })

  if (!log) {
    throw new AppError(404, '阅读记录不存在')
  }

  await prisma.readingLog.delete({ where: { id } })

  // Update book read count
  await prisma.book.update({
    where: { id: log.bookId },
    data: { readCount: { decrement: 1 } }
  })

  res.json({
    status: 'success',
    message: '阅读记录删除成功',
  })
})
