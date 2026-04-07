// 快速诊断脚本：检查数据库中的 assignedDays 数据
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWeeklyPlans() {
  console.log('=== 检查数据库中的 WeeklyPlan 数据 ===\n');
  
  try {
    // 获取所有活跃的周计划
    const plans = await prisma.weeklyPlan.findMany({
      where: { status: 'active' },
      include: { task: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    console.log(`找到 ${plans.length} 条活跃的周计划\n`);
    
    plans.forEach((plan, index) => {
      console.log(`\n${index + 1}. 任务: ${plan.task.name}`);
      console.log(`   - taskId: ${plan.taskId}`);
      console.log(`   - target: ${plan.target}`);
      console.log(`   - progress: ${plan.progress}`);
      console.log(`   - assignedDays: ${JSON.stringify(plan.assignedDays)}`);
      console.log(`   - scheduleRule: ${plan.task.scheduleRule}`);
      
      const weeklyRule = plan.task.weeklyRule;
      console.log(`   - weeklyRule: ${JSON.stringify(weeklyRule)}`);
      
      // 检查 assignedDays 是否为 null
      if (plan.assignedDays === null) {
        console.log(`   ⚠️  警告：assignedDays 为 null，说明数据未保存`);
      } else if (Array.isArray(plan.assignedDays)) {
        console.log(`   ✅ assignedDays 已保存，值为: [${plan.assignedDays.join(', ')}]`);
        
        // 检查索引含义
        plan.assignedDays.forEach(day => {
          const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          console.log(`      - ${day} = ${dayNames[day]}`);
        });
      }
    });
    
    console.log('\n=== 诊断完成 ===\n');
    console.log('如果看到 assignedDays 为 null，说明：');
    console.log('1. 数据库字段已添加，但旧数据没有 assignedDays');
    console.log('2. 需要重新发布计划才能保存 assignedDays');
    console.log('\n如果 assignedDays 有值，请检查索引是否正确：');
    console.log('- 周末任务应该是 [0, 6]（周日和周六）');
    console.log('- 或 [5, 6]（周六和周日）');
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWeeklyPlans();