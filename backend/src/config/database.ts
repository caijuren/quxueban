import { PrismaClient } from '@prisma/client'
import { env } from './env'

const prismaClientSingleton = () => {
  if (!env.DATABASE_URL) {
    // Create a mock Prisma client when no database URL is provided
    return {
      $disconnect: async () => {}
    } as PrismaClient
  }
  return new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

// Graceful shutdown
process.on('beforeExit', async () => {
  if (env.DATABASE_URL) {
    await prisma.$disconnect()
  }
})
