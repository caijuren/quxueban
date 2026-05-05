import { prisma } from '../config/database'

beforeAll(async () => {
  // Setup test database
})

afterAll(async () => {
  await prisma.$disconnect()
})

afterEach(async () => {
  if (process.env.SKIP_DB_CLEANUP === 'true' || !process.env.DATABASE_URL) {
    return
  }

  // Clean up test data
  const deleteOperations = Object.values(prisma).filter(
    value => typeof value === 'object' && value !== null && 'deleteMany' in value
  )

  await Promise.all(deleteOperations.map((model: any) => model.deleteMany()))
})
