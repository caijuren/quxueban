const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    // Count books before deletion
    const countBefore = await prisma.book.count();
    console.log('Books count before:', countBefore);

    // Delete all books
    await prisma.book.deleteMany({});
    console.log('All books deleted');

    // Count books after deletion
    const countAfter = await prisma.book.count();
    console.log('Books count after:', countAfter);

    // Delete all reading logs
    await prisma.readingLog.deleteMany({});
    console.log('All reading logs deleted');

    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();