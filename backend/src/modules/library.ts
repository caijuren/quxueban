import { Router, Response } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import fetch, { Response as FetchResponse } from 'node-fetch'
import fs from 'fs/promises'
import path from 'path'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { env } from '../config/env'
import { supabase } from '../config/supabase'

export const libraryRouter: Router = Router()

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() })

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org'
const LOCAL_COVER_DIR = path.resolve(process.cwd(), 'uploads/book-covers')

async function saveCoverLocally(buffer: Buffer, fileExt = 'jpg'): Promise<string> {
  await fs.mkdir(LOCAL_COVER_DIR, { recursive: true })
  const safeExt = fileExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`
  const filePath = path.join(LOCAL_COVER_DIR, fileName)
  await fs.writeFile(filePath, buffer)
  return `${env.API_PREFIX}/uploads/book-covers/${fileName}`
}

async function storeCoverBuffer(buffer: Buffer, fileExt: string, contentType?: string): Promise<string> {
  if (supabase && env.SUPABASE_STORAGE_BUCKET) {
    const fileName = `covers/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
    const { error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(fileName, buffer, {
        cacheControl: '3600',
        upsert: false,
        ...(contentType ? { contentType } : {}),
      })

    if (!error) {
      const { data: urlData } = supabase.storage
        .from(env.SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(fileName)
      if (urlData.publicUrl) return urlData.publicUrl
    }

    console.error('[Cover Storage] Supabase upload failed, falling back to local:', error)
  }

  return saveCoverLocally(buffer, fileExt)
}

function cleanIsbn(isbn: string): string {
  return String(isbn || '').replace(/[\s-]/g, '')
}

function normalizeBookName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/[《》<>]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function normalizeText(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[《》<>]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function normalizeYear(value: unknown): string {
  const match = String(value || '').match(/\d{4}/)
  return match ? match[0] : ''
}

function firstText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ')
  }
  return value ? String(value) : ''
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = parseInt(String(value || ''), 10)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return 0
}

function pickRowValue(row: any, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }
  return ''
}

function parseExcelDate(value: unknown): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d)
  }
  const parsedDate = new Date(String(value))
  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate
}

