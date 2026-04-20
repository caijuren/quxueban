const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findFirst({ where: { name: 'andycoy' } });
    console.log('andycoy账号查询结果:', user ? '存在' : '不存在');
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();