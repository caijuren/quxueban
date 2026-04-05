import { Router, Response } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const libraryRouter: Router = Router()

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() })

// All routes require authentication and parent role
libraryRouter.use(authMiddleware)
libraryRouter.use(requireRole('parent'))

/**
 * GET / - List all books in library (family collection)
 * Query: ?search=&type=
 */
libraryRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const search = req.query.search as string | undefined
  const type = req.query.type as string | undefined

  let whereClause: any = {
    familyId,
    status: 'active',
  }

  if (search) {
    whereClause.name = { contains: search, mode: 'insensitive' }
  }

  if (type && type !== 'all') {
    whereClause.type = type
  }

  const books = await prisma.book.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      activeReadings: {
        where: { status: 'reading' },
        select: { id: true, childId: true, readPages: true },
      },
    },
  })

  res.json({
    status: 'success',
    data: books,
  })
})

/**
 * POST / - Create a new book in library
 * Body: { name, author, type, coverUrl, totalPages }
 */
libraryRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { name, author, type, coverUrl, totalPages } = req.body

  if (!name) {
    throw new AppError(400, '书名不能为空')
  }

  const book = await prisma.book.create({
    data: {
      familyId,
      name,
      author: author || '',
      type: type || 'children',
      coverUrl: coverUrl || '',
      totalPages: totalPages || 0,
    },
  })

  res.status(201).json({
    status: 'success',
    message: '图书添加成功',
    data: book,
  })
})

/**
 * PUT /:id - Update book info
 */
libraryRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const { name, author, type, coverUrl, totalPages } = req.body

  const book = await prisma.book.findFirst({
    where: { id, familyId },
  })

  if (!book) {
    throw new AppError(404, '图书不存在')
  }

  const updatedBook = await prisma.book.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(author !== undefined && { author }),
      ...(type !== undefined && { type }),
      ...(coverUrl !== undefined && { coverUrl }),
      ...(totalPages !== undefined && { totalPages }),
    },
  })

  res.json({
    status: 'success',
    message: '图书更新成功',
    data: updatedBook,
  })
})

/**
 * GET /:id - Get book details with reading logs
 */
libraryRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!

  const book = await prisma.book.findFirst({
    where: { id, familyId, status: 'active' },
    include: {
      readingLogs: {
        orderBy: { readDate: 'desc' },
        include: {
          child: { select: { id: true, name: true, avatar: true } }
        }
      }
    }
  })

  if (!book) {
    throw new AppError(404, '图书不存在')
  }

  res.json({
    status: 'success',
    data: book,
  })
})

/**
 * DELETE /:id - Delete book
 */
libraryRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!

  const book = await prisma.book.findFirst({
    where: { id, familyId },
  })

  if (!book) {
    throw new AppError(404, '图书不存在')
  }

  await prisma.book.update({
    where: { id },
    data: { status: 'inactive' },
  })

  res.json({
    status: 'success',
    message: '图书已删除',
  })
})

/**
 * POST /:id/start - Start reading a book (add to reading management)
 * Body: { childId }
 */
libraryRouter.post('/:id/start', async (req: AuthRequest, res: Response) => {
  const bookId = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const { childId } = req.body

  if (!childId) {
    throw new AppError(400, '请选择孩子')
  }

  // Check book exists
  const book = await prisma.book.findFirst({
    where: { id: bookId, familyId },
  })

  if (!book) {
    throw new AppError(404, '图书不存在')
  }

  // Check child exists
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child', status: 'active' },
  })

  if (!child) {
    throw new AppError(404, '孩子不存在')
  }

  // Check if already reading
  const existing = await prisma.activeReading.findFirst({
    where: { bookId, childId, status: 'reading' },
  })

  if (existing) {
    throw new AppError(409, '该孩子已经在读这本书')
  }

  // Create active reading record
  const activeReading = await prisma.activeReading.create({
    data: {
      familyId,
      childId,
      bookId,
      readPages: 0,
      readCount: 0,
      status: 'reading',
    },
  })

  res.json({
    status: 'success',
    message: '已开始阅读',
    data: activeReading,
  })
})

/**
 * GET /stats - Get library statistics
 */
libraryRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  const totalBooks = await prisma.book.count({
    where: { familyId, status: 'active' },
  })

  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)

  const newThisMonth = await prisma.book.count({
    where: {
      familyId,
      status: 'active',
      createdAt: { gte: thisMonth },
    },
  })

  // Top read books
  const topBooks = await prisma.book.findMany({
    where: { familyId, status: 'active' },
    orderBy: { readCount: 'desc' },
    take: 5,
    select: { id: true, name: true, coverUrl: true, readCount: true },
  })

  res.json({
    status: 'success',
    data: {
      totalBooks,
      newThisMonth,
      topBooks,
    },
  })
})

/**
 * POST /import - Import books from Excel file
 */
libraryRouter.post('/import', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { familyId } = req.user!
    const file = req.file

    console.log(`[IMPORT] Starting import for family ${familyId}`)

    if (!file) {
      throw new AppError(400, '请上传文件')
    }

    console.log(`[IMPORT] File received: ${file.originalname}, size: ${file.size}`)

    // Parse Excel
    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`[IMPORT] Found ${data.length} rows in Excel`)

    // Type mapping - 新的图书类型映射
    const typeMap: Record<string, string> = {
      '儿童故事': 'children',
      '传统文化': 'tradition',
      '科普': 'science',
      '性格养成、其他': 'character',
    }

    let imported = 0
    let skipped = 0
    const batchSize = 100
    const booksToCreate: any[] = []

    for (const row of data as any[]) {
      const name = row['书名']
      if (!name) {
        skipped++
        continue
      }

      // Check if book already exists
      const existing = await prisma.book.findFirst({
        where: { familyId, name: String(name) }
      })

      if (existing) {
        skipped++
        continue
      }

      // Map type
      const excelType = row['类型'] || ''
      const bookType = typeMap[excelType] || 'children'

      booksToCreate.push({
        familyId,
        name: String(name),
        author: String(row['作者'] || ''),
        type: bookType,
        coverUrl: '',
        totalPages: 0,
      })

      // Batch insert
      if (booksToCreate.length >= batchSize) {
        await prisma.book.createMany({ data: booksToCreate, skipDuplicates: true })
        imported += booksToCreate.length
        booksToCreate.length = 0
        console.log(`[IMPORT] Batch inserted, total: ${imported}`)
      }
    }

    // Insert remaining books
    if (booksToCreate.length > 0) {
      await prisma.book.createMany({ data: booksToCreate, skipDuplicates: true })
      imported += booksToCreate.length
    }

    console.log(`[IMPORT] Completed: ${imported} imported, ${skipped} skipped`)

    res.json({
      status: 'success',
      message: `导入完成：成功 ${imported} 本，跳过 ${skipped} 本`,
      data: { imported, skipped },
    })
  } catch (error: any) {
    console.error('[IMPORT] Error:', error)
    throw new AppError(500, `导入失败: ${error.message}`)
  }
})
