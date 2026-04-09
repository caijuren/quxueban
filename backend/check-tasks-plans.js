const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTasksAndPlans() {
  try {
    // 连接数据库
    await prisma.$connect();
    console.log('Connected to database');

    // 查询任务数量
    const taskCount = await prisma.task.count({ where: { isActive: true } });
    console.log('Active tasks count:', taskCount);

    // 查询前5个任务
    const tasks = await prisma.task.findMany({ 
      where: { isActive: true }, 
      take: 5 
    });
    console.log('Sample tasks:', tasks);

    // 查询周计划数量
    const weeklyPlanCount = await prisma.weeklyPlan.count();
    console.log('Weekly plans count:', weeklyPlanCount);

    // 查询前5个周计划
    const weeklyPlans = await prisma.weeklyPlan.findMany({ 
      take: 5 
    });
    console.log('Sample weekly plans:', weeklyPlans);

    // 断开连接
    await prisma.$disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkTasksAndPlans();
