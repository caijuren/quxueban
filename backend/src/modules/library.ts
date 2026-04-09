import { Router, Response } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import fetch, { Response as FetchResponse } from 'node-fetch'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { env } from '../config/env'
import { supabase } from '../config/supabase'

export const libraryRouter: Router = Router()

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() })

/**
 * GET /fetch-by-isbn/:isbn - Fetch book info by ISBN from Jisu API
 */
libraryRouter.get('/fetch-by-isbn/:isbn', async (req: any, res: Response) => {
  let { isbn } = req.params

  try {
    if (!env.JISU_API_KEY) {
      throw new Error('JISU_API_KEY is not configured')
    }

    // Clean ISBN: remove spaces and hyphens
    isbn = isbn.replace(/[\s-]/g, '')

    // Validate ISBN length
    if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
      throw new Error('Invalid ISBN format')
    }

    // Add timeout to fetch - 10 seconds
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      // Call Jisu API to get book info
      const response = await fetch(
        `https://api.jisuapi.com/isbn/query?appkey=${env.JISU_API_KEY}&isbn=${isbn}`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('Failed to fetch book info from Jisu API')
      }

      const searchData = await response.json() as any

      if (searchData.status !== 0 && searchData.status !== '0') {
        clearTimeout(timeoutId)
        res.json({
          status: 'success',
          data: null
        })
        return
      }

      const bookData = searchData.result

      let coverUrl = bookData.pic || ''

      // If cover image exists and Supabase is configured, download and store it
      if (coverUrl && supabase && env.SUPABASE_STORAGE_BUCKET) {
        try {
          // Download the image
          const imageResponse = await fetch(coverUrl)
          if (!imageResponse.ok) {
            throw new Error('Failed to download cover image')
          }

          const imageBuffer = await imageResponse.buffer()
          const fileExt = coverUrl.split('.').pop() || 'jpg'
          const fileName = `book-${isbn}-${Date.now()}.${fileExt}`

          // Upload to Supabase Storage
          const { data, error } = await supabase.storage
            .from(env.SUPABASE_STORAGE_BUCKET)
            .upload(fileName, imageBuffer, {
              cacheControl: '3600',
              upsert: false
            })

          if (error) {
            console.error('[Supabase Upload] Error:', error)
            // If upload fails, use the original URL as fallback
          } else if (data) {
            // Get the public URL
            const { data: urlData } = supabase.storage
              .from(env.SUPABASE_STORAGE_BUCKET)
              .getPublicUrl(fileName)
            
            if (urlData.publicUrl) {
              coverUrl = urlData.publicUrl
            }
          }
        } catch (imageError) {
          console.error('[Cover Image] Error:', imageError)
          // If image processing fails, use the original URL
        }
      }

      // Transform the data to match our Book model
      const transformedData = {
        name: bookData.title || '',
        author: bookData.author || '',
        isbn: bookData.isbn || '',
        publisher: bookData.publisher || '',
        coverUrl: coverUrl,
        totalPages: parseInt(bookData.page) || 0,
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
    
    // Handle specific Jisu API errors
    let errorMessage = 'ISBN查询失败'
    if (error.message) {
      errorMessage += `: ${error.message}`
    }
    
    // Handle different error statuses
    if (error.message.includes('APPKEY为空')) {
      errorMessage = 'API密钥未配置，请联系管理员'
    } else if (error.message.includes('APPKEY无效')) {
      errorMessage = 'API密钥无效，请联系管理员'
    } else if (error.message.includes('次数用完')) {
      errorMessage = 'API调用次数已用完，请联系管理员'
    } else if (error.message.includes('Invalid ISBN format')) {
      errorMessage = 'ISBN格式无效，请输入10位或13位ISBN'
    }
    
    res.status(500).json({
      status: 'error',
      message: errorMessage
    })
  }
})

/**
 * GET /search-by-title/:title - Search books by title from Google Books API
 */
