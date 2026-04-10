const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupAllData() {
  try {
    await prisma.$connect();
    console.log('========================================');
    console.log('🧹 清理所有任务和计划数据');
    console.log('========================================\n');

    // 1. 获取当前数据统计
    console.log('📊 当前数据统计:');
    console.log('----------------------------------------');
    
    const taskCount = await prisma.task.count({ where: { isActive: true } });
    const weeklyPlanCount = await prisma.weeklyPlan.count();
    const checkinCount = await prisma.dailyCheckin.count();
    
    console.log(`- 活跃任务数: ${taskCount}`);
    console.log(`- 周计划数: ${weeklyPlanCount}`);
    console.log(`- 打卡记录数: ${checkinCount}`);
    console.log();

    if (taskCount === 0 && weeklyPlanCount === 0 && checkinCount === 0) {
      console.log('✅ 数据已经是空的，无需清理');
      await prisma.$disconnect();
      return;
    }

    // 2. 开始清理
    console.log('🧹 开始清理数据:');
    console.log('----------------------------------------');

    // 先删除打卡记录（外键依赖）
    console.log('1. 删除打卡记录...');
    const deletedCheckins = await prisma.dailyCheckin.deleteMany();
    console.log(`   删除了 ${deletedCheckins.count} 条打卡记录`);

    // 再删除周计划（外键依赖）
    console.log('2. 删除周计划...');
    const deletedPlans = await prisma.weeklyPlan.deleteMany();
    console.log(`   删除了 ${deletedPlans.count} 个周计划`);

    // 最后删除任务
    console.log('3. 删除任务...');
    const deletedTasks = await prisma.task.deleteMany();
    console.log(`   删除了 ${deletedTasks.count} 个任务`);

    // 4. 验证清理结果
    console.log('\n✅ 清理完成，验证结果:');
    console.log('----------------------------------------');
    
    const afterTaskCount = await prisma.task.count({ where: { isActive: true } });
    const afterWeeklyPlanCount = await prisma.weeklyPlan.count();
    const afterCheckinCount = await prisma.dailyCheckin.count();
    
    console.log(`- 活跃任务数: ${afterTaskCount}`);
    console.log(`- 周计划数: ${afterWeeklyPlanCount}`);
    console.log(`- 打卡记录数: ${afterCheckinCount}`);
    console.log();

    if (afterTaskCount === 0 && afterWeeklyPlanCount === 0 && afterCheckinCount === 0) {
      console.log('✅ 清理成功！所有任务和计划数据已删除');
      console.log('   您现在可以重新创建任务和计划了');
    } else {
      console.log('❌ 清理失败，仍有数据残留');
    }

    console.log('\n========================================');
    console.log('🧹 清理完成');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 清理过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupAllData();
