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
libraryRouter.get('/fetch-by-isbn/:isbn', authMiddleware, async (req: any, res: Response) => {
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
          const urlPath = new URL(coverUrl).pathname
          const fileExt = urlPath.split('.').pop() || 'jpg'
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
libraryRouter.get('/search-by-title/:title', authMiddleware, async (req: any, res: Response) => {
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
  let childId = req.query.childId as string | undefined
  
  // Handle case where childId is an array (duplicate parameters)
  if (Array.isArray(childId)) {
    childId = childId[0]
  }
  
  // Validate childId if provided
  const parsedChildId = childId ? parseInt(childId) : null
  if (childId && isNaN(parsedChildId)) {
    throw new AppError(400, 'Invalid childId: must be a number')
  }

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

  // 查询家庭中所有孩子的书籍（包括指定孩子的和没有指定孩子的）
  // 不限制 childId，让家庭中的所有书籍都可见

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
      bookReadStates: {
        select: { id: true, status: true, finishedAt: true },
      },
      readingLogs: {
        select: { pages: true, minutes: true },
      },
    },
  })

  // Transform books to match frontend expectations
  const transformedBooks = books.map(book => {
    // Calculate total read pages and minutes
    const totalReadPages = book.readingLogs.reduce((sum, log) => sum + (log.pages || 0), 0);
    const totalReadMinutes = book.readingLogs.reduce((sum, log) => sum + (log.minutes || 0), 0);
    
    return {
      ...book,
      readState: book.bookReadStates[0] || null,
      totalReadPages,
      totalReadMinutes,
      readLogCount: book.readingLogs.length,
    };
  });

  res.json({
    status: 'success',
    data: transformedBooks,
  })
})

/**
 * POST / - Create a new book in library
 * Body: { name, author, isbn, publisher, type, coverUrl, totalPages, wordCount, characterTag, suitableAge, childId }
 */
