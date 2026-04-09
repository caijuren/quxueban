const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBooks() {
  try {
    // 连接数据库
    await prisma.$connect();
    console.log('Connected to database');

    // 查询图书数量
    const count = await prisma.book.count({ where: { status: 'active' } });
    console.log('Active books count:', count);

    // 查询前10本图书
    const books = await prisma.book.findMany({ 
      where: { status: 'active' }, 
      take: 10 
    });
    console.log('Sample books:', books);

    // 断开连接
    await prisma.$disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkBooks();
