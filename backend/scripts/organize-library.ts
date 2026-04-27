import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs/promises'
import { prisma } from '../src/config/database'

const APPLY = process.argv.includes('--apply')
const EXCEL_PATH = path.resolve(process.cwd(), '../亲子共读.xlsx')

function norm(value: unknown) {
  return String(value || '')
    .replace(/[《》<>【】]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase()
}

function cleanName(value: unknown) {
  return String(value || '').replace(/[《》<>【】]/g, '').trim()
}

function limit(value: unknown, max: number) {
  const text = String(value || '').trim()
  return text.length > max ? text.slice(0, max) : text
}

function parseDate(value: unknown) {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d)
  }
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function typeFromExcel(value: unknown) {
  const raw = String(value || '')
  if (raw.includes('传统')) return 'tradition'
  if (raw.includes('科普')) return 'science'
  if (raw.includes('性格')) return 'character'
  return 'children'
}

async function main() {
  const parent = await prisma.user.findFirst({ where: { role: 'parent', status: 'active' }, select: { familyId: true } })
  if (!parent) throw new Error('No active parent family found')

  const familyId = parent.familyId
  const childGroups = await prisma.book.groupBy({
    by: ['childId'],
    where: { familyId, status: 'active' },
    _count: { _all: true },
    orderBy: { _count: { childId: 'desc' } },
  })
  const childId = childGroups.find(group => group.childId)? childGroups.find(group => group.childId)!.childId! : 3

  const workbook = XLSX.readFile(EXCEL_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

  const books = await prisma.book.findMany({
    where: { familyId, status: 'active' },
    include: {
      readingLogs: { select: { id: true } },
      bookReadStates: { select: { id: true, status: true, childId: true, finishedAt: true } },
      activeReadings: { select: { id: true, childId: true, status: true } },
    },
  })

  const groups = new Map<string, typeof books>()
  for (const book of books) {
    const isbn = String(book.isbn || '').replace(/[\s-]/g, '')
    const key = isbn ? `isbn:${isbn}` : `name:${norm(book.name)}|author:${norm(book.author)}`
    const group = groups.get(key) || []
    group.push(book)
    groups.set(key, group)
  }

  const canonicalByKey = new Map<string, typeof books[number]>()
  let duplicateBooks = 0
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const aScore = (a.coverUrl ? 100 : 0) + a.readingLogs.length * 10 - a.id / 100000
      const bScore = (b.coverUrl ? 100 : 0) + b.readingLogs.length * 10 - b.id / 100000
      return bScore - aScore
    })
    canonicalByKey.set(key, sorted[0])
    duplicateBooks += Math.max(0, sorted.length - 1)
  }

  const excelKeys = new Map<string, Record<string, any>[]>()
  for (const row of rows) {
    const name = cleanName(row['书名'])
    if (!name) continue
    const author = String(row['作者'] || '').trim()
    const key = `name:${norm(name)}|author:${norm(author)}`
    const group = excelKeys.get(key) || []
    group.push(row)
    excelKeys.set(key, group)
  }

  let booksToCreate = 0
  let booksToUpdate = 0
  let booksToDeactivate = 0
  let logsToCreate = 0
  let statesToUpsert = 0

  const backup = {
    createdAt: new Date().toISOString(),
    apply: APPLY,
    familyId,
    childId,
    duplicateGroups: [...groups.values()].filter(group => group.length > 1).length,
    duplicateBooks,
    totalActiveBooks: books.length,
    excelRows: rows.length,
  }

  if (APPLY) {
    await fs.mkdir(path.resolve(process.cwd(), '../tmp'), { recursive: true })
    await fs.writeFile(path.resolve(process.cwd(), '../tmp/library-organize-backup.json'), JSON.stringify(books, null, 2))
  }

  await prisma.$transaction(async tx => {
    for (const [key, group] of groups) {
      if (group.length <= 1) continue
      const canonical = canonicalByKey.get(key)!
      const duplicates = group.filter(book => book.id !== canonical.id)
      booksToDeactivate += duplicates.length

      if (!APPLY) continue

      for (const duplicate of duplicates) {
        await tx.readingLog.updateMany({ where: { bookId: duplicate.id }, data: { bookId: canonical.id } })
        await tx.bookAIInsight.updateMany({ where: { bookId: duplicate.id }, data: { bookId: canonical.id } })

        for (const state of duplicate.bookReadStates) {
          const existing = await tx.bookReadState.findFirst({ where: { bookId: canonical.id, childId: state.childId } })
          if (!existing) {
            await tx.bookReadState.update({ where: { id: state.id }, data: { bookId: canonical.id } })
          } else {
            if (state.status === 'finished' && existing.status !== 'finished') {
              await tx.bookReadState.update({ where: { id: existing.id }, data: { status: 'finished', finishedAt: state.finishedAt || new Date() } })
            }
            await tx.bookReadState.delete({ where: { id: state.id } })
          }
        }

        for (const active of duplicate.activeReadings) {
          const existing = await tx.activeReading.findFirst({ where: { bookId: canonical.id, childId: active.childId, status: active.status } })
          if (!existing) {
            await tx.activeReading.update({ where: { id: active.id }, data: { bookId: canonical.id } })
          } else {
            await tx.activeReading.delete({ where: { id: active.id } })
          }
        }

        await tx.book.update({ where: { id: duplicate.id }, data: { status: 'inactive' } })
      }
    }

    for (const [key, groupRows] of excelKeys) {
      let canonical = canonicalByKey.get(key)
      const first = groupRows[0]
      const name = limit(cleanName(first['书名']), 200)
      const author = limit(first['作者'], 100)
      const cover = limit(first['封面'], 255)
      const usableCover = /^https?:\/\//.test(cover) ? cover : ''

      if (!canonical) {
        booksToCreate++
        if (APPLY) {
          canonical = await tx.book.create({
            data: {
              familyId,
              childId,
              name,
              author,
              type: typeFromExcel(first['类型']),
              coverUrl: usableCover,
              totalPages: 0,
            },
          }) as any
          canonicalByKey.set(key, canonical)
        }
      } else {
        const data: any = {}
        if (!canonical.author && author) data.author = author
        if (!canonical.coverUrl && usableCover) data.coverUrl = usableCover
        if (canonical.type === 'fiction' || !canonical.type) data.type = typeFromExcel(first['类型'])
        if (Object.keys(data).length > 0) {
          booksToUpdate++
          if (APPLY) await tx.book.update({ where: { id: canonical.id }, data })
        }
      }

      if (!canonical && !APPLY) {
        logsToCreate += groupRows.length
        continue
      }

      for (const row of groupRows) {
        const readDate = parseDate(row['日期'])
        const note = limit(row['摘要'], 500)
        const performance = limit(row['Yumo表现'], 200)
        const readStage = limit(row['阅读阶段'], 50)
        logsToCreate++
        statesToUpsert += String(row['状态'] || '').includes('已读完') ? 1 : 0

        if (!APPLY) continue

        const exists = await tx.readingLog.findFirst({
          where: {
            familyId,
            childId,
            bookId: canonical!.id,
            readDate,
            readStage,
          },
        })

        if (!exists) {
          await tx.readingLog.create({
            data: {
              familyId,
              childId,
              bookId: canonical!.id,
              readDate,
              effect: limit(row['阅读效果'], 50),
              performance,
              note,
              readStage,
              tags: [],
            },
          })
        }

        if (String(row['状态'] || '').includes('已读完')) {
          await tx.bookReadState.upsert({
            where: { childId_bookId: { childId, bookId: canonical!.id } },
            update: { status: 'finished', finishedAt: readDate },
            create: { familyId, childId, bookId: canonical!.id, status: 'finished', finishedAt: readDate },
          })
        }
      }
    }
  }, { timeout: 120000 })

  console.log(JSON.stringify({
    ...backup,
    mode: APPLY ? 'apply' : 'dry-run',
    booksToCreate,
    booksToUpdate,
    booksToDeactivate,
    logsToCreate,
    statesToUpsert,
    backupPath: APPLY ? '../tmp/library-organize-backup.json' : null,
  }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
