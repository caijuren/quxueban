import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { env } from '../config/env'

export const readingRouter: Router = Router()

// All routes require authentication and parent role
readingRouter.use(authMiddleware)
readingRouter.use(requireRole('parent'))

function parseLocalDateRange(startValue: unknown, endValue: unknown) {
  const parse = (value: unknown): Date | null => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null
    }

    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null
    }

    return date
  }

  const startDate = parse(startValue)
  const endDate = parse(endValue)

  if (!startDate || !endDate || startDate > endDate) {
    return null
  }

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  return { startDate, endDate }
}

const bookTypeLabels: Record<string, string> = {
  children: '儿童故事',
  tradition: '传统文化',
  science: '科普',
  character: '性格养成',
  other: '其他',
  fiction: '儿童故事',
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCurrentMonthRange() {
  const startDate = new Date()
  startDate.setDate(1)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date()
  endDate.setHours(23, 59, 59, 999)
  return { startDate, endDate }
}

function getCurrentWeekStart() {
  const date = new Date()
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function buildDailyBuckets(startDate: Date, endDate: Date) {
  const buckets: Array<{ date: string; records: number; minutes: number; pages: number; completionRate: number }> = []
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  const last = new Date(endDate)
  last.setHours(0, 0, 0, 0)

  while (cursor <= last) {
    buckets.push({ date: formatLocalDate(cursor), records: 0, minutes: 0, pages: 0, completionRate: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  return buckets
}

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
  const parsedPagesRead = Number(pagesRead)

  if (!Number.isFinite(parsedPagesRead) || parsedPagesRead < 1) {
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

    const newReadPages = mockActiveReading.readPages + parsedPagesRead
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

  const newReadPages = activeReading.readPages + parsedPagesRead
  const totalPages = activeReading.book.totalPages
  const isCompleted = totalPages > 0 && newReadPages >= totalPages

  // Create progress log
  await prisma.readingProgressLog.create({
    data: {
      familyId,
      childId: activeReading.childId,
      bookId: activeReading.bookId,
      activeReadingId: id,
      pagesRead: parsedPagesRead,
      totalReadPages: newReadPages,
      readDate: new Date(),
    },
  })

  await prisma.bookReadState.upsert({
    where: {
      childId_bookId: {
        childId: activeReading.childId,
        bookId: activeReading.bookId,
      },
    },
    update: {
      status: isCompleted ? 'finished' : 'reading',
      finishedAt: isCompleted ? new Date() : null,
    },
    create: {
      familyId,
      childId: activeReading.childId,
      bookId: activeReading.bookId,
      status: isCompleted ? 'finished' : 'reading',
      finishedAt: isCompleted ? new Date() : null,
    },
  })

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
  const requestedRange = parseLocalDateRange(req.query.startDate, req.query.endDate)
  const activeRange = requestedRange || getCurrentMonthRange()

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

  const childFilter = childId ? { childId } : {}

  const readingCount = await prisma.bookReadState.count({
    where: {
      familyId,
      status: 'reading',
      ...childFilter,
    },
  })

  const libraryBookCount = await prisma.book.count({
    where: { familyId, status: 'active' },
  })

  const thisWeek = getCurrentWeekStart()
  const weekReadCount = await prisma.readingLog.count({
    where: {
      familyId,
      ...childFilter,
      readDate: { gte: thisWeek },
    },
  })

  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)

  const monthReadCount = await prisma.readingLog.count({
    where: {
      familyId,
      ...childFilter,
      readDate: { gte: thisMonth },
    },
  })

  const rangeLogs = await prisma.readingLog.findMany({
    where: {
      familyId,
      ...childFilter,
      readDate: {
        gte: activeRange.startDate,
        lte: activeRange.endDate,
      },
    },
    include: {
      book: {
        select: { id: true, name: true, type: true, coverUrl: true, totalPages: true },
      },
    },
    orderBy: { readDate: 'asc' },
  })

  const finishedInRange = await prisma.bookReadState.count({
    where: {
      familyId,
      status: 'finished',
      ...childFilter,
      finishedAt: {
        gte: activeRange.startDate,
        lte: activeRange.endDate,
      },
    },
  })

  const dailyTrend = buildDailyBuckets(activeRange.startDate, activeRange.endDate)
  const dailyByDate = new Map(dailyTrend.map(item => [item.date, item]))
  const categoryMap = new Map<string, { label: string; records: number; minutes: number; pages: number }>()
  const bookMap = new Map<number, { id: number; name: string; records: number; minutes: number; pages: number; coverUrl: string }>()
  const readingDays = new Set<string>()
  let totalMinutes = 0
  let totalPages = 0
  let logsWithProgress = 0
  let logsWithReview = 0

  for (const log of rangeLogs) {
    const dateKey = formatLocalDate(log.readDate)
    readingDays.add(dateKey)
    const day = dailyByDate.get(dateKey)
    if (day) {
      day.records += 1
      day.minutes += log.minutes || 0
      day.pages += log.pages || 0
      day.completionRate = 100
    }

    totalMinutes += log.minutes || 0
    totalPages += log.pages || 0
    if ((log.endPage || 0) > 0 || (log.pages || 0) > 0) logsWithProgress += 1
    if ((log.note || '').trim() || (log.performance || '').trim()) logsWithReview += 1

    const typeKey = log.book?.type || 'other'
    const category = categoryMap.get(typeKey) || {
      label: bookTypeLabels[typeKey] || typeKey || '其他',
      records: 0,
      minutes: 0,
      pages: 0,
    }
    category.records += 1
    category.minutes += log.minutes || 0
    category.pages += log.pages || 0
    categoryMap.set(typeKey, category)

    const book = bookMap.get(log.bookId) || {
      id: log.bookId,
      name: log.book?.name || '未命名图书',
      coverUrl: log.book?.coverUrl || '',
      records: 0,
      minutes: 0,
      pages: 0,
    }
    book.records += 1
    book.minutes += log.minutes || 0
    book.pages += log.pages || 0
    bookMap.set(log.bookId, book)
  }

  const rangeReadCount = rangeLogs.length
  const categoryBase = totalMinutes > 0 ? totalMinutes : Math.max(rangeReadCount, 1)
  const categoryDistribution = Array.from(categoryMap.values())
    .sort((a, b) => (b.minutes || b.records) - (a.minutes || a.records))
    .map(item => ({
      ...item,
      percentage: Math.round((((totalMinutes > 0 ? item.minutes : item.records) || 0) / categoryBase) * 100),
    }))

  const topBooks = Array.from(bookMap.values())
    .sort((a, b) => {
      if (b.minutes !== a.minutes) return b.minutes - a.minutes
      if (b.pages !== a.pages) return b.pages - a.pages
      return b.records - a.records
    })
    .slice(0, 5)
    .map(book => ({
      ...book,
      scoreLabel: book.minutes > 0 ? `${book.minutes}分钟` : book.pages > 0 ? `${book.pages}页` : `${book.records}次`,
    }))

  const rangeDays = Math.max(1, dailyTrend.length)
  const radar = [
    { label: '持续度', value: clampScore((readingDays.size / rangeDays) * 100), note: '有阅读记录的天数 / 所选范围天数' },
    { label: '阅读投入', value: clampScore((totalMinutes / (rangeDays * 20)) * 100), note: '按每天20分钟作为阶段目标' },
    { label: '类型广度', value: clampScore((categoryMap.size / 5) * 100), note: '不同图书分类数 / 5类' },
    { label: '进度记录', value: clampScore(rangeReadCount ? ((logsWithProgress / rangeReadCount) * 85 + Math.min(finishedInRange * 15, 15)) : 0), note: '有页码或页数的记录占比，完成图书加权' },
    { label: '复盘质量', value: clampScore(rangeReadCount ? (logsWithReview / rangeReadCount) * 100 : 0), note: '有备注或表现记录的占比' },
  ]

  res.json({
    status: 'success',
    data: {
      readingCount,
      weekReadCount,
      monthReadCount,
      rangeReadCount,
      libraryBookCount,
      totalMinutes,
      totalPages,
      finishedInRange,
      dailyTrend,
      categoryDistribution,
      topBooks,
      radar,
      rules: {
        dailyTrend: '每天有1条以上阅读记录记为100%，否则为0%；记录数和时长按当天阅读记录汇总。',
        dailyMinutes: '按阅读记录 minutes 字段按天求和。',
        categoryDistribution: totalMinutes > 0 ? '按所选范围内各图书分类的阅读时长占比计算。' : '缺少阅读时长时，按阅读记录次数占比计算。',
        topBooks: '优先按所选范围阅读时长排序；时长相同按页数，再按记录次数。',
        radar: '持续度、阅读投入、类型广度、进度记录、复盘质量均由图书馆阅读记录实时计算。',
      },
    },
  })
})
