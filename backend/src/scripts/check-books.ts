import { prisma } from '../config/database'

async function checkBooks() {
  const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM books`
  console.log('Books count:', count)

  const books = await prisma.$queryRaw`SELECT id, name, family_id, child_id, type, status FROM books LIMIT 10`
  console.log('Books:', books)
}

checkBooks()
  .catch(console.error)
  .finally(() => process.exit(0))
