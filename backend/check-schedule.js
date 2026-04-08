const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // 查看任务模板的完整结构
  const templates = await prisma.taskTemplate.findMany({
    select: { id: true, name: true, type: true, scheduleRule: true, subject: true }
  });
  console.log('任务模板:', templates);
  
  // 查看孩子任务的完整结构
  const childTasks = await prisma.childTask.findMany({
    include: {
      taskTemplate: {
        select: { scheduleRule: true, name: true, type: true }
      }
    }
  });
  console.log('\n孩子任务:', childTasks);
  
  await prisma.$disconnect();
}

check();