function buildOpenLibraryCoverUrl(doc: any, isbn?: string): string {
  if (doc?.cover_i) {
    return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
  }
  const cleanedIsbn = cleanIsbn(isbn || doc?.isbn?.[0] || '')
  return cleanedIsbn ? `https://covers.openlibrary.org/b/isbn/${cleanedIsbn}-L.jpg?default=false` : ''
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 3500): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'quxueban/1.0 (book metadata lookup)' },
    })
    if (!response.ok) {
      throw new Error(`OpenLibrary request failed: ${response.status}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

function transformOpenLibraryDoc(doc: any, fallbackIsbn = '') {
  const isbn = cleanIsbn(fallbackIsbn || doc?.isbn?.[0] || '')
  return {
    name: doc?.title || '',
    author: firstText(doc?.author_name),
    isbn,
    publisher: firstText(doc?.publisher),
    coverUrl: buildOpenLibraryCoverUrl(doc, isbn),
    totalPages: firstNumber(doc?.number_of_pages_median, doc?.number_of_pages, doc?.edition_count),
    publishYear: doc?.first_publish_year || null,
  }
}

interface BookMatchInput {
  name: string;
  isbn?: string | null;
  author?: string | null;
  publisher?: string | null;
  publishYear?: string | number | null;
}

function scoreBookCandidate(candidate: any, input: BookMatchInput): number {
  const candidateName = normalizeBookName(candidate.name || candidate.title || '')
  const inputName = normalizeBookName(input.name || '')
  if (!candidateName || !inputName) return -1

  let score = 0
  if (candidateName === inputName) score += 80
  else if (candidateName.includes(inputName) || inputName.includes(candidateName)) score += 45
  else return -1

  const inputAuthor = normalizeText(input.author || '')
  const candidateAuthor = normalizeText(candidate.author || '')
  if (inputAuthor && candidateAuthor) {
    score += candidateAuthor.includes(inputAuthor) || inputAuthor.includes(candidateAuthor) ? 25 : -20
  }

  const inputPublisher = normalizeText(input.publisher || '')
  const candidatePublisher = normalizeText(candidate.publisher || '')
  if (inputPublisher && candidatePublisher) {
    score += candidatePublisher.includes(inputPublisher) || inputPublisher.includes(candidatePublisher) ? 15 : -8
  }

  const inputYear = normalizeYear(input.publishYear)
  const candidateYear = normalizeYear(candidate.publishYear)
  if (inputYear && candidateYear) {
    score += inputYear === candidateYear ? 10 : -5
  }

  if (candidate.coverUrl) score += 5
  return score
}

function rankBookCandidates(candidates: any[], input: BookMatchInput) {
  return candidates
    .map(candidate => ({ candidate, score: scoreBookCandidate(candidate, input) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(item => ({ ...item.candidate, matchScore: item.score }))
}

function buildOpenLibraryQuery(input: BookMatchInput): string {
  const params = new URLSearchParams()
  params.set('title', input.name)
  if (input.author) params.set('author', input.author)
  if (input.publisher) params.set('publisher', input.publisher)
  return params.toString()
}

async function searchOpenLibraryByIsbn(isbn: string) {
  const cleanedIsbn = cleanIsbn(isbn)
  if (!cleanedIsbn || (cleanedIsbn.length !== 10 && cleanedIsbn.length !== 13)) return null
  const data = await fetchJsonWithTimeout(`${OPEN_LIBRARY_BASE_URL}/search.json?isbn=${encodeURIComponent(cleanedIsbn)}&limit=1`)
  const doc = data?.docs?.[0]
  return doc ? transformOpenLibraryDoc(doc, cleanedIsbn) : null
}

async function searchOpenLibraryByTitle(title: string, limit = 10) {
  const data = await fetchJsonWithTimeout(`${OPEN_LIBRARY_BASE_URL}/search.json?title=${encodeURIComponent(title)}&limit=${limit}`)
  return (data?.docs || []).map((doc: any) => transformOpenLibraryDoc(doc)).filter((book: any) => book.name)
}

async function searchOpenLibraryByMatch(input: BookMatchInput, limit = 10) {
  const query = buildOpenLibraryQuery(input)
  const data = await fetchJsonWithTimeout(`${OPEN_LIBRARY_BASE_URL}/search.json?${query}&limit=${limit}`)
  const candidates = (data?.docs || []).map((doc: any) => transformOpenLibraryDoc(doc)).filter((book: any) => book.name)
  return rankBookCandidates(candidates, input)
}

async function findOpenLibraryBook(book: BookMatchInput) {
  if (book.isbn) {
    const byIsbn = await searchOpenLibraryByIsbn(book.isbn)
    if (byIsbn) return byIsbn
  }
  const byMatch = await searchOpenLibraryByMatch(book, 5)
  return byMatch[0] || null
}

function transformLocalBook(book: any) {
  return {
    id: book.id,
    name: book.name || '',
    author: book.author || '',
    isbn: book.isbn || '',
    publisher: book.publisher || '',
    coverUrl: book.coverUrl || '',
    totalPages: book.totalPages || 0,
    source: 'local',
  }
}

async function findLocalBookByIsbn(familyId: number, isbn: string) {
  const cleanedIsbn = cleanIsbn(isbn)
  if (!cleanedIsbn) return null

  const books = await prisma.book.findMany({
    where: { familyId, status: 'active', isbn: { not: '' } },
    select: { id: true, name: true, author: true, isbn: true, publisher: true, coverUrl: true, totalPages: true },
    take: 2000,
  })

  const book = books.find(item => cleanIsbn(item.isbn) === cleanedIsbn)
  return book ? transformLocalBook(book) : null
}

async function findLocalBooksByMatch(familyId: number, input: BookMatchInput, limit = 10) {
  const normalizedTitle = normalizeBookName(input.name)
  if (!normalizedTitle) return []

  const books = await prisma.book.findMany({
    where: {
      familyId,
      status: 'active',
      name: { contains: input.name.trim(), mode: 'insensitive' },
    },
    select: { id: true, name: true, author: true, isbn: true, publisher: true, coverUrl: true, totalPages: true },
    take: Math.max(limit, 20),
  })

  return rankBookCandidates(books.map(transformLocalBook), input)
    .slice(0, limit)
}

async function persistRemoteCover(bookData: any, source: string) {
  if (!bookData?.coverUrl) return { ...bookData, source }

  const storedCoverUrl = await downloadAndUploadCover(bookData.coverUrl, bookData.name || bookData.isbn || 'book')
  return {
    ...bookData,
    coverUrl: storedCoverUrl || bookData.coverUrl,
    source,
    coverStored: Boolean(storedCoverUrl),
  }
}

async function updateLocalBookCoverIfMissing(bookId: number | undefined, coverUrl: string) {
  if (!bookId || !coverUrl) return

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { coverUrl: true },
  })

  if (!book || book.coverUrl) return

  await prisma.book.update({
    where: { id: bookId },
    data: { coverUrl },
  })
}

function buildReadingLogFromImportRow(row: any, familyId: number, bookId: number, childId?: number | null) {
  const startPage = firstNumber(pickRowValue(row, ['开始页', '起始页', 'startPage']))
  const explicitEndPage = firstNumber(pickRowValue(row, ['结束页', '截止页', 'endPage']))
  const pages = firstNumber(pickRowValue(row, ['阅读页数', '页数', 'pages']))
  const totalPages = firstNumber(pickRowValue(row, ['总页数', '图书页数', '页数']))
  const readCount = firstNumber(pickRowValue(row, ['阅读次数', '次数', 'readCount']))
  const endPage = explicitEndPage || (startPage && pages ? startPage + pages - 1 : 0)
  const minutes = firstNumber(pickRowValue(row, ['阅读时长', '时长', '分钟', 'minutes']))
  const note = pickRowValue(row, ['备注', '心得', '内容', '阅读内容', 'note'])
  const performance = pickRowValue(row, ['孩子表现', '表现', 'performance'])
  const effect = pickRowValue(row, ['阅读效果', '效果', 'effect'])
  const readStage = pickRowValue(row, ['阅读阶段', '阶段', 'readStage'])
  const evidenceUrl = pickRowValue(row, ['证据链接', '照片', '图片', 'evidenceUrl'])
  const importedReadDate = pickRowValue(row, ['最近一次阅读时间', '最后阅读时间', '阅读日期', '日期', 'readDate'])

  if (!startPage && !endPage && !pages && !minutes && !note && !performance && !effect && !readStage && !importedReadDate && !readCount) {
    return null
  }

  return {
    familyId,
    childId: childId || null,
    bookId,
    readDate: parseExcelDate(importedReadDate),
    startPage,
    endPage: endPage || (readCount && totalPages ? totalPages : 0),
    pages: pages || (startPage && endPage && endPage >= startPage ? endPage - startPage + 1 : 0) || (readCount && totalPages ? totalPages : 0),
    minutes,
    note,
    performance,
    effect,
    readStage,
    evidenceUrl,
  }
}

function shouldMarkImportedBookFinished(row: any): boolean {
  const status = pickRowValue(row, ['阅读状态', '状态', '是否读完', 'readStatus']).toLowerCase()
  const readCount = firstNumber(pickRowValue(row, ['阅读次数', '次数', 'readCount']))
  const lastReadAt = pickRowValue(row, ['最近一次阅读时间', '最后阅读时间'])

  return Boolean(
    readCount > 0 ||
    lastReadAt ||
    ['已读', '已读完', '读完', 'finished', 'done', 'complete', 'completed'].some((item) => status.includes(item))
  )
}

/**
 * GET /fetch-by-isbn/:isbn - Fetch book info by ISBN from OpenLibrary, fallback to Jisu API
 */
libraryRouter.get('/fetch-by-isbn/:isbn', authMiddleware, async (req: any, res: Response) => {
  let { isbn } = req.params

  try {
    const familyId = req.user?.familyId
    let localBook: any = null
    isbn = cleanIsbn(isbn)
    if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
      throw new Error('Invalid ISBN format')
    }

    if (familyId) {
      localBook = await findLocalBookByIsbn(familyId, isbn)
      if (localBook?.coverUrl) {
        res.json({
          status: 'success',
          data: localBook,
        })
        return
      }
    }

    let openLibraryBook = null
    try {
      openLibraryBook = await searchOpenLibraryByIsbn(isbn)
    } catch (openLibraryError: any) {
      console.warn(`[OpenLibrary ISBN] ${isbn}:`, openLibraryError.message)
    }
    if (openLibraryBook) {
      const storedBook = await persistRemoteCover(openLibraryBook, 'openlibrary')
      await updateLocalBookCoverIfMissing(localBook?.id, storedBook.coverUrl)
      res.json({
        status: 'success',
        data: storedBook,
      })
      return
    }

    if (!env.JISU_API_KEY) {
      res.json({
        status: 'success',
        data: localBook || null
      })
      return
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
        source: 'jisu',
        coverStored: Boolean(coverUrl && supabase && env.SUPABASE_STORAGE_BUCKET),
      }

      res.json({
        status: 'success',
        data: transformedData,
      })
      await updateLocalBookCoverIfMissing(localBook?.id, transformedData.coverUrl)
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
 * GET /search-by-title/:title - Search books by title from OpenLibrary
 */
libraryRouter.get('/search-by-title/:title', authMiddleware, async (req: any, res: Response) => {
  const { title } = req.params
  let localResults: any[] = []

  try {
    const familyId = req.user?.familyId
    const matchInput: BookMatchInput = {
      name: String(title),
      author: req.query.author ? String(req.query.author) : '',
      publisher: req.query.publisher ? String(req.query.publisher) : '',
      publishYear: req.query.publishYear ? String(req.query.publishYear) : '',
    }
    localResults = familyId ? await findLocalBooksByMatch(familyId, matchInput, 10) : []
    const localResultsWithCover = localResults.filter(book => book.coverUrl)
    if (localResultsWithCover.length > 0) {
      res.json({
        status: 'success',
        data: localResultsWithCover,
      })
      return
    }

    const onlineResults = await searchOpenLibraryByMatch(matchInput, 10)
    const transformedResults = []
    for (const book of onlineResults) {
      transformedResults.push(await persistRemoteCover(book, 'openlibrary'))
    }
    if (transformedResults[0]?.coverUrl && localResults[0]?.id) {
      await updateLocalBookCoverIfMissing(localResults[0].id, transformedResults[0].coverUrl)
    }

    res.json({
      status: 'success',
      data: transformedResults.length > 0 ? transformedResults : localResults,
    })
  } catch (error: any) {
    console.error('[Title Search] Error:', error)
    res.json({
      status: 'success',
      data: localResults,
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
        where: { status: 'reading', ...(parsedChildId ? { childId: parsedChildId } : {}) },
        select: { id: true, childId: true, readPages: true },
      },
      bookReadStates: {
        where: { ...(parsedChildId ? { childId: parsedChildId } : {}) },
        select: { id: true, status: true, finishedAt: true },
      },
      readingLogs: {
        where: { ...(parsedChildId ? { childId: parsedChildId } : {}) },
        orderBy: { readDate: 'desc' },
        select: { pages: true, minutes: true, readDate: true, endPage: true },
      },
    },
  })

  const progressTotals = await prisma.readingProgressLog.groupBy({
    by: ['bookId'],
    where: { familyId, ...(parsedChildId ? { childId: parsedChildId } : {}) },
    _max: {
      readDate: true,
    },
  })
  const progressByBookId = new Map(progressTotals.map(item => [item.bookId, item._max]))

  // Transform books to match frontend expectations
  const transformedBooks = books.map(book => {
    // Calculate total read pages and minutes
    const logReadPages = book.readingLogs.reduce((sum, log) => sum + (log.pages || 0), 0)
    const totalReadMinutes = book.readingLogs.reduce((sum, log) => sum + (log.minutes || 0), 0)
    const progress = progressByBookId.get(book.id)
    const latestLogReadDate = book.readingLogs[0]?.readDate || null

    return {
      ...book,
      readState: book.bookReadStates[0] || null,
      totalReadPages: logReadPages,
      totalReadMinutes,
      lastReadDate: latestLogReadDate || progress?.readDate || null,
      readLogCount: book.readingLogs.length,
    }
  })

  transformedBooks.sort((a, b) => {
    const aFinished = a.readState?.status === 'finished' ? 1 : 0
    const bFinished = b.readState?.status === 'finished' ? 1 : 0
    if (aFinished !== bFinished) return aFinished - bFinished

    const aTime = new Date(a.lastReadDate || a.updatedAt || a.createdAt || 0).getTime()
    const bTime = new Date(b.lastReadDate || b.updatedAt || b.createdAt || 0).getTime()
    return bTime - aTime
  })

  res.json({
    status: 'success',
    data: transformedBooks,
  })
})

/**
 * POST / - Create a new book in library
 * Body: { name, author, isbn, publisher, type, coverUrl, totalPages, wordCount, characterTag, description, childId }
 */
libraryRouter.post('/', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { name, author, isbn, publisher, type, coverUrl, totalPages, wordCount, characterTag, description, childId } = req.body

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
      description: description || '',
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
      description: description || '',
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
  const { name, author, isbn, publisher, type, coverUrl, totalPages, wordCount, characterTag, description } = req.body

  const book = await prisma.book.findFirst({
    where: { id, familyId },
  })

  if (!book) {
    throw new AppError(404, '图书不存在')
  }

  const normalizedDescription = typeof description === 'string' ? description.trim() : description

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
      ...(description !== undefined && { description: normalizedDescription || '' }),
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
 * POST /refresh-openlibrary - Refresh existing book metadata and covers from OpenLibrary
 * Body: { limit?, overwrite? }
 */
libraryRouter.post('/refresh-openlibrary', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const limit = Math.min(parseInt(String(req.body.limit || '20'), 10) || 20, 100)
  const overwrite = Boolean(req.body.overwrite)
  const missingOnly = req.body.missingOnly !== false

  const books = await prisma.book.findMany({
    where: {
      familyId,
      status: 'active',
      ...(!overwrite && missingOnly ? { coverUrl: '' } : {}),
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: {
      id: true,
      name: true,
      author: true,
      isbn: true,
      publisher: true,
      coverUrl: true,
      totalPages: true,
    },
  })

  let matched = 0
  let updated = 0
  let failed = 0
  const samples: any[] = []

  for (const book of books) {
    try {
      const openLibraryBook = await findOpenLibraryBook(book)
      if (!openLibraryBook) {
        failed++
        continue
      }

      matched++
      const storedOpenLibraryBook = openLibraryBook.coverUrl
        ? await persistRemoteCover(openLibraryBook, 'openlibrary')
        : openLibraryBook
      const data: any = {}
      if (storedOpenLibraryBook.author && (overwrite || !book.author)) data.author = storedOpenLibraryBook.author
      if (storedOpenLibraryBook.publisher && (overwrite || !book.publisher)) data.publisher = storedOpenLibraryBook.publisher
      if (storedOpenLibraryBook.isbn && (overwrite || !book.isbn)) data.isbn = storedOpenLibraryBook.isbn
      if (storedOpenLibraryBook.coverUrl && (overwrite || !book.coverUrl)) data.coverUrl = storedOpenLibraryBook.coverUrl
      if (storedOpenLibraryBook.totalPages && (overwrite || !book.totalPages)) data.totalPages = storedOpenLibraryBook.totalPages

      if (Object.keys(data).length > 0) {
        await prisma.book.update({
          where: { id: book.id },
          data,
        })
        updated++
      }

      if (samples.length < 10) {
        samples.push({
          id: book.id,
          name: book.name,
          matchedName: storedOpenLibraryBook.name,
          updatedFields: Object.keys(data),
          coverUrl: data.coverUrl || book.coverUrl,
        })
      }

      await new Promise(resolve => setTimeout(resolve, 120))
    } catch (error: any) {
      failed++
      console.error(`[OpenLibrary Refresh] ${book.name}:`, error.message)
    }
  }

  res.json({
    status: 'success',
    data: {
      total: books.length,
      matched,
      updated,
      failed,
      samples,
    },
  })
})

/**
 * GET /:id - Get book details with reading logs
 */
libraryRouter.get('/:id', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId, name } = req.user!
  let childId = req.query.childId as string | undefined

  if (Array.isArray(childId)) {
    childId = childId[0]
  }

  const parsedChildId = childId ? parseInt(childId) : null
  if (childId && isNaN(parsedChildId)) {
    throw new AppError(400, 'Invalid childId: must be a number')
  }

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
        where: { status: 'reading', ...(parsedChildId ? { childId: parsedChildId } : {}) },
        select: { id: true, childId: true, readPages: true },
      },
      bookReadStates: {
        where: { ...(parsedChildId ? { childId: parsedChildId } : {}) },
        select: { id: true, status: true, finishedAt: true },
      },
      readingLogs: {
        where: { ...(parsedChildId ? { childId: parsedChildId } : {}) },
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

  const progress = await prisma.readingProgressLog.aggregate({
    where: { familyId, bookId: id, ...(parsedChildId ? { childId: parsedChildId } : {}) },
    _max: {
      readDate: true,
    },
  })

  const logReadPages = book.readingLogs.reduce((sum, log: any) => sum + (log.pages || 0), 0)
  const totalReadMinutes = book.readingLogs.reduce((sum, log: any) => sum + (log.minutes || 0), 0)
  const lastReadDate = book.readingLogs[0]?.readDate || progress._max.readDate || null

  res.json({
    status: 'success',
    data: {
      ...book,
      readState: book.bookReadStates[0] || null,
      totalReadPages: logReadPages,
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

    const fileExt = req.file.originalname.split('.').pop() || 'jpg'
    const coverUrl = await storeCoverBuffer(req.file.buffer, fileExt, req.file.mimetype)

    res.json({
      status: 'success',
      data: {
        coverUrl
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

  await prisma.bookReadState.upsert({
    where: {
      childId_bookId: {
        childId: parsedChildId,
        bookId,
      },
    },
    update: {
      status: 'reading',
      finishedAt: null,
    },
    create: {
      familyId,
      childId: parsedChildId,
      bookId,
      status: 'reading',
      finishedAt: null,
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
  if (!imageUrl) {
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
    
    const storedUrl = await storeCoverBuffer(imageBuffer, fileExt, contentType || `image/${fileExt}`)
    console.log(`[COVER] Success: ${storedUrl}`)
    return storedUrl
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
    let matchedBooks = 0
    let readingLogsCreated = 0
    let readStatesUpdated = 0
    let coverSuccess = 0
    let coverFailed = 0
    const totalRows = data.length

    // 先获取所有已存在的书籍名称，减少数据库查询次数
    const existingBooks = await prisma.book.findMany({
      where: { familyId },
      select: { id: true, name: true, isbn: true }
    })
    const existingBookByKey = new Map<string, { id: number; name: string; isbn: string }>()
    for (const book of existingBooks) {
      const isbnKey = cleanIsbn(book.isbn || '')
      if (isbnKey) existingBookByKey.set(`isbn:${isbnKey}`, book)
      existingBookByKey.set(`name:${normalizeBookName(book.name)}`, book)
    }
    console.log(`[IMPORT] Found ${existingBookByKey.size} existing book keys`)

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

      const isbn = cleanIsbn(String(row['ISBN'] || ''))
      const bookKey = isbn ? `isbn:${isbn}` : `name:${normalizeBookName(String(name))}`
      let targetBook = existingBookByKey.get(bookKey) || existingBookByKey.get(`name:${normalizeBookName(String(name))}`)

      // Map type
      const excelType = row['类型'] || row['书架分类'] || row['分类'] || ''
      const bookType = typeMap[excelType] || 'children'
      const wordCount = firstNumber(row['字数'], row['wordCount'])
      const totalPages = firstNumber(row['页数'], row['总页数'], row['totalPages'])
      const readCount = firstNumber(row['阅读次数'], row['次数'], row['readCount'])
      
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
      if (!targetBook && coverUrl && (coverUrl.startsWith('http://') || coverUrl.startsWith('https://'))) {
        finalCoverUrl = await downloadAndUploadCover(coverUrl, String(name))
        if (finalCoverUrl) {
          coverSuccess++
        } else {
          coverFailed++
        }
      }

      if (!targetBook) {
        const createdBook = await prisma.book.create({
          data: {
            familyId,
            childId: childId ? parseInt(childId) : null,
            name: String(name),
            author: String(row['作者'] || ''),
            type: bookType,
            coverUrl: finalCoverUrl,
            totalPages,
            isbn,
            publisher: String(row['出版社'] || ''),
            wordCount: wordCount || null,
            readCount,
          },
          select: { id: true, name: true, isbn: true },
        })
        targetBook = createdBook
        imported++
        if (isbn) existingBookByKey.set(`isbn:${isbn}`, createdBook)
        existingBookByKey.set(`name:${normalizeBookName(String(name))}`, createdBook)
      } else {
        const bookPatch: any = {}
        if (wordCount) bookPatch.wordCount = wordCount
        if (totalPages) bookPatch.totalPages = totalPages
        if (readCount) bookPatch.readCount = readCount
        if (childId) bookPatch.childId = parseInt(childId)
        if (Object.keys(bookPatch).length > 0) {
          await prisma.book.update({
            where: { id: targetBook.id },
            data: bookPatch,
          })
        }
        matchedBooks++
      }

      const logData = buildReadingLogFromImportRow(row, familyId, targetBook.id, childId ? parseInt(childId) : null)
      if (logData) {
        const dayStart = new Date(logData.readDate)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)
        const existingLog = await prisma.readingLog.findFirst({
          where: {
            familyId,
            childId: logData.childId,
            bookId: targetBook.id,
            readDate: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
          select: { id: true },
        })

        if (!existingLog) {
          await prisma.readingLog.create({ data: logData })
          readingLogsCreated++
        }
      }

      const parsedChildId = childId ? parseInt(childId) : null
      if (parsedChildId && shouldMarkImportedBookFinished(row)) {
        await prisma.bookReadState.upsert({
          where: {
            childId_bookId: {
              childId: parsedChildId,
              bookId: targetBook.id,
            },
          },
          create: {
            familyId,
            childId: parsedChildId,
            bookId: targetBook.id,
            status: 'finished',
            finishedAt: parseExcelDate(pickRowValue(row, ['最近一次阅读时间', '最后阅读时间', '阅读日期', '日期', 'readDate'])),
          },
          update: {
            status: 'finished',
            finishedAt: parseExcelDate(pickRowValue(row, ['最近一次阅读时间', '最后阅读时间', '阅读日期', '日期', 'readDate'])),
          },
        })
        readStatesUpdated++
      }

      if ((i + 1) % 10 === 0 || i === data.length - 1) {
        const progress = Math.round(((i + 1) / totalRows) * 100)
        res.write(JSON.stringify({
          status: 'progress',
          data: {
            progress,
            imported,
            skipped,
            matchedBooks,
            readingLogsCreated,
            readStatesUpdated,
            processed: i + 1,
            coverSuccess,
            coverFailed
          }
        }) + '\n')
        if (res.flush) res.flush()
      }
    }

    console.log(`[IMPORT] Completed: ${imported} imported, ${matchedBooks} matched, ${readingLogsCreated} logs, ${readStatesUpdated} read states, ${skipped} skipped, ${coverSuccess} covers, ${coverFailed} failed`)

    // 发送完成信息
    res.write(JSON.stringify({
      status: 'success',
      message: `导入完成：新建 ${imported} 本，匹配 ${matchedBooks} 本，阅读记录 ${readingLogsCreated} 条，已读状态 ${readStatesUpdated} 本，跳过 ${skipped} 条，封面 ${coverSuccess} 个`,
      data: { imported, createdBooks: imported, matchedBooks, readingLogsCreated, readStatesUpdated, skipped, coverSuccess, coverFailed },
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
