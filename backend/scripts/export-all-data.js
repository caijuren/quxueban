const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function exportAllData() {
  try {
    await prisma.$connect();
    console.log('========================================');
    console.log('📊 任务和计划完整数据导出');
    console.log('========================================\n');

    // 1. 获取所有孩子
    const children = await prisma.user.findMany({
      where: { role: 'child' },
      select: { id: true, name: true, familyId: true, createdAt: true }
    });

    console.log('👶 孩子列表:');
    children.forEach(child => {
      console.log(`  - ${child.name} (ID: ${child.id}, 家庭ID: ${child.familyId})`);
    });
    console.log();

    // 2. 获取所有任务
    console.log('📋 所有任务:');
    console.log('----------------------------------------');
    const allTasks = await prisma.task.findMany({
      where: { isActive: true },
      select: { 
        id: true, 
        name: true, 
        category: true, 
        type: true, 
        timePerUnit: true, 
        appliesTo: true,
        tags: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`共 ${allTasks.length} 个活跃任务:\n`);

    allTasks.forEach(task => {
      const assignedChildren = task.appliesTo.map(childId => {
        const child = children.find(c => c.id === childId);
        return child ? child.name : `ID: ${childId}`;
      }).join(', ');

      console.log(`  📌 ${task.name}`);
      console.log(`     ID: ${task.id}`);
      console.log(`     类别: ${task.category}`);
      console.log(`     类型: ${task.type}`);
      console.log(`     时长: ${task.timePerUnit} 分钟`);
      console.log(`     分配给: ${assignedChildren || '未分配'}`);
      console.log(`     标签: ${JSON.stringify(task.tags || {})}`);
      console.log(`     创建于: ${task.createdAt.toISOString().split('T')[0]}`);
      console.log(`     更新于: ${task.updatedAt.toISOString().split('T')[0]}`);
      console.log();
    });

    // 3. 获取当前周的周计划
    console.log('📅 当前周计划:');
    console.log('----------------------------------------');
    const currentWeekNo = getWeekNo(new Date());
    console.log(`当前周: ${currentWeekNo}\n`);

    for (const child of children) {
      console.log(`  ${child.name} 的周计划:`);
      console.log('  ----------------------------------------');
      
      const weeklyPlans = await prisma.weeklyPlan.findMany({
        where: { childId: child.id, weekNo: currentWeekNo },
        include: { task: true },
        orderBy: { id: 'asc' }
      });

      if (weeklyPlans.length === 0) {
        console.log('  📭 无周计划\n');
        continue;
      }

      console.log('  任务清单:');
      weeklyPlans.forEach(plan => {
        const assignedDays = plan.assignedDays || [];
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const daysStr = assignedDays.map(day => dayNames[day]).join(', ');
        
        console.log(`    • ${plan.task.name}`);
        console.log(`      进度: ${plan.progress}/${plan.target}`);
        console.log(`      状态: ${plan.status}`);
        console.log(`      分配天数: ${daysStr || '全周'}`);
        console.log();
      });
    }

    // 4. 获取最近的打卡记录
    console.log('✅ 最近打卡记录:');
    console.log('----------------------------------------');
    
    for (const child of children) {
      console.log(`  ${child.name} 的最近打卡:`);
      console.log('  ----------------------------------------');
      
      const checkins = await prisma.dailyCheckin.findMany({
        where: { childId: child.id },
        include: { plan: { include: { task: true } } },
        orderBy: { checkDate: 'desc' },
        take: 10
      });

      if (checkins.length === 0) {
        console.log('  📭 无打卡记录\n');
        continue;
      }

      checkins.forEach(checkin => {
        console.log(`    • ${checkin.checkDate.toISOString().split('T')[0]}`);
        console.log(`      任务: ${checkin.plan?.task?.name || '未知'}`);
        console.log(`      状态: ${checkin.status}`);
        console.log(`      备注: ${checkin.notes || '无'}`);
        console.log();
      });
    }

    // 5. 统计信息
    console.log('📊 统计信息:');
    console.log('----------------------------------------');
    console.log(`总任务数: ${allTasks.length}`);
    
    for (const child of children) {
      const childTasks = allTasks.filter(t => t.appliesTo.includes(child.id));
      const childPlans = await prisma.weeklyPlan.count({ 
        where: { childId: child.id, weekNo: currentWeekNo } 
      });
      const childCheckins = await prisma.dailyCheckin.count({ where: { childId: child.id } });
      
      console.log(`${child.name}:`);
      console.log(`  - 任务数: ${childTasks.length}`);
      console.log(`  - 周计划数: ${childPlans}`);
      console.log(`  - 打卡记录: ${childCheckins}`);
    }

    console.log('\n========================================');
    console.log('✅ 数据导出完成');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function getWeekNo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${weekNum.toString().padStart(2, '0')}`;
}

exportAllData();