libraryRouter.get('/search-by-title/:title', async (req: any, res: Response) => {
  const { title } = req.params

  try {
    // Add timeout to fetch - 5 seconds
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      // Call Google Books API to search books (keeping this as Jisu API doesn't support title search)
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

/**
 * GET / - List all books in library (family collection)
 * Query: ?search=&type=
 */
libraryRouter.get('/', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId, name } = req.user!
  const search = req.query.search as string | undefined
  const type = req.query.type as string | undefined

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock books
    const mockBooks = [
      {
        id: 1,
        familyId: familyId,
        name: '哈利·波特与魔法石',
        author: 'J.K.罗琳',
        isbn: '9787020002207',
        publisher: '人民文学出版社',
        type: 'children',
        coverUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=harry%20potter%20book%20cover&image_size=square',
        totalPages: 223,
        readCount: 3,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeReadings: [],
      },
      {
        id: 2,
        familyId: familyId,
        name: '小王子',
        author: '安托万·德·圣-埃克苏佩里',
        isbn: '9787544291179',
        publisher: '南海出版公司',
        type: 'children',
        coverUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=the%20little%20prince%20book%20cover&image_size=square',
        totalPages: 96,
        readCount: 2,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeReadings: [],
      },
    ]

    // Apply search and type filters
    let filteredBooks = mockBooks
    if (search) {
      filteredBooks = filteredBooks.filter(book => book.name.includes(search))
    }
    if (type && type !== 'all') {
      filteredBooks = filteredBooks.filter(book => book.type === type)
    }

    res.json({
      status: 'success',
      data: filteredBooks,
    })
    return
  }

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
 * Body: { name, author, isbn, publisher, type, coverUrl, totalPages, wordCount, characterTag, suitableAge }
 */
libraryRouter.post('/', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { name, author, isbn, publisher, type, coverUrl, totalPages, wordCount, characterTag, suitableAge } = req.body

  if (!name) {
    throw new AppError(400, '书名不能为空')
  }

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock book
    const mockBook = {
      id: Math.floor(Math.random() * 10000),
      familyId: familyId,
      name: name,
      author: author || '',
      isbn: isbn || '',
      publisher: publisher || '',
      type: type || 'children',
      coverUrl: coverUrl || '',
      totalPages: totalPages || 0,
      wordCount: wordCount || null,
      characterTag: characterTag || '',
      readCount: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    res.status(201).json({
      status: 'success',
      message: '图书添加成功',
      data: mockBook,
    })
    return
  }

  const book = await prisma.book.create({
    data: {
      familyId,
      name,
      author: author || '',
      isbn: isbn || '',
      publisher: publisher || '',
      type: type || 'children',
      coverUrl: coverUrl || '',
      totalPages: totalPages || 0,
      wordCount: wordCount || null,
      characterTag: characterTag || '',
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
libraryRouter.put('/:id', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const { name, author, isbn, publisher, type, coverUrl, totalPages, wordCount, characterTag, suitableAge } = req.body

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
      ...(isbn !== undefined && { isbn }),
      ...(publisher !== undefined && { publisher }),
      ...(type !== undefined && { type }),
      ...(coverUrl !== undefined && { coverUrl }),
      ...(totalPages !== undefined && { totalPages }),
      ...(wordCount !== undefined && { wordCount }),
      ...(characterTag !== undefined && { characterTag }),
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
libraryRouter.get('/:id', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId, name } = req.user!

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock book details
    const mockBook = {
      id: id,
      familyId: familyId,
      name: '哈利·波特与魔法石',
      author: 'J.K.罗琳',
      isbn: '9787020002207',
      publisher: '人民文学出版社',
      type: 'children',
      coverUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=harry%20potter%20book%20cover&image_size=square',
      totalPages: 223,
      readCount: 3,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      readingLogs: [
        {
          id: 1,
          bookId: id,
          childId: 2,
          readDate: new Date().toISOString(),
          effect: '很好',
          performance: '孩子很喜欢，能够理解主要内容',
          note: '这是一本非常棒的书，推荐给所有孩子',
          readStage: '中班上',
          startPage: 1,
          endPage: 50,
          evidenceUrl: '',
          child: {
            id: 2,
            name: `${name}的孩子1`,
            avatar: '👶',
          },
        },
        {
          id: 2,
          bookId: id,
          childId: 2,
          readDate: new Date(Date.now() - 86400000).toISOString(),
          effect: '较好',
          performance: '孩子能够专注阅读',
          note: '继续加油！',
          readStage: '中班上',
          startPage: 51,
          endPage: 100,
          evidenceUrl: '',
          child: {
            id: 2,
            name: `${name}的孩子1`,
            avatar: '👶',
          },
        },
      ],
    }

    res.json({
      status: 'success',
      data: mockBook,
    })
    return
  }

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
libraryRouter.delete('/:id', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
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
 * POST /upload-cover - Upload book cover image
 */
libraryRouter.post('/upload-cover', authMiddleware, requireRole('parent'), upload.single('cover'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      throw new AppError(400, '请选择要上传的图片')
    }

    if (!supabase || !env.SUPABASE_STORAGE_BUCKET) {
      throw new AppError(500, '存储服务未配置')
    }

    const fileExt = req.file.originalname.split('.').pop() || 'jpg'
    const fileName = `covers/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(fileName, req.file.buffer, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('[Supabase Upload] Error:', error)
      throw new AppError(500, '上传失败')
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(fileName)

    if (!urlData.publicUrl) {
      throw new AppError(500, '获取图片链接失败')
    }

    res.json({
      status: 'success',
      data: {
        coverUrl: urlData.publicUrl
      }
    })
  } catch (error: any) {
    console.error('[Cover Upload] Error:', error)
    res.status(error.status || 500).json({
      status: 'error',
      message: error.message || '上传失败'
    })
  }
})

/**
 * POST /:id/start - Start reading a book (add to reading management)
 * Body: { childId }
 */
libraryRouter.post('/:id/start', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
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
libraryRouter.get('/stats', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock statistics
    const mockStats = {
      totalBooks: 10,
      newThisMonth: 2,
      topBooks: [
        {
          id: 1,
          name: '哈利·波特与魔法石',
          coverUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=harry%20potter%20book%20cover&image_size=square',
          readCount: 3,
        },
        {
          id: 2,
          name: '小王子',
          coverUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=the%20little%20prince%20book%20cover&image_size=square',
          readCount: 2,
        },
      ],
    }

    res.json({
      status: 'success',
      data: mockStats,
    })
    return
  }

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
libraryRouter.post('/import', authMiddleware, requireRole('parent'), upload.single('file'), async (req: AuthRequest, res: Response) => {
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


