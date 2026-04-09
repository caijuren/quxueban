import { Router, Response } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import fetch, { Response as FetchResponse } from 'node-fetch'
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
    const totalRows = data.length

    // 先获取所有已存在的书籍名称，减少数据库查询次数
    const existingBooks = await prisma.book.findMany({
      where: { familyId },
      select: { name: true }
    })
    const existingBookNames = new Set(existingBooks.map(book => book.name))
    console.log(`[IMPORT] Found ${existingBookNames.size} existing books`)

    // 启用分块响应
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    })

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const name = row['书名']
      if (!name) {
        skipped++
        continue
      }

      // Check if book already exists (using Set for faster lookup)
      if (existingBookNames.has(String(name))) {
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

        // 发送进度信息
        const progress = Math.round((i / totalRows) * 100)
        res.write(JSON.stringify({
          status: 'progress',
          data: {
            progress,
            imported,
            skipped,
            processed: i
          }
        }) + '\n')
        // 确保数据立即发送到前端
        if (res.flush) {
          res.flush()
        }
      }
    }

    // Insert remaining books
    if (booksToCreate.length > 0) {
      await prisma.book.createMany({ data: booksToCreate, skipDuplicates: true })
      imported += booksToCreate.length
    }

    console.log(`[IMPORT] Completed: ${imported} imported, ${skipped} skipped`)

    // 发送完成信息
    res.write(JSON.stringify({
      status: 'success',
      message: `导入完成：成功 ${imported} 本，跳过 ${skipped} 本`,
      data: { imported, skipped },
    }) + '\n')

    res.end()
  } catch (error: any) {
    console.error('[IMPORT] Error:', error)
    res.writeHead(500, {
      'Content-Type': 'application/json'
    })
    res.write(JSON.stringify({
      status: 'error',
      message: `导入失败: ${error.message}`
    }) + '\n')
    res.end()
  }
})

/**
 * GET /fetch-by-isbn/:isbn - Fetch book info by ISBN from Google Books API
 */
libraryRouter.get('/fetch-by-isbn/:isbn', async (req: AuthRequest, res: Response) => {
  const { isbn } = req.params

  try {
    // Add timeout to fetch - 5 seconds
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      // Call Google Books API to get book info
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&langRestrict=zh`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('Failed to fetch book info from Google Books')
      }

      const searchData = await response.json() as any
      const bookData = searchData.items?.[0]?.volumeInfo

      if (!bookData) {
        throw new Error('Book not found')
      }

      // Transform the data to match our Book model
      const transformedData = {
        name: bookData.title || '',
        author: bookData.authors?.join(', ') || '',
        coverUrl: bookData.imageLinks?.thumbnail || bookData.imageLinks?.smallThumbnail || '',
        totalPages: bookData.pageCount || 0,
      }

      res.json({
        status: 'success',
        data: transformedData,
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      throw fetchError
    }
  } catch (error: any) {
    console.error('[ISBN Fetch] Error:', error)
    throw new AppError(500, `ISBN查询失败: ${error.message}`)
  }
})

/**
 * GET /search-by-title/:title - Search books by title from Google Books API
 */
libraryRouter.get('/search-by-title/:title', async (req: AuthRequest, res: Response) => {
  const { title } = req.params

  try {
    // Add timeout to fetch - 5 seconds
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      // Call Google Books API to search books
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title as string)}&maxResults=10&langRestrict=zh`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('Failed to search books from Google Books')
      }

      const searchData = await response.json() as any

      // Transform the data to match our expected format
      const transformedResults = (searchData.items || []).map((item: any) => {
        const book = item.volumeInfo || {}
        return {
          name: book.title || '',
          author: book.authors?.join(', ') || '',
          coverUrl: book.imageLinks?.thumbnail || book.imageLinks?.smallThumbnail || '',
          totalPages: book.pageCount || 0,
        }
      })

      res.json({
        status: 'success',
        data: transformedResults,
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      // If timeout or network error, return empty results with warning
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('network')) {
        console.warn('[Title Search] Network timeout or error, returning empty results')
        res.json({
          status: 'success',
          data: [],
          message: '网络连接较慢，请稍后重试或手动输入'
        })
      } else {
        throw fetchError
      }
    }
  } catch (error: any) {
    console.error('[Title Search] Error:', error)
    // Return empty results instead of error to allow manual input
    res.json({
      status: 'success',
      data: [],
      message: '搜索服务暂时不可用，请手动输入'
    })
  }
})
