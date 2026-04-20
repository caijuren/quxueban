const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('=== 开始重置任务和计划数据 ===');
    
    // 1. 清理现有的周计划
    console.log('清理现有周计划...');
    await prisma.weeklyPlan.deleteMany({});
    console.log('周计划清理完成');
    
    // 2. 清理现有的任务
    console.log('清理现有任务...');
    await prisma.task.deleteMany({});
    console.log('任务清理完成');
    
    // 3. 创建新的任务（基于用户提供的第二张图）
    console.log('创建新任务...');
    
    const tasks = [
      // 语文任务
      {
        name: '古文学习',
        category: 'chinese',
        type: 'fixed',
        timePerUnit: 30,
        tags: { subject: 'chinese', parentRole: 'accompany', difficulty: 'advanced', scheduleRule: 'daily' },
        appliesTo: [2, 3],
        scheduleRule: 'daily'
      },
      {
        name: '校内巩固',
        category: 'school',
        type: 'fixed',
        timePerUnit: 25,
        tags: { subject: 'chinese', parentRole: 'independent', difficulty: 'basic', scheduleRule: 'school' },
        appliesTo: [2, 3],
        scheduleRule: 'school'
      },
      {
        name: '亲子共读',
        category: 'chinese',
        type: 'flexible',
        timePerUnit: 20,
        tags: { subject: 'chinese', parentRole: 'accompany', difficulty: 'basic', scheduleRule: 'daily' },
        appliesTo: [2, 3],
        scheduleRule: 'daily'
      },
      {
        name: '自主阅读',
        category: 'chinese',
        type: 'flexible',
        timePerUnit: 15,
        tags: { subject: 'chinese', parentRole: 'independent', difficulty: 'basic', scheduleRule: 'daily' },
        appliesTo: [2, 3],
        scheduleRule: 'daily'
      },
      {
        name: '校内巩固',
        category: 'school',
        type: 'fixed',
        timePerUnit: 25,
        tags: { subject: 'chinese', parentRole: 'independent', difficulty: 'basic', scheduleRule: 'school' },
        appliesTo: [2, 3],
        scheduleRule: 'school'
      },
      {
        name: '语文一课一练基础版',
        category: 'school',
        type: 'fixed',
        timePerUnit: 20,
        tags: { subject: 'chinese', parentRole: 'independent', difficulty: 'basic', scheduleRule: 'school' },
        appliesTo: [2, 3],
        scheduleRule: 'school'
      },
      
      // 数学任务
      {
        name: '高思数学上',
        category: 'advanced',
        type: 'fixed',
        timePerUnit: 30,
        tags: { subject: 'math', parentRole: 'accompany', difficulty: 'advanced', scheduleRule: 'weekend' },
        appliesTo: [2, 3],
        scheduleRule: 'weekend'
      },
      {
        name: '数学五年级学霸',
        category: 'advanced',
        type: 'flexible',
        timePerUnit: 25,
        tags: { subject: 'math', parentRole: 'accompany', difficulty: 'advanced', scheduleRule: 'weekend' },
        appliesTo: [2, 3],
        scheduleRule: 'weekend'
      },
      {
        name: '数学拓展训练',
        category: 'advanced',
        type: 'flexible',
        timePerUnit: 20,
        tags: { subject: 'math', parentRole: 'accompany', difficulty: 'advanced', scheduleRule: 'weekend' },
        appliesTo: [2, 3],
        scheduleRule: 'weekend'
      },
      {
        name: '数学一课一练基础版',
        category: 'school',
        type: 'fixed',
        timePerUnit: 20,
        tags: { subject: 'math', parentRole: 'independent', difficulty: 'basic', scheduleRule: 'school' },
        appliesTo: [2, 3],
        scheduleRule: 'school'
      },
      
      // 英语任务
      {
        name: '口语领航',
        category: 'english',
        type: 'fixed',
        timePerUnit: 20,
        tags: { subject: 'english', parentRole: 'accompany', difficulty: 'basic', scheduleRule: 'daily' },
        appliesTo: [2, 3],
        scheduleRule: 'daily'
      },
      {
        name: '全新英语听力基础版',
        category: 'english',
        type: 'fixed',
        timePerUnit: 15,
        tags: { subject: 'english', parentRole: 'independent', difficulty: 'basic', scheduleRule: 'school' },
        appliesTo: [2, 3],
        scheduleRule: 'school'
      },
      {
        name: 'Oxford Discover 1',
        category: 'english',
        type: 'flexible',
        timePerUnit: 25,
        tags: { subject: 'english', parentRole: 'accompany', difficulty: 'advanced', scheduleRule: 'weekend' },
        appliesTo: [2, 3],
        scheduleRule: 'weekend'
      },
      {
        name: 'ABC Reading',
        category: 'english',
        type: 'flexible',
        timePerUnit: 15,
        tags: { subject: 'english', parentRole: 'independent', difficulty: 'basic', scheduleRule: 'daily' },
        appliesTo: [2, 3],
        scheduleRule: 'daily'
      }
    ];
    
    const createdTasks = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const createdTask = await prisma.task.create({
        data: {
          familyId: 1,
          ...task,
          sortOrder: i,
          isActive: true
        }
      });
      createdTasks.push(createdTask);
      console.log(`创建任务: ${createdTask.name}`);
    }
    
    console.log(`共创建 ${createdTasks.length} 个任务`);
    
    // 4. 生成本周的周计划
    console.log('生成周计划...');
    
    const today = new Date();
    const weekNo = getWeekNo(today);
    const children = [2, 3]; // 小胖子和臭沫沫
    
    for (const childId of children) {
      console.log(`为孩子 ${childId} 生成周计划...`);
      
      for (const task of createdTasks) {
        // 根据 scheduleRule 确定分配的天数
        let assignedDays = [];
        
        switch (task.scheduleRule) {
          case 'daily':
            assignedDays = [0, 1, 2, 3, 4, 5, 6]; // 每天
            break;
          case 'school':
            assignedDays = [1, 2, 4, 5]; // 周一、周二、周四、周五
            break;
          case 'weekend':
            assignedDays = [0, 6]; // 周日、周六
            break;
          case 'flexible':
            assignedDays = [1, 2, 3, 4, 5]; // 周一到周五
            break;
          default:
            assignedDays = [0, 1, 2, 3, 4, 5, 6];
        }
        
        await prisma.weeklyPlan.create({
          data: {
            familyId: 1,
            childId,
            taskId: task.id,
            target: assignedDays.length,
            progress: 0,
            weekNo,
            status: assignedDays.length > 0 ? 'active' : 'inactive',
            assignedDays
          }
        });
        
        console.log(`  为任务 ${task.name} 分配了 ${assignedDays.length} 天`);
      }
    }
    
    console.log('周计划生成完成');
    console.log('=== 任务和计划数据重置完成 ===');
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 获取周数
function getWeekNo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${weekNum.toString().padStart(2, '0')}`;
}

main();
