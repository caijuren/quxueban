import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const readingRouter: Router = Router()

// All routes require authentication
readingRouter.use(authMiddleware)

/**
 * GET /books/:bookId/logs - Get all reading logs for a book
 */
readingRouter.get('/books/:bookId/logs', async (req: AuthRequest, res: Response) => {
  const bookId = parseInt(req.params.bookId as string)
  const { familyId } = req.user!

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
  const { familyId } = req.user!
  const { childId, readDate, effect, performance, note, readStage, pages, minutes } = req.body

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
  const { readDate, effect, performance, note, readStage, pages, minutes } = req.body

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
