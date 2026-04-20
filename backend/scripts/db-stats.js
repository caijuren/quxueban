const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getStats() {
  try {
    console.log('=== 数据库统计信息 ===');
    
    const users = await prisma.user.count();
    console.log('账户数:', users);
    
    const children = await prisma.user.count({ where: { role: 'child' } });
    console.log('孩子信息数:', children);
    
    const tasks = await prisma.task.count();
    console.log('任务数:', tasks);
    
    const plans = await prisma.weeklyPlan.count();
    console.log('周计划数:', plans);
    
    const books = await prisma.book.count();
    console.log('图书数:', books);
    
    const readingLogs = await prisma.readingLog.count();
    console.log('阅读记录数:', readingLogs);
    
    const activeReadings = await prisma.activeReading.count();
    console.log('活跃阅读数:', activeReadings);
    
    const families = await prisma.family.count();
    console.log('家庭数:', families);
    
    console.log('=== 数据统计完成 ===');
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getStats();