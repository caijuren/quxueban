const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 查找包含"全新英语"的任务
  const tasks = await prisma.task.findMany({
    where: {
      name: {
        contains: '全新英语'
      }
    },
    include: {
      weeklyPlans: {
        where: {
          childId: 4 // 臭沫沫的ID
        }
      }
    }
  });
  
  console.log('找到的任务:');
  tasks.forEach(task => {
    console.log('任务名称:', task.name);
    console.log('任务分类:', task.category);
    task.weeklyPlans.forEach(plan => {
      console.log('  周计划ID:', plan.id);
      console.log('  assignedDays:', plan.assignedDays);
    });
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
