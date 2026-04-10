const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function emergencyDataCheck() {
  try {
    await prisma.$connect();
    console.log('========================================');
    console.log('🚨 紧急数据损坏评估报告');
    console.log('========================================\n');

    // 1. 查找所有孩子
    console.log('📋 第一步：查找家庭中的所有孩子');
    console.log('----------------------------------------');
    const children = await prisma.user.findMany({
      where: { role: 'child' },
      select: { id: true, name: true, familyId: true, createdAt: true }
    });
    console.log(`找到 ${children.length} 个孩子:`);
    children.forEach(child => {
      console.log(`  - ID: ${child.id}, 名字: ${child.name}, 家庭ID: ${child.familyId}`);
    });
    console.log();

    // 查找"臭沫沫"和"小胖子"
    const chouMomos = children.filter(c => c.name.includes('臭沫沫'));
    const xiaoPangzis = children.filter(c => c.name.includes('小胖子'));

    console.log(`🔍 找到 ${chouMomos.length} 个"臭沫沫":`);
    chouMomos.forEach(c => console.log(`  - ID: ${c.id}, 家庭ID: ${c.familyId}`));
    console.log();

    console.log(`🔍 找到 ${xiaoPangzis.length} 个"小胖子":`);
    xiaoPangzis.forEach(c => console.log(`  - ID: ${c.id}, 家庭ID: ${c.familyId}`));
    console.log();

    // 2. 检查任务表 (tasks)
    console.log('📋 第二步：检查任务表 (tasks)');
    console.log('----------------------------------------');
    const allTasks = await prisma.task.findMany({
      where: { isActive: true },
      select: { id: true, name: true, familyId: true, appliesTo: true, createdAt: true, updatedAt: true }
    });
    console.log(`总任务数: ${allTasks.length}`);

    // 检查每个臭沫沫的任务
    for (const chouMomo of chouMomos) {
      const chouMomoTasks = allTasks.filter(t => {
        const appliesTo = t.appliesTo || [];
        return appliesTo.includes(chouMomo.id);
      });
      console.log(`\n  臭沫沫 (ID: ${chouMomo.id}) 的任务:`);
      console.log(`    - 关联任务数: ${chouMomoTasks.length}`);
      chouMomoTasks.forEach(t => {
        console.log(`      • ${t.name} (ID: ${t.id}, 家庭ID: ${t.familyId}, 更新于: ${t.updatedAt})`);
      });
    }

    // 检查小胖子的任务
    for (const xiaoPangzi of xiaoPangzis) {
      const xiaoPangziTasks = allTasks.filter(t => {
        const appliesTo = t.appliesTo || [];
        return appliesTo.includes(xiaoPangzi.id);
      });
      console.log(`\n  小胖子 (ID: ${xiaoPangzi.id}) 的任务:`);
      console.log(`    - 关联任务数: ${xiaoPangziTasks.length}`);
      xiaoPangziTasks.forEach(t => {
        console.log(`      • ${t.name} (ID: ${t.id}, 家庭ID: ${t.familyId}, 更新于: ${t.updatedAt})`);
      });
    }
    console.log();

    // 3. 检查周计划表 (weekly_plans)
    console.log('📋 第三步：检查周计划表 (weekly_plans)');
    console.log('----------------------------------------');
    const currentWeekNo = getWeekNo(new Date());
    console.log(`当前周: ${currentWeekNo}`);

    for (const chouMomo of chouMomos) {
      const chouMomoPlans = await prisma.weeklyPlan.findMany({
        where: { childId: chouMomo.id },
        include: { task: true },
        orderBy: { weekNo: 'desc' }
      });
      console.log(`\n  臭沫沫 (ID: ${chouMomo.id}) 的周计划:`);
      console.log(`    - 总计划数: ${chouMomoPlans.length}`);

      // 按周分组
      const plansByWeek = {};
      chouMomoPlans.forEach(p => {
        if (!plansByWeek[p.weekNo]) plansByWeek[p.weekNo] = [];
        plansByWeek[p.weekNo].push(p);
      });

      Object.entries(plansByWeek).forEach(([week, plans]) => {
        console.log(`    - ${week}: ${plans.length} 个任务`);
        plans.slice(0, 3).forEach(p => {
          console.log(`      • ${p.task?.name || 'Unknown'} (进度: ${p.progress}/${p.target}, 状态: ${p.status})`);
        });
        if (plans.length > 3) console.log(`      ... 还有 ${plans.length - 3} 个任务`);
      });
    }

    for (const xiaoPangzi of xiaoPangzis) {
      const xiaoPangziPlans = await prisma.weeklyPlan.findMany({
        where: { childId: xiaoPangzi.id },
        include: { task: true },
        orderBy: { weekNo: 'desc' }
      });
      console.log(`\n  小胖子 (ID: ${xiaoPangzi.id}) 的周计划:`);
      console.log(`    - 总计划数: ${xiaoPangziPlans.length}`);

      const plansByWeek = {};
      xiaoPangziPlans.forEach(p => {
        if (!plansByWeek[p.weekNo]) plansByWeek[p.weekNo] = [];
        plansByWeek[p.weekNo].push(p);
      });

      Object.entries(plansByWeek).forEach(([week, plans]) => {
        console.log(`    - ${week}: ${plans.length} 个任务`);
        plans.slice(0, 3).forEach(p => {
          console.log(`      • ${p.task?.name || 'Unknown'} (进度: ${p.progress}/${p.target}, 状态: ${p.status})`);
        });
        if (plans.length > 3) console.log(`      ... 还有 ${plans.length - 3} 个任务`);
      });
    }
    console.log();

    // 4. 检查打卡记录 (daily_checkins)
    console.log('📋 第四步：检查打卡记录 (daily_checkins)');
    console.log('----------------------------------------');

    for (const chouMomo of chouMomos) {
      const chouMomoCheckins = await prisma.dailyCheckin.findMany({
        where: { childId: chouMomo.id },
        orderBy: { checkDate: 'desc' },
        take: 10
      });
      console.log(`\n  臭沫沫 (ID: ${chouMomo.id}) 的最近打卡:`);
      console.log(`    - 总打卡数: ${await prisma.dailyCheckin.count({ where: { childId: chouMomo.id } })}`);
      chouMomoCheckins.forEach(c => {
        console.log(`      • ${c.checkDate.toISOString().split('T')[0]} - 任务ID: ${c.taskId}, 状态: ${c.status}`);
      });
    }

    for (const xiaoPangzi of xiaoPangzis) {
      const xiaoPangziCheckins = await prisma.dailyCheckin.findMany({
        where: { childId: xiaoPangzi.id },
        orderBy: { checkDate: 'desc' },
        take: 10
      });
      console.log(`\n  小胖子 (ID: ${xiaoPangzi.id}) 的最近打卡:`);
      console.log(`    - 总打卡数: ${await prisma.dailyCheckin.count({ where: { childId: xiaoPangzi.id } })}`);
      xiaoPangziCheckins.forEach(c => {
        console.log(`      • ${c.checkDate.toISOString().split('T')[0]} - 任务ID: ${c.taskId}, 状态: ${c.status}`);
      });
    }
    console.log();

    // 5. 数据隔离问题检查
    console.log('📋 第五步：数据隔离问题检查');
    console.log('----------------------------------------');

    // 检查是否有家庭混用
    const familyIds = [...new Set(children.map(c => c.familyId))];
    console.log(`发现 ${familyIds.length} 个家庭: ${familyIds.join(', ')}`);

    for (const familyId of familyIds) {
      const familyChildren = children.filter(c => c.familyId === familyId);
      console.log(`\n  家庭 ${familyId} 有 ${familyChildren.length} 个孩子:`);
      familyChildren.forEach(c => console.log(`    - ${c.name} (ID: ${c.id})`));

      // 检查该家庭的任务
      const familyTasks = allTasks.filter(t => t.familyId === familyId);
      console.log(`  该家庭任务数: ${familyTasks.length}`);

      // 检查任务是否明确分配给孩子
      const tasksWithAppliesTo = familyTasks.filter(t => t.appliesTo && t.appliesTo.length > 0);
      const tasksWithoutAppliesTo = familyTasks.filter(t => !t.appliesTo || t.appliesTo.length === 0);
      console.log(`    - 已明确分配给孩子: ${tasksWithAppliesTo.length}`);
      console.log(`    - 未明确分配(所有孩子可见): ${tasksWithoutAppliesTo.length}`);

      if (tasksWithoutAppliesTo.length > 0) {
        console.log(`    ⚠️ 警告: 有 ${tasksWithoutAppliesTo.length} 个任务未明确分配给孩子，可能导致数据混乱！`);
        tasksWithoutAppliesTo.forEach(t => {
          console.log(`      • ${t.name} (ID: ${t.id})`);
        });
      }
    }
    console.log();

    // 6. 最近修改记录
    console.log('📋 第六步：最近修改记录');
    console.log('----------------------------------------');
    const recentUpdatedTasks = await prisma.task.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, name: true, appliesTo: true, updatedAt: true }
    });
    console.log('最近修改的10个任务:');
    recentUpdatedTasks.forEach(t => {
      const appliesToStr = t.appliesTo ? t.appliesTo.join(', ') : '未分配';
      console.log(`  • ${t.name} (ID: ${t.id}, 分配给: ${appliesToStr}, 更新于: ${t.updatedAt})`);
    });

    console.log('\n========================================');
    console.log('✅ 数据评估完成');
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

emergencyDataCheck();
