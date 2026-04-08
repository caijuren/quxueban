import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 检查用户 andycoy
  const username = 'andycoy'
  
  console.log(`查询用户: ${username}`)
  
  const user = await prisma.user.findFirst({
    where: { name: username },
    include: { family: true },
  })
  
  if (user) {
    console.log('找到用户:')
    console.log(`  ID: ${user.id}`)
    console.log(`  Name: ${user.name}`)
    console.log(`  Role: ${user.role}`)
    console.log(`  Status: ${user.status}`)
    console.log(`  Family ID: ${user.familyId}`)
    console.log(`  Family Name: ${user.family?.name}`)
    console.log(`  Password Hash: ${user.passwordHash?.substring(0, 50)}...`)
    
    // 测试密码验证
    const testPassword = '123456'
    const isValid = await bcrypt.compare(testPassword, user.passwordHash)
    console.log(`\n密码 "${testPassword}" 验证结果: ${isValid}`)
  } else {
    console.log('用户不存在')
    
    // 列出所有用户
    console.log('\n所有用户:')
    const allUsers = await prisma.user.findMany({
      take: 10,
      select: { id: true, name: true, role: true, status: true },
    })
    allUsers.forEach(u => {
      console.log(`  ${u.name} (ID: ${u.id}, Role: ${u.role}, Status: ${u.status})`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
