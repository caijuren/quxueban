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

function parseTaskTags(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }

  return {}
}

function normalizeBookLists(value: unknown): Array<{ id: string; name: string; bookIds: number[]; createdAt: string }> {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 80) : `${Date.now()}`,
      name: typeof item.name === 'string' ? item.name.trim().slice(0, 60) : '',
      bookIds: Array.isArray(item.bookIds)
        ? item.bookIds.map(Number).filter((id) => Number.isInteger(id) && id > 0).slice(0, 500)
        : [],
      createdAt: typeof item.createdAt === 'string' ? item.createdAt.slice(0, 40) : new Date().toISOString(),
    }))
    .filter((item) => item.name)
    .slice(0, 100)
}

function normalizeBookMetadata(value: unknown): { notes: string; chapters: string[] } {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    notes: typeof input.notes === 'string' ? input.notes.trim().slice(0, 5000) : '',
    chapters: Array.isArray(input.chapters)
      ? input.chapters.filter((item): item is string => typeof item === 'string').map((item) => item.trim().slice(0, 120)).filter(Boolean).slice(0, 300)
      : [],
  }
}

function inferAbilityPoint(task: { name?: string; category?: string }): { abilityCategory: string; abilityPoint: string } {
  const text = `${task.name || ''} ${task.category || ''}`.toLowerCase()
  if (/read|阅读|朗读|书/.test(text)) return { abilityCategory: '学科能力', abilityPoint: '阅读理解' }
  if (/math|数学|计算|口算|题/.test(text)) return { abilityCategory: '学科能力', abilityPoint: '数学能力' }
  if (/english|英语|单词|听力|拼读/.test(text)) return { abilityCategory: '学科能力', abilityPoint: '英语能力' }
  if (/sport|体育|跳绳|跑步|运动|体能/.test(text)) return { abilityCategory: '体育与健康', abilityPoint: '基础体能' }
  if (/复盘|总结|错题|反思/.test(text)) return { abilityCategory: '学习习惯', abilityPoint: '复盘与反思' }
  if (/表达|讲述|口述|写作/.test(text)) return { abilityCategory: '思维与认知', abilityPoint: '表达输出' }
  return { abilityCategory: '学习习惯', abilityPoint: '学习专注力' }
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

function transformGoogleBookVolume(volume: any) {
  const info = volume?.volumeInfo || {}
  const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : []
  const isbn13 = identifiers.find((item: any) => item?.type === 'ISBN_13')?.identifier
  const isbn10 = identifiers.find((item: any) => item?.type === 'ISBN_10')?.identifier
  const imageLinks = info.imageLinks || {}
  const coverUrl = imageLinks.thumbnail || imageLinks.smallThumbnail || ''

  return {
    name: info.title || '',
    author: firstText(info.authors),
    isbn: cleanIsbn(isbn13 || isbn10 || ''),
    publisher: info.publisher || '',
    coverUrl: coverUrl ? String(coverUrl).replace(/^http:/, 'https:') : '',
    totalPages: firstNumber(info.pageCount),
    publishYear: normalizeYear(info.publishedDate) || null,
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

async function searchGoogleBooksByMatch(input: BookMatchInput, limit = 10) {
  const queryParts = [`intitle:${input.name}`]
  if (input.author) queryParts.push(`inauthor:${input.author}`)
  if (input.publisher) queryParts.push(`inpublisher:${input.publisher}`)
  const params = new URLSearchParams({
    q: queryParts.join(' '),
    maxResults: String(limit),
    printType: 'books',
  })
  const data = await fetchJsonWithTimeout(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`)
  const candidates = (data?.items || [])
    .map((item: any) => transformGoogleBookVolume(item))
    .filter((book: any) => book.name)
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

const IMPORT_BOOK_TYPE_MAP: Record<string, string> = {
  '儿童故事': 'children',
  '传统文化': 'tradition',
  '科普': 'science',
  '性格养成、其他': 'character',
}

const IMPORT_RECOGNIZED_COLUMNS = [
  '书名',
  '作者',
  'ISBN',
  '出版社',
  '类型',
  '书架分类',
  '分类',
  '页数',
  '总页数',
  '字数',
  '阅读次数',
  '最近一次阅读时间',
  '最后阅读时间',
  '阅读日期',
  '阅读时长',
  '开始页',
  '结束页',
  '阅读页数',
  '阅读状态',
  '封面',
  '封面链接',
  '图片',
  '图片链接',
]

type ImportRow = Record<string, any>

function extractImportWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const hyperlinks: Record<string, string> = {}
  const links = (sheet as any)['!links'] || (sheet as any)['!hyperlinks'] || (sheet as any)['!rels']?.hyperlinks

  if (links && Array.isArray(links)) {
    for (const link of links) {
      const cellRef = link.ref || link.r || link.cell
      const target = link.Target || link.target || link.t || link.hyperlink
      if (cellRef && target) {
        hyperlinks[cellRef] = target
      }
    }
  }

  const rows = XLSX.utils.sheet_to_json<ImportRow>(sheet)
  const columns = rows[0] ? Object.keys(rows[0]) : []

  return { sheetName, sheet, rows, hyperlinks, columns }
}

function getImportCoverUrl(row: ImportRow, hyperlinks: Record<string, string>, excelRowNumber: number): string {
  const kCellAddress = `K${excelRowNumber}`
  const linkedCover = hyperlinks[kCellAddress] || ''
  if (linkedCover) return linkedCover

  const possibleCoverColumns = ['封面', '封面链接', '图片', '图片链接', 'cover', 'coverUrl']
  for (const col of possibleCoverColumns) {
    if (row[col] && String(row[col]).trim()) {
      const value = String(row[col]).trim()
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return value
      }
    }
  }

  return ''
}

async function getExistingBookKeyMap(familyId: number) {
  const existingBooks = await prisma.book.findMany({
    where: { familyId },
    select: { id: true, name: true, isbn: true, author: true, publisher: true },
  })
  const existingBookByKey = new Map<string, { id: number; name: string; isbn: string | null; author?: string | null; publisher?: string | null }>()
  for (const book of existingBooks) {
    const isbnKey = cleanIsbn(book.isbn || '')
    if (isbnKey) existingBookByKey.set(`isbn:${isbnKey}`, book)
    existingBookByKey.set(`name:${normalizeBookName(book.name)}`, book)
  }
  return existingBookByKey
}

type ImportMatchedBook = {
  id: number;
  name: string;
  isbn: string | null;
  author?: string | null;
  publisher?: string | null;
  matchKey: string;
  matchScore: number;
  matchNeedsReview: boolean;
  matchReason: string;
}

function buildImportMatchKey(rowNumber: number, bookId: number) {
  return `${rowNumber}:${bookId}`
}

function findMatchedImportBook(
  row: ImportRow,
  existingBookByKey: Map<string, { id: number; name: string; isbn: string | null; author?: string | null; publisher?: string | null }>,
  rowNumber = 0,
  rejectedMatchKeys = new Set<string>()
): ImportMatchedBook | null {
  const name = row['书名']
  const isbn = cleanIsbn(String(row['ISBN'] || ''))
  const normalizedName = normalizeBookName(String(name || ''))
  const byIsbn = isbn ? existingBookByKey.get(`isbn:${isbn}`) : null
  const byName = existingBookByKey.get(`name:${normalizedName}`)
  const book = byIsbn || byName || null
  if (!book) return null

  const matchKey = buildImportMatchKey(rowNumber, book.id)
  if (rejectedMatchKeys.has(matchKey)) return null

  if (byIsbn) {
    return {
      ...book,
      matchKey,
      matchScore: 100,
      matchNeedsReview: false,
      matchReason: 'ISBN 完全一致',
    }
  }

  const inputAuthor = normalizeText(String(row['作者'] || ''))
  const bookAuthor = normalizeText(String(book.author || ''))
  const inputPublisher = normalizeText(String(row['出版社'] || ''))
  const bookPublisher = normalizeText(String(book.publisher || ''))
  const authorMatched = Boolean(inputAuthor && bookAuthor && (inputAuthor.includes(bookAuthor) || bookAuthor.includes(inputAuthor)))
  const publisherMatched = Boolean(inputPublisher && bookPublisher && (inputPublisher.includes(bookPublisher) || bookPublisher.includes(inputPublisher)))
  const hasPublisherConflict = Boolean(inputPublisher && bookPublisher && !publisherMatched)
  const hasAuthorConflict = Boolean(inputAuthor && bookAuthor && !authorMatched)
  const matchScore = Math.max(50, 82 + (authorMatched ? 8 : 0) + (publisherMatched ? 8 : 0) - (hasPublisherConflict ? 18 : 0) - (hasAuthorConflict ? 12 : 0))

  return {
    ...book,
    matchKey,
    matchScore,
    matchNeedsReview: hasPublisherConflict || hasAuthorConflict || (!inputPublisher && !inputAuthor),
    matchReason: hasPublisherConflict ? '书名相同，出版社不同' : hasAuthorConflict ? '书名相同，作者不同' : '书名一致',
  }
}

function buildBookExportRows(books: any[]) {
  return books.map(book => ({
    书名: book.name || '',
    作者: book.author || '',
    ISBN: book.isbn || '',
    出版社: book.publisher || '',
    类型: book.type || '',
    页数: book.totalPages || 0,
    字数: book.wordCount || '',
    封面: book.coverUrl || '',
    性格标签: book.characterTag || '',
    简介: book.description || '',
    阅读次数: book.readCount || 0,
    阅读状态: book.readState?.status || '',
    最近阅读日期: book.lastReadDate ? new Date(book.lastReadDate).toISOString().slice(0, 10) : '',
    累计阅读页数: book.totalReadPages || 0,
    累计阅读分钟: book.totalReadMinutes || 0,
    阅读记录数: book.readLogCount || 0,
    创建时间: book.createdAt ? new Date(book.createdAt).toISOString() : '',
    更新时间: book.updatedAt ? new Date(book.updatedAt).toISOString() : '',
  }))
}

function formatExportDate() {
  return new Date().toISOString().slice(0, 10)
}

function buildImportTemplateWorkbook() {
  const sampleRows = [
    {
      书名: '西游记',
      作者: '吴承恩',
      ISBN: '9787020008735',
      出版社: '人民文学出版社',
      类型: '传统文化',
      总页数: 600,
      字数: 720000,
      阅读日期: '2026-04-28',
      开始页: 1,
      结束页: 30,
      阅读页数: 30,
      阅读时长: 25,
      阅读状态: '',
      备注: '第一回阅读',
      孩子表现: '专注，能复述主要情节',
      阅读效果: '理解良好',
      阅读阶段: '精读',
      封面链接: '',
    },
    {
      书名: '西游记',
      作者: '吴承恩',
      ISBN: '9787020008735',
      出版社: '人民文学出版社',
      类型: '传统文化',
      总页数: 600,
      字数: 720000,
      阅读日期: '2026-04-29',
      开始页: 31,
      结束页: 60,
      阅读页数: 30,
      阅读时长: 30,
      阅读状态: '',
      备注: '第二回阅读',
      孩子表现: '',
      阅读效果: '',
      阅读阶段: '精读',
      封面链接: '',
    },
  ]
  const guideRows = [
    { 字段: '书名', 是否必填: '是', 说明: '用于创建或匹配图书。' },
    { 字段: 'ISBN', 是否必填: '否', 说明: '有 ISBN 时优先按 ISBN 匹配。' },
    { 字段: '出版社/作者', 是否必填: '否', 说明: '用于软匹配评分，书名相同但信息不同会要求确认。' },
    { 字段: '阅读日期', 是否必填: '阅读明细建议填写', 说明: '一行一次阅读，会生成对应日期的阅读记录。' },
    { 字段: '开始页/结束页/阅读页数/阅读时长', 是否必填: '否', 说明: '用于统计阅读进度、页数和分钟数。' },
    { 字段: '阅读状态', 是否必填: '否', 说明: '填写“已读完”会同步当前孩子的已读状态。' },
    { 字段: '封面链接', 是否必填: '否', 说明: '支持 http/https 图片链接，导入时会尝试保存。' },
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sampleRows), '阅读明细模板')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(guideRows), '字段说明')
  return workbook
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

    const [openLibraryResults, googleResults] = await Promise.allSettled([
      searchOpenLibraryByMatch(matchInput, 10),
      searchGoogleBooksByMatch(matchInput, 10),
    ])
    const onlineResults = [
      ...(openLibraryResults.status === 'fulfilled' ? openLibraryResults.value.map((book: any) => ({ ...book, source: 'openlibrary' })) : []),
      ...(googleResults.status === 'fulfilled' ? googleResults.value.map((book: any) => ({ ...book, source: 'googlebooks' })) : []),
    ]
    const dedupedResults = Array.from(
      new Map(onlineResults.map((book: any) => [`${cleanIsbn(book.isbn || '') || normalizeBookName(book.name)}:${normalizeText(book.author || '')}`, book])).values()
    )
    const rankedResults = rankBookCandidates(dedupedResults, matchInput).sort((a: any, b: any) => {
      const aHasIsbn = cleanIsbn(a.isbn || '') ? 1 : 0
      const bHasIsbn = cleanIsbn(b.isbn || '') ? 1 : 0
      return bHasIsbn - aHasIsbn
    })
    const transformedResults = []
    for (const book of rankedResults.slice(0, 10)) {
      transformedResults.push(await persistRemoteCover(book, book.source || 'book-metadata'))
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
        select: { id: true, childId: true, readPages: true, status: true },
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
    const activeReading = book.activeReadings.find(reading => reading.status === 'reading')
    const storedReadState = book.bookReadStates[0] || null
    const readState = activeReading
      ? { ...(storedReadState || {}), status: 'reading', finishedAt: null }
      : storedReadState

    return {
      ...book,
      readState,
      totalReadPages: logReadPages,
      totalReadMinutes,
      lastReadDate: latestLogReadDate || progress?.readDate || null,
      readLogCount: book.readingLogs.length,
    }
  })

  transformedBooks.sort((a, b) => {
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
 * GET /export - Export library data as JSON or XLSX
 * Query: ?format=json|xlsx&search=&type=&childId=
 */
libraryRouter.get('/export', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const format = String(req.query.format || 'json').toLowerCase()
  const search = req.query.search as string | undefined
  const type = req.query.type as string | undefined
  let childId = req.query.childId as string | undefined

  if (Array.isArray(childId)) {
    childId = childId[0]
  }

  const parsedChildId = childId ? parseInt(childId, 10) : null
  if (childId && Number.isNaN(parsedChildId)) {
    throw new AppError(400, 'Invalid childId: must be a number')
  }

  const whereClause: any = {
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
      bookReadStates: {
        where: { ...(parsedChildId ? { childId: parsedChildId } : {}) },
        select: { status: true, finishedAt: true },
      },
      readingLogs: {
        where: { ...(parsedChildId ? { childId: parsedChildId } : {}) },
        orderBy: { readDate: 'desc' },
        select: { pages: true, minutes: true, readDate: true },
      },
    },
  })

  const exportBooks = books.map(book => {
    const totalReadPages = book.readingLogs.reduce((sum, log) => sum + (log.pages || 0), 0)
    const totalReadMinutes = book.readingLogs.reduce((sum, log) => sum + (log.minutes || 0), 0)
    return {
      ...book,
      readState: book.bookReadStates[0] || null,
      totalReadPages,
      totalReadMinutes,
      lastReadDate: book.readingLogs[0]?.readDate || null,
      readLogCount: book.readingLogs.length,
    }
  })

  const fileBaseName = `library-export-${formatExportDate()}`

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName}.json"`)
    res.json({
      exportedAt: new Date().toISOString(),
      familyId,
      childId: parsedChildId,
      total: exportBooks.length,
      books: exportBooks.map(book => ({
        id: book.id,
        name: book.name,
        author: book.author,
        isbn: book.isbn,
        publisher: book.publisher,
        type: book.type,
        totalPages: book.totalPages,
        wordCount: book.wordCount,
        coverUrl: book.coverUrl,
        characterTag: book.characterTag,
        description: book.description,
        readCount: book.readCount,
        readState: book.readState,
        totalReadPages: book.totalReadPages,
        totalReadMinutes: book.totalReadMinutes,
        readLogCount: book.readLogCount,
        lastReadDate: book.lastReadDate,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
      })),
    })
    return
  }

  if (format === 'xlsx' || format === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(buildBookExportRows(exportBooks))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '图书馆')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName}.xlsx"`)
    res.send(buffer)
    return
  }

  throw new AppError(400, 'Unsupported export format')
})

