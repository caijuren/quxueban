import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normalizeBookName(value: string): string {
  return value.replace(/[《》【】「」""'']/g, '').trim()
}

function parseRequiredNumber(name: string): number {
  const value = process.env[name]
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

async function main() {
  const familyId = parseRequiredNumber('FAMILY_ID')
  const childId = parseRequiredNumber('CHILD_ID')
  const bookName = process.env.BOOK_NAME || '封神演义'
  const normalizedBookName = normalizeBookName(bookName)

  const book = await prisma.book.findFirst({
    where: {
      familyId,
      status: 'active',
      OR: [
        { name: bookName },
        { name: `《${normalizedBookName}》` },
        { name: { contains: normalizedBookName } },
      ],
    },
    select: {
      id: true,
      familyId: true,
      name: true,
      readingLogs: {
        where: { childId },
        orderBy: { readDate: 'desc' },
        take: 1,
        select: { endPage: true, readDate: true },
      },
    },
  })

  if (!book) {
    throw new Error(`Book not found: familyId=${familyId}, name=${bookName}`)
  }

  const latestLog = book.readingLogs[0]
  const readPages = latestLog?.endPage || 0

  const result = await prisma.$transaction(async (tx) => {
    const readState = await tx.bookReadState.upsert({
      where: {
        childId_bookId: {
          childId,
          bookId: book.id,
        },
      },
      update: {
        status: 'reading',
        finishedAt: null,
      },
      create: {
        familyId,
        childId,
        bookId: book.id,
        status: 'reading',
        finishedAt: null,
      },
    })

    await tx.activeReading.updateMany({
      where: {
        familyId,
        childId,
        bookId: book.id,
        status: { not: 'reading' },
      },
      data: {
        status: 'merged',
      },
    })

    const activeReading = await tx.activeReading.upsert({
      where: {
        childId_bookId_status: {
          childId,
          bookId: book.id,
          status: 'reading',
        },
      },
      update: {
        readPages,
        completedAt: null,
      },
      create: {
        familyId,
        childId,
        bookId: book.id,
        readPages,
        readCount: book.readingLogs.length > 0 ? 1 : 0,
        status: 'reading',
        completedAt: null,
      },
    })

    return { readState, activeReading }
  })

  console.log(JSON.stringify({
    status: 'success',
    message: `${book.name} 已改为在读中`,
    data: {
      familyId,
      childId,
      bookId: book.id,
      readPages,
      readStateId: result.readState.id,
      activeReadingId: result.activeReading.id,
    },
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
