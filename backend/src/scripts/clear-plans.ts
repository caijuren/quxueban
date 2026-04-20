import { prisma } from '../config/database'

async function clearPlans() {
  console.log('开始清空周计划...')

  // 删除所有周计划
  const result = await prisma.$executeRaw`DELETE FROM weekly_plans`

  console.log(`已清空所有周计划`)
  console.log('完成！')
}

clearPlans()
  .catch(console.error)
  .finally(() => process.exit(0))
