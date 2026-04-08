import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 检查 weekly_plan 表中的数据
  const weekNo = '2025-14'
  
  console.log(`查询 weekNo = ${weekNo} 的周计划...`)
  
  const plans = await prisma.weeklyPlan.findMany({
    where: { weekNo },
    include: { task: true },
  })
  
  console.log(`找到 ${plans.length} 条记录`)
  
  plans.forEach((plan, i) => {
    console.log(`\n记录 ${i + 1}:`)
    console.log(`  ID: ${plan.id}`)
    console.log(`  childId: ${plan.childId}`)
    console.log(`  taskId: ${plan.taskId}`)
    console.log(`  taskName: ${plan.task?.name}`)
    console.log(`  weekNo: ${plan.weekNo}`)
    console.log(`  assignedDays: ${JSON.stringify(plan.assignedDays)}`)
    console.log(`  target: ${plan.target}`)
    console.log(`  progress: ${plan.progress}`)
    console.log(`  status: ${plan.status}`)
  })
  
  // 检查所有周计划
  console.log('\n\n所有周计划（前10条）:')
  const allPlans = await prisma.weeklyPlan.findMany({
    take: 10,
    orderBy: { id: 'desc' },
    include: { task: true },
  })
  
  allPlans.forEach((plan, i) => {
    console.log(`\n记录 ${i + 1}:`)
    console.log(`  ID: ${plan.id}`)
    console.log(`  childId: ${plan.childId}`)
    console.log(`  taskName: ${plan.task?.name}`)
    console.log(`  weekNo: ${plan.weekNo}`)
    console.log(`  assignedDays: ${JSON.stringify(plan.assignedDays)}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