libraryRouter.post('/', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { name, author, isbn, publisher, type, coverUrl, totalPages, wordCount, characterTag, suitableAge, childId } = req.body

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

  const parsedBookChildId = childId ? parseInt(childId) : null

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
      ...(parsedBookChildId && { childId: parsedBookChildId }),
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
 * GET /stats - Get library statistics (must be before /:id)
 */
libraryRouter.get('/stats', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  let childId = req.query.childId as string | undefined
  
  // Handle case where childId is an array (duplicate parameters)
  if (Array.isArray(childId)) {
    childId = childId[0]
  }
  
  // Validate childId if provided
  const parsedChildId = childId ? parseInt(childId) : null
  if (childId && isNaN(parsedChildId)) {
    throw new AppError(400, 'Invalid childId: must be a number')
  }

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

  const bookWhere: any = { familyId, status: 'active' }
  if (parsedChildId) {
    bookWhere.childId = parsedChildId
  }

  const totalBooks = await prisma.book.count({
    where: bookWhere,
  })

  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)

  const newThisMonth = await prisma.book.count({
    where: {
      ...bookWhere,
      createdAt: { gte: thisMonth },
    },
  })

  // Top read books
  const topBooks = await prisma.book.findMany({
    where: bookWhere,
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
      activeReadings: {
        where: { status: 'reading' },
        select: { id: true, childId: true, readPages: true },
      },
      bookReadStates: {
        select: { id: true, status: true, finishedAt: true },
      },
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

  const totalReadPages = book.readingLogs.reduce((sum, log: any) => sum + (log.pages || 0), 0)
  const totalReadMinutes = book.readingLogs.reduce((sum, log: any) => sum + (log.minutes || 0), 0)
  const lastReadDate = book.readingLogs[0]?.readDate || null

  res.json({
    status: 'success',
    data: {
      ...book,
      readState: book.bookReadStates[0] || null,
      totalReadPages,
      totalReadMinutes,
      lastReadDate,
      readLogCount: book.readingLogs.length,
    },
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

  // Validate childId is a valid number
  const parsedChildId = parseInt(childId)
  if (isNaN(parsedChildId)) {
    throw new AppError(400, 'Invalid childId: must be a number')
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
    where: { id: parsedChildId, familyId, role: 'child', status: 'active' },
  })

  if (!child) {
    throw new AppError(404, '孩子不存在')
  }

  // Check if already reading
  const existing = await prisma.activeReading.findFirst({
    where: { bookId, childId: parsedChildId, status: 'reading' },
  })

  if (existing) {
    throw new AppError(409, '该孩子已经在读这本书')
  }

  // Create active reading record
  const activeReading = await prisma.activeReading.create({
    data: {
      familyId,
      childId: parsedChildId,
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
 * POST /:id/state - Update book reading state
 * Body: { childId, status, finishedAt }
 */
libraryRouter.post('/:id/state', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const bookId = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const { childId, status, finishedAt } = req.body

  if (!childId) {
    throw new AppError(400, '请选择孩子')
  }

  // Validate childId is a valid number
  const parsedChildId = parseInt(childId)
  if (isNaN(parsedChildId)) {
    throw new AppError(400, 'Invalid childId: must be a number')
  }

  if (!status) {
    throw new AppError(400, '请指定状态')
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
    where: { id: parsedChildId, familyId, role: 'child', status: 'active' },
  })

  if (!child) {
    throw new AppError(404, '孩子不存在')
  }

  // Handle mock mode
  if (!env.DATABASE_URL) {
    res.json({
      status: 'success',
      data: {
        id: 1,
        bookId,
        childId: parsedChildId,
        status,
        finishedAt: finishedAt || null,
        updatedAt: new Date().toISOString(),
      },
    })
    return
  }

  // Update or create reading state
  const existingState = await prisma.bookReadState.findFirst({
    where: { bookId, childId: parsedChildId },
  })

  let readingState
  if (existingState) {
    readingState = await prisma.bookReadState.update({
      where: { id: existingState.id },
      data: {
        status,
        finishedAt: status === 'finished' ? (finishedAt || new Date()) : null,
      },
    })
  } else {
    readingState = await prisma.bookReadState.create({
      data: {
        familyId,
        bookId,
        childId: parsedChildId,
        status,
        finishedAt: status === 'finished' ? (finishedAt || new Date()) : null,
      },
    })
  }

  res.json({
    status: 'success',
    data: readingState,
  })
})

/**
 * POST /batch/finish - Batch mark books as finished
 * Body: { childId, readStage, bookIds }
 */
libraryRouter.post('/batch/finish', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId, readStage, bookIds } = req.body

  if (!childId) {
    throw new AppError(400, '请选择孩子')
  }

  // Validate childId is a valid number
  const parsedChildId = parseInt(childId)
  if (isNaN(parsedChildId)) {
    throw new AppError(400, 'Invalid childId: must be a number')
  }

  // Check child exists
  const child = await prisma.user.findFirst({
    where: { id: parsedChildId, familyId, role: 'child', status: 'active' },
  })

  if (!child) {
    throw new AppError(404, '孩子不存在')
  }

  // Handle mock mode
  if (!env.DATABASE_URL) {
    res.json({
      status: 'success',
      data: {
        updated: bookIds?.length || 0,
      },
    })
    return
  }

  let updatedCount = 0

  // If bookIds are provided, update those specific books
  if (bookIds && Array.isArray(bookIds) && bookIds.length > 0) {
    for (const bookId of bookIds) {
      // Check book exists
      const book = await prisma.book.findFirst({
        where: { id: bookId, familyId },
      })

      if (book) {
          // Update or create reading state
          const existingState = await prisma.bookReadState.findFirst({
            where: { bookId, childId: parsedChildId },
          })

          if (existingState) {
            await prisma.bookReadState.update({
              where: { id: existingState.id },
              data: {
                status: 'finished',
                finishedAt: new Date(),
              },
            })
          } else {
            await prisma.bookReadState.create({
              data: {
                familyId,
                bookId,
                childId: parsedChildId,
                status: 'finished',
                finishedAt: new Date(),
              },
            })
          }
          updatedCount++
        }
    }
  }

  res.json({
    status: 'success',
    data: {
      updated: updatedCount,
    },
  })
})

/**
 * Download image from URL and upload to Supabase
 */
async function downloadAndUploadCover(imageUrl: string, bookName: string): Promise<string> {
  if (!imageUrl || !supabase || !env.SUPABASE_STORAGE_BUCKET) {
    return ''
  }

  try {
    console.log(`[COVER] Downloading cover for "${bookName}": ${imageUrl}`)
    
    // Download image with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
    
    const imageResponse = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    clearTimeout(timeoutId)
    
    if (!imageResponse.ok) {
      console.error(`[COVER] Failed to download: ${imageResponse.status}`)
      return ''
    }

    const imageBuffer = await imageResponse.buffer()
    
    // Validate image size (max 5MB)
    if (imageBuffer.length > 5 * 1024 * 1024) {
      console.error(`[COVER] Image too large: ${imageBuffer.length} bytes`)
      return ''
    }

    // Determine file extension
    const contentType = imageResponse.headers.get('content-type') || ''
    let fileExt = 'jpg'
    if (contentType.includes('png')) fileExt = 'png'
    else if (contentType.includes('gif')) fileExt = 'gif'
    else if (contentType.includes('webp')) fileExt = 'webp'
    
    // Generate unique filename
    const sanitizedName = bookName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 20)
    const fileName = `covers/import/${sanitizedName}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.${fileExt}`

    console.log(`[COVER] Uploading to Supabase: ${fileName}`)
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(fileName, imageBuffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType || `image/${fileExt}`
      })

    if (error) {
      console.error('[COVER] Supabase upload error:', error)
      return ''
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(fileName)
    
    if (urlData.publicUrl) {
      console.log(`[COVER] Success: ${urlData.publicUrl}`)
      return urlData.publicUrl
    }
    
    return ''
  } catch (error: any) {
    console.error(`[COVER] Error processing cover for "${bookName}":`, error.message)
    return ''
  }
}

/**
 * POST /import - Import books from Excel file
 */
libraryRouter.post('/import', authMiddleware, requireRole('parent'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { familyId, userId } = req.user!
    const file = req.file
    const { childId } = req.body

    console.log(`[IMPORT] Starting import for family ${familyId}, childId: ${childId || 'none'}`)

    if (!file) {
      throw new AppError(400, '请上传文件')
    }

    console.log(`[IMPORT] File received: ${file.originalname}, size: ${file.size}`)

    // Parse Excel
    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    
    // Get hyperlinks from the sheet
    const hyperlinks: Record<string, string> = {}
    console.log(`[IMPORT] Sheet keys:`, Object.keys(sheet))
    
    // xlsx library stores hyperlinks in sheet['!links'] or sheet['!data']
    const links = sheet['!links'] || sheet['!hyperlinks'] || sheet['!rels']?.hyperlinks
    if (links && Array.isArray(links)) {
      console.log(`[IMPORT] Found ${links.length} hyperlinks, first few:`, links.slice(0, 3))
      for (const link of links) {
        // Different versions of xlsx use different property names
        const cellRef = link.ref || link.r || link.cell
        const target = link.Target || link.target || link.t || link.hyperlink
        if (cellRef && target) {
          hyperlinks[cellRef] = target
          console.log(`[IMPORT] Hyperlink ${cellRef} -> ${target}`)
        }
      }
      console.log(`[IMPORT] Parsed ${Object.keys(hyperlinks).length} hyperlinks`)
    } else {
      console.log(`[IMPORT] No hyperlinks found in sheet`)
      // Debug: log the sheet structure
      console.log(`[IMPORT] Sheet !links:`, sheet['!links'])
      console.log(`[IMPORT] Sheet !hyperlinks:`, sheet['!hyperlinks'])
    }
    
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`[IMPORT] Found ${data.length} rows in Excel`)
    
    // Log first row to debug column names
    if (data.length > 0) {
      console.log(`[IMPORT] First row columns:`, Object.keys(data[0]))
      console.log(`[IMPORT] First row data:`, data[0])
    }

    // Type mapping - 新的图书类型映射
    const typeMap: Record<string, string> = {
      '儿童故事': 'children',
      '传统文化': 'tradition',
      '科普': 'science',
      '性格养成、其他': 'character',
    }

    let imported = 0
    let skipped = 0
    let coverSuccess = 0
    let coverFailed = 0
    const batchSize = 10 // Smaller batch for cover processing
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
      
      // Get cover URL from K column hyperlinks
      // Row index in Excel is i+2 (1-based, with header row)
      const excelRowNumber = i + 2
      const kCellAddress = `K${excelRowNumber}`
      let coverUrl = hyperlinks[kCellAddress] || ''
      
      // Fallback: try to get from cell value if no hyperlink
      if (!coverUrl) {
        const possibleCoverColumns = ['封面', '封面链接', '图片', '图片链接', 'cover', 'coverUrl']
        for (const col of possibleCoverColumns) {
          if (row[col] && String(row[col]).trim()) {
            const value = String(row[col]).trim()
            // Check if it's a URL
            if (value.startsWith('http://') || value.startsWith('https://')) {
              coverUrl = value
              break
            }
          }
        }
      }
      
      if (coverUrl) {
        console.log(`[IMPORT] Row ${excelRowNumber} cover URL: ${coverUrl}`)
      }

      // Download and upload cover if URL exists
      let finalCoverUrl = ''
      if (coverUrl && (coverUrl.startsWith('http://') || coverUrl.startsWith('https://'))) {
        finalCoverUrl = await downloadAndUploadCover(coverUrl, String(name))
        if (finalCoverUrl) {
          coverSuccess++
        } else {
          coverFailed++
        }
      }

      booksToCreate.push({
        familyId,
        childId: childId ? parseInt(childId) : null,
        name: String(name),
        author: String(row['作者'] || ''),
        type: bookType,
        coverUrl: finalCoverUrl,
        totalPages: parseInt(row['页数']) || 0,
        isbn: String(row['ISBN'] || ''),
        publisher: String(row['出版社'] || ''),
      })

      // Batch insert
      if (booksToCreate.length >= batchSize) {
        await prisma.book.createMany({ data: booksToCreate, skipDuplicates: true })
        imported += booksToCreate.length
        booksToCreate.length = 0
        console.log(`[IMPORT] Batch inserted, total: ${imported}, covers: ${coverSuccess} success, ${coverFailed} failed`)

        // 发送进度信息
        const progress = Math.round((i / totalRows) * 100)
        res.write(JSON.stringify({
          status: 'progress',
          data: {
            progress,
            imported,
            skipped,
            processed: i,
            coverSuccess,
            coverFailed
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

    console.log(`[IMPORT] Completed: ${imported} imported, ${skipped} skipped, ${coverSuccess} covers, ${coverFailed} failed`)

    // 发送完成信息
    res.write(JSON.stringify({
      status: 'success',
      message: `导入完成：成功 ${imported} 本，跳过 ${skipped} 本，封面 ${coverSuccess} 个`,
      data: { imported, skipped, coverSuccess, coverFailed },
    }) + '\n')

    res.end()
  } catch (error: any) {
    console.error('[IMPORT] Error:', error)
    // 如果响应头还没发送，发送错误响应
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'application/json'
      })
    }
    res.write(JSON.stringify({
      status: 'error',
      message: `导入失败: ${error.message}`
    }) + '\n')
    res.end()
  }
})

