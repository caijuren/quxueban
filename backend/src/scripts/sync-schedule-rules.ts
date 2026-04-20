import { prisma } from '../config/database'

async function syncScheduleRules() {
  console.log('开始同步 schedule_rule 字段...')

  // 获取所有任务
  const tasks = await prisma.$queryRaw`
    SELECT id, name, tags, schedule_rule FROM tasks WHERE is_active = true
  ` as any[]

  console.log(`找到 ${tasks.length} 个任务`)

  for (const task of tasks) {
    // 从 tags 中提取 scheduleRule
    let taskTags = task.tags || {}
    if (typeof taskTags === 'string') {
      try {
        taskTags = JSON.parse(taskTags)
      } catch (e) {
        taskTags = {}
      }
    }

    const scheduleRuleFromTags = taskTags?.scheduleRule

    // 如果 tags 中有 scheduleRule，但数据库字段为空或不同，则更新
    if (scheduleRuleFromTags && ['daily', 'school', 'weekend', 'flexible'].includes(scheduleRuleFromTags)) {
      if (task.schedule_rule !== scheduleRuleFromTags) {
        console.log(`更新任务 ${task.id} (${task.name}): ${task.schedule_rule || 'null'} -> ${scheduleRuleFromTags}`)
        await prisma.$executeRaw`
          UPDATE tasks SET schedule_rule = ${scheduleRuleFromTags} WHERE id = ${task.id}
        `
      } else {
        console.log(`任务 ${task.id} (${task.name}): 已同步 (${scheduleRuleFromTags})`)
      }
    } else {
      // 如果 tags 中没有，但数据库字段有值，则更新 tags
      if (task.schedule_rule && ['daily', 'school', 'weekend', 'flexible'].includes(task.schedule_rule)) {
        console.log(`任务 ${task.id} (${task.name}): 数据库有值但 tags 中没有`)
      } else {
        // 都没有，设置为默认值 daily
        console.log(`任务 ${task.id} (${task.name}): 设置为默认值 daily`)
        await prisma.$executeRaw`
          UPDATE tasks SET schedule_rule = 'daily' WHERE id = ${task.id}
        `
      }
    }
  }

  console.log('同步完成！')
}

syncScheduleRules()
  .catch(console.error)
  .finally(() => process.exit(0))
