const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 模拟 /today 接口的查询逻辑
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = new Date(todayStr + 'T00:00:00.000Z');
  
  console.log('今天的日期字符串:', todayStr);
  console.log('今天的Date对象:', today.toISOString());
  
  const todayStart = new Date(todayStr + 'T00:00:00.000Z');
  const todayEnd = new Date(todayStr + 'T23:59:59.999Z');
  
  console.log('todayStart:', todayStart.toISOString());
  console.log('todayEnd:', todayEnd.toISOString());
  
  // 查询今天的打卡记录
  const todayCheckins = await prisma.dailyCheckin.findMany({
    where: {
      childId: 4,  // 臭沫沫的ID
      checkDate: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: {
      plan: {
        include: { task: true },
      },
    },
  });
  
  console.log('\n查询到的今天打卡记录:', todayCheckins.length);
  todayCheckins.forEach(c => {
    console.log('  -', c.plan?.task?.name, ':', c.status, 'checkDate:', c.checkDate.toISOString());
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