/**
 * GET /import/template - Download the library import template
 */
libraryRouter.get('/import/template', authMiddleware, requireRole('parent'), async (_req: AuthRequest, res: Response) => {
  const workbook = buildImportTemplateWorkbook()
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="library-import-template-${formatExportDate()}.xlsx"`)
  res.send(buffer)
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
 * GET /data-quality - Get 1.7 library/task data quality summary
 */
libraryRouter.get('/data-quality', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  const books = await prisma.book.findMany({
    where: { familyId, status: 'active' },
    select: {
      id: true,
      name: true,
      isbn: true,
      type: true,
      totalPages: true,
      coverUrl: true,
    },
  })

  const tasks = await prisma.task.findMany({
    where: { familyId, isActive: true },
    select: {
      id: true,
      tags: true,
    },
  })

  const isbnGroups = new Map<string, number[]>()
  const titleGroups = new Map<string, number[]>()

  for (const book of books) {
    const isbnKey = cleanIsbn(book.isbn || '')
    if (isbnKey) {
      isbnGroups.set(isbnKey, [...(isbnGroups.get(isbnKey) || []), book.id])
    }

    const titleKey = normalizeBookName(book.name)
    if (titleKey) {
      titleGroups.set(titleKey, [...(titleGroups.get(titleKey) || []), book.id])
    }
  }

  const duplicateIsbnBookIds = new Set<number>()
  const duplicateTitleBookIds = new Set<number>()

  for (const ids of isbnGroups.values()) {
    if (ids.length > 1) ids.forEach(id => duplicateIsbnBookIds.add(id))
  }
  for (const ids of titleGroups.values()) {
    if (ids.length > 1) ids.forEach(id => duplicateTitleBookIds.add(id))
  }

  const missingIsbn = books.filter(book => !cleanIsbn(book.isbn || '')).length
  const missingPageCount = books.filter(book => !book.totalPages || book.totalPages <= 0).length
  const missingType = books.filter(book => !String(book.type || '').trim()).length
  const missingCover = books.filter(book => !String(book.coverUrl || '').trim()).length
  const complete = books.filter(book =>
    cleanIsbn(book.isbn || '') &&
    book.totalPages > 0 &&
    String(book.type || '').trim()
  ).length

  const missingAbilityPoint = tasks.filter(task => {
    const tags = parseTaskTags(task.tags)
    const abilityPoint = typeof tags.abilityPoint === 'string' ? tags.abilityPoint.trim() : ''
    return !abilityPoint || abilityPoint === '不关联目标'
  }).length

  res.json({
    status: 'success',
    data: {
      books: {
        total: books.length,
        complete,
        missingIsbn,
        missingPageCount,
        missingType,
        missingCover,
        duplicateIsbn: duplicateIsbnBookIds.size,
        duplicateTitle: duplicateTitleBookIds.size,
      },
      tasks: {
        total: tasks.length,
        missingAbilityPoint,
      },
    },
  })
})

/**
 * POST /data-quality/merge-duplicate-titles - Merge books with the same normalized title
 */
libraryRouter.post('/data-quality/merge-duplicate-titles', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  const books = await prisma.book.findMany({
    where: { familyId, status: 'active' },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    select: { id: true, name: true, totalPages: true, coverUrl: true, isbn: true, updatedAt: true },
  })

  const groups = new Map<string, typeof books>()
  for (const book of books) {
    const key = normalizeBookName(book.name)
    if (!key) continue
    groups.set(key, [...(groups.get(key) || []), book])
  }

  let mergedGroups = 0
  let mergedBooks = 0

  await prisma.$transaction(async (tx) => {
    for (const group of groups.values()) {
      if (group.length < 2) continue

      const keeper = [...group].sort((a, b) => {
        const aScore = (a.totalPages > 0 ? 2 : 0) + (a.coverUrl ? 1 : 0) + (a.isbn ? 1 : 0)
        const bScore = (b.totalPages > 0 ? 2 : 0) + (b.coverUrl ? 1 : 0) + (b.isbn ? 1 : 0)
        if (aScore !== bScore) return bScore - aScore
        return a.id - b.id
      })[0]
      const duplicates = group.filter(book => book.id !== keeper.id)
      const duplicateIds = duplicates.map(book => book.id)
      if (duplicateIds.length === 0) continue

      await tx.readingLog.updateMany({ where: { familyId, bookId: { in: duplicateIds } }, data: { bookId: keeper.id } })
      await tx.activeReading.updateMany({ where: { familyId, bookId: { in: duplicateIds } }, data: { bookId: keeper.id, status: 'merged' } })
      await tx.bookReadState.deleteMany({ where: { familyId, bookId: { in: duplicateIds } } })
      await tx.bookAIInsight.updateMany({ where: { familyId, bookId: { in: duplicateIds } }, data: { bookId: keeper.id } })
      await tx.book.updateMany({ where: { familyId, id: { in: duplicateIds } }, data: { status: 'inactive' } })

      mergedGroups++
      mergedBooks += duplicateIds.length
    }
  })

  res.json({
    status: 'success',
    message: `已合并 ${mergedGroups} 组重复书，归档 ${mergedBooks} 本重复书`,
    data: { mergedGroups, mergedBooks },
  })
})

/**
 * POST /data-quality/fill-missing-pages - Fill missing totalPages from reliable reading evidence
 */
libraryRouter.post('/data-quality/fill-missing-pages', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  const books = await prisma.book.findMany({
    where: { familyId, status: 'active', totalPages: { lte: 0 } },
    select: {
      id: true,
      name: true,
      readingLogs: {
        select: { pages: true, endPage: true },
      },
      bookReadStates: {
        select: { status: true },
      },
    },
  })

  let updated = 0
  let skipped = 0

  await prisma.$transaction(async (tx) => {
    for (const book of books) {
      const maxEndPage = Math.max(0, ...book.readingLogs.map(log => log.endPage || 0))
      const summedPages = book.readingLogs.reduce((sum, log) => sum + (log.pages || 0), 0)
      const hasFinishedState = book.bookReadStates.some(state => state.status === 'finished')
      const inferredPages = Math.max(maxEndPage, hasFinishedState ? summedPages : 0)

      if (inferredPages <= 0) {
        skipped++
        continue
      }

      await tx.book.update({
        where: { id: book.id },
        data: { totalPages: inferredPages },
      })
      updated++
    }
  })

  res.json({
    status: 'success',
    message: `已自动补齐 ${updated} 本页数，${skipped} 本缺少可推断记录`,
    data: { updated, skipped, total: books.length },
  })
})

/**
 * POST /data-quality/autofill-metadata - Fill ISBN/cover/page metadata from online sources
 */
libraryRouter.post('/data-quality/autofill-metadata', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const limitInput = Number(req.body?.limit || 100)
  const limit = Number.isInteger(limitInput) ? Math.min(Math.max(limitInput, 1), 200) : 100

  const books = await prisma.book.findMany({
    where: { familyId, status: 'active', isbn: '' },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { id: true, name: true, author: true, publisher: true, isbn: true, coverUrl: true, totalPages: true },
  })

  let isbnUpdated = 0
  let coverUpdated = 0
  let pageUpdated = 0
  let skipped = 0

  for (const book of books) {
    try {
      const candidates = [
        ...(await searchGoogleBooksByMatch(book, 8).catch(() => [])),
        ...(await searchOpenLibraryByMatch(book, 8).catch(() => [])),
      ]
      const candidate = candidates.find(item => cleanIsbn(item.isbn || '')) || candidates.find(item => item.coverUrl || item.totalPages > 0)
      if (!candidate) {
        skipped++
        continue
      }

      const data: any = {}
      const nextIsbn = cleanIsbn(candidate.isbn || '')
      if (nextIsbn && !cleanIsbn(book.isbn || '')) data.isbn = nextIsbn
      if (candidate.coverUrl && !book.coverUrl) data.coverUrl = (await downloadAndUploadCover(candidate.coverUrl, candidate.name || book.name || candidate.isbn || 'book')) || candidate.coverUrl
      if (candidate.totalPages > 0 && (!book.totalPages || book.totalPages <= 0)) data.totalPages = candidate.totalPages
      if (candidate.author && !book.author) data.author = candidate.author
      if (candidate.publisher && !book.publisher) data.publisher = candidate.publisher

      if (Object.keys(data).length === 0) {
        skipped++
        continue
      }

      await prisma.book.update({ where: { id: book.id }, data })
      if (data.isbn) isbnUpdated++
      if (data.coverUrl) coverUpdated++
      if (data.totalPages) pageUpdated++
    } catch {
      skipped++
    }
  }

  const remainingMissingIsbn = await prisma.book.count({
    where: { familyId, status: 'active', isbn: '' },
  })

  res.json({
    status: 'success',
    message: `本次处理 ${books.length} 本，补 ISBN ${isbnUpdated} 本，补封面 ${coverUpdated} 本`,
    data: { processed: books.length, isbnUpdated, coverUpdated, pageUpdated, skipped, remainingMissingIsbn },
  })
})

/**
 * POST /data-quality/fix-task-ability - Infer ability points for tasks missing them
 */
libraryRouter.post('/data-quality/fix-task-ability', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  const tasks = await prisma.task.findMany({
    where: { familyId, isActive: true },
    select: { id: true, name: true, category: true, tags: true },
  })

  let updated = 0
  for (const task of tasks) {
    const tags = parseTaskTags(task.tags)
    const abilityPoint = typeof tags.abilityPoint === 'string' ? tags.abilityPoint.trim() : ''
    if (abilityPoint && abilityPoint !== '不关联目标') continue

    const inferred = inferAbilityPoint(task)
    await prisma.task.update({
      where: { id: task.id },
      data: {
        tags: {
          ...tags,
          abilityCategory: typeof tags.abilityCategory === 'string' && tags.abilityCategory.trim() ? tags.abilityCategory : inferred.abilityCategory,
          abilityPoint: inferred.abilityPoint,
        },
      },
    })
    updated++
  }

  res.json({
    status: 'success',
    message: `已为 ${updated} 个任务补齐能力点`,
    data: { updated },
  })
})

/**
 * GET /book-lists - Get persisted child book lists
 */
libraryRouter.get('/book-lists', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = Number(req.query.childId)

  if (!Number.isInteger(childId) || childId <= 0) {
    throw new AppError(400, '请选择孩子')
  }

  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child', status: 'active' },
    select: { id: true },
  })
  if (!child) {
    throw new AppError(404, '孩子不存在')
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })
  const settings = (family?.settings as any) || {}
  const lists = normalizeBookLists(settings.libraryBookListsByChild?.[String(childId)])

  res.json({ status: 'success', data: lists })
})

/**
 * PUT /book-lists - Persist child book lists
 */
libraryRouter.put('/book-lists', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = Number(req.body.childId)
  const lists = normalizeBookLists(req.body.lists)

  if (!Number.isInteger(childId) || childId <= 0) {
    throw new AppError(400, '请选择孩子')
  }

  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child', status: 'active' },
    select: { id: true },
  })
  if (!child) {
    throw new AppError(404, '孩子不存在')
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })
  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const currentSettings = (family.settings as any) || {}
  await prisma.family.update({
    where: { id: familyId },
    data: {
      settings: {
        ...currentSettings,
        libraryBookListsByChild: {
          ...(currentSettings.libraryBookListsByChild || {}),
          [String(childId)]: lists,
        },
      },
    },
  })

  res.json({ status: 'success', message: '书单已保存', data: lists })
})

/**
 * GET /:id/metadata - Get persisted book notes and chapter catalog
 */
libraryRouter.get('/:id/metadata', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const childId = Number(req.query.childId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, '图书参数错误')
  }
  if (!Number.isInteger(childId) || childId <= 0) {
    throw new AppError(400, '请选择孩子')
  }

  const book = await prisma.book.findFirst({
    where: { id, familyId, status: 'active' },
    select: { id: true },
  })
  if (!book) {
    throw new AppError(404, '图书不存在')
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })
  const settings = (family?.settings as any) || {}
  const key = `${childId}:${id}`
  const metadata = normalizeBookMetadata(settings.bookMetadataByChild?.[key])

  res.json({ status: 'success', data: metadata })
})

/**
 * PUT /:id/metadata - Persist book notes and chapter catalog
 */
libraryRouter.put('/:id/metadata', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const { familyId } = req.user!
  const childId = Number(req.body.childId)
  const metadata = normalizeBookMetadata(req.body)

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, '图书参数错误')
  }
  if (!Number.isInteger(childId) || childId <= 0) {
    throw new AppError(400, '请选择孩子')
  }

  const book = await prisma.book.findFirst({
    where: { id, familyId, status: 'active' },
    select: { id: true },
  })
  if (!book) {
    throw new AppError(404, '图书不存在')
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })
  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const currentSettings = (family.settings as any) || {}
  const key = `${childId}:${id}`
  await prisma.family.update({
    where: { id: familyId },
    data: {
      settings: {
        ...currentSettings,
        bookMetadataByChild: {
          ...(currentSettings.bookMetadataByChild || {}),
          [key]: metadata,
        },
      },
    },
  })

  res.json({ status: 'success', message: '书籍资料已保存', data: metadata })
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
        select: { id: true, childId: true, readPages: true, status: true },
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
  const activeReading = book.activeReadings.find(reading => reading.status === 'reading')
  const storedReadState = book.bookReadStates[0] || null
  const readState = activeReading
    ? { ...(storedReadState || {}), status: 'reading', finishedAt: null }
    : storedReadState

  res.json({
    status: 'success',
    data: {
      ...book,
      readState,
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
 * POST /import/preview - Analyze import file without writing data
 */
libraryRouter.post('/import/preview', authMiddleware, requireRole('parent'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { familyId } = req.user!
    const file = req.file
    const parsedChildId = req.body.childId ? parseInt(req.body.childId, 10) : null

    if (!file) {
      throw new AppError(400, '请上传文件')
    }

    const { sheetName, rows, hyperlinks, columns } = extractImportWorkbook(file.buffer)
    const existingBookByKey = await getExistingBookKeyMap(familyId)
    const seenImportKeys = new Set<string>()
    const existingLogKeys = new Set<string>()

    let validRows = 0
    let skippedRows = 0
    let newBooks = 0
    let matchedBooks = 0
    let duplicatedInFile = 0
    let readingLogsEstimated = 0
    let readStatesEstimated = 0
    let coverUrls = 0
    const warnings: string[] = []
    const samples: Array<{
      row: number;
      name: string;
      isbn: string;
      action: 'new' | 'match' | 'skip';
      matchedBookId?: number;
      matchedBookName?: string;
      matchKey?: string;
      matchScore?: number;
      matchNeedsReview?: boolean;
      matchReason?: string;
      hasReadingLog: boolean;
      willMarkFinished: boolean;
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const excelRowNumber = i + 2
      const name = String(row['书名'] || '').trim()

      if (!name) {
        skippedRows++
        if (samples.length < 8) {
          samples.push({
            row: excelRowNumber,
            name: '',
            isbn: '',
            action: 'skip',
            hasReadingLog: false,
            willMarkFinished: false,
          })
        }
        continue
      }

      validRows++
      const isbn = cleanIsbn(String(row['ISBN'] || ''))
      const importKey = isbn ? `isbn:${isbn}` : `name:${normalizeBookName(name)}`
      const matchedBook = findMatchedImportBook(row, existingBookByKey, excelRowNumber)
      const action = matchedBook ? 'match' : 'new'
      const logData = buildReadingLogFromImportRow(row, familyId, matchedBook?.id || -(i + 1), parsedChildId)
      const willMarkFinished = Boolean(parsedChildId && shouldMarkImportedBookFinished(row))
      const coverUrl = getImportCoverUrl(row, hyperlinks, excelRowNumber)

      if (seenImportKeys.has(importKey)) duplicatedInFile++
      seenImportKeys.add(importKey)

      if (matchedBook) matchedBooks++
      else newBooks++
      if (logData) {
        readingLogsEstimated++
        if (matchedBook) {
          const dayStart = new Date(logData.readDate)
          dayStart.setHours(0, 0, 0, 0)
          existingLogKeys.add(`${matchedBook.id}:${logData.childId || 'none'}:${dayStart.toISOString().slice(0, 10)}`)
        }
      }
      if (willMarkFinished) readStatesEstimated++
      if (coverUrl) coverUrls++

      if (samples.length < 8) {
        samples.push({
          row: excelRowNumber,
          name,
          isbn,
          action,
          matchedBookId: matchedBook?.id,
          matchedBookName: matchedBook?.name,
          matchKey: matchedBook?.matchKey,
          matchScore: matchedBook?.matchScore,
          matchNeedsReview: matchedBook?.matchNeedsReview,
          matchReason: matchedBook?.matchReason,
          hasReadingLog: Boolean(logData),
          willMarkFinished,
        })
      }
    }

    let existingReadingLogs = 0
    if (existingLogKeys.size > 0) {
      const conditions = Array.from(existingLogKeys).map((key) => {
        const [bookId, childKey, dateKey] = key.split(':')
        const dayStart = new Date(`${dateKey}T00:00:00.000Z`)
        const dayEnd = new Date(dayStart)
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
        return {
          bookId: Number(bookId),
          childId: childKey === 'none' ? null : Number(childKey),
          readDate: { gte: dayStart, lt: dayEnd },
        }
      })
      existingReadingLogs = await prisma.readingLog.count({
        where: {
          familyId,
          OR: conditions,
        },
      })
    }

    if (!columns.includes('书名')) warnings.push('缺少“书名”列，无法识别的行会被跳过')
    if (!columns.includes('ISBN')) warnings.push('缺少“ISBN”列，系统会主要按书名匹配，重名书可能需要人工复核')
    if (!parsedChildId) warnings.push('当前未指定孩子，本次导入不会同步孩子的已读状态')
    if (duplicatedInFile > 0) warnings.push(`文件内存在 ${duplicatedInFile} 条重复书籍线索，导入时会优先匹配已有书籍`)

    const recognizedColumns = columns.filter((column) => IMPORT_RECOGNIZED_COLUMNS.includes(column))

    res.json({
      status: 'success',
      data: {
        fileName: file.originalname,
        sheetName,
        totalRows: rows.length,
        validRows,
        skippedRows,
        newBooks,
        matchedBooks,
        duplicatedInFile,
        readingLogsEstimated,
        readingLogsLikelyNew: Math.max(0, readingLogsEstimated - existingReadingLogs),
        existingReadingLogs,
        readStatesEstimated,
        coverUrls,
        columns,
        recognizedColumns,
        warnings,
        samples,
      },
    })
  } catch (error: any) {
    console.error('[IMPORT_PREVIEW] Error:', error)
    res.status(error.statusCode || 500).json({
      status: 'error',
      message: `导入预检失败: ${error.message}`,
    })
  }
})

/**
 * POST /import - Import books from Excel file
 */
libraryRouter.post('/import', authMiddleware, requireRole('parent'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { familyId, userId } = req.user!
    const file = req.file
    const { childId } = req.body
    const rejectedMatchKeys = new Set<string>()
    if (req.body.rejectedMatchKeys) {
      try {
        const parsed = JSON.parse(String(req.body.rejectedMatchKeys))
        if (Array.isArray(parsed)) {
          for (const key of parsed) {
            if (typeof key === 'string') rejectedMatchKeys.add(key)
          }
        }
      } catch {
        throw new AppError(400, '匹配确认数据格式错误')
      }
    }

    console.log(`[IMPORT] Starting import for family ${familyId}, childId: ${childId || 'none'}`)

    if (!file) {
      throw new AppError(400, '请上传文件')
    }

    console.log(`[IMPORT] File received: ${file.originalname}, size: ${file.size}`)

    const { rows: data, hyperlinks, columns } = extractImportWorkbook(file.buffer)

    console.log(`[IMPORT] Found ${data.length} rows in Excel`)
    
    // Log first row to debug column names
    if (data.length > 0) {
      console.log(`[IMPORT] First row columns:`, columns)
      console.log(`[IMPORT] First row data:`, data[0])
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
    const existingBookByKey = await getExistingBookKeyMap(familyId)
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
      let targetBook: any = findMatchedImportBook(row, existingBookByKey, i + 2, rejectedMatchKeys)

      // Map type
      const excelType = row['类型'] || row['书架分类'] || row['分类'] || ''
      const bookType = IMPORT_BOOK_TYPE_MAP[excelType] || 'children'
      const wordCount = firstNumber(row['字数'], row['wordCount'])
      const totalPages = firstNumber(row['页数'], row['总页数'], row['totalPages'])
      const readCount = firstNumber(row['阅读次数'], row['次数'], row['readCount'])
      const excelRowNumber = i + 2
      const coverUrl = getImportCoverUrl(row, hyperlinks, excelRowNumber)
      
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
          select: { id: true, name: true, isbn: true, author: true, publisher: true },
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
