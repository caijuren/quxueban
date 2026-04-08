import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = 'andycoy'
  const newPassword = '123456'
  
  console.log(`重置用户 ${username} 的密码...`)
  
  // 先查找用户
  const existingUser = await prisma.user.findFirst({
    where: { name: username },
  })
  
  if (!existingUser) {
    console.log('用户不存在')
    return
  }
  
  // 生成新的密码哈希
  const passwordHash = await bcrypt.hash(newPassword, 12)
  
  // 更新用户密码
  const user = await prisma.user.update({
    where: { id: existingUser.id },
    data: { passwordHash },
  })
  
  console.log(`密码重置成功！`)
  console.log(`用户名: ${user.name}`)
  console.log(`新密码: ${newPassword}`)
  
  // 验证新密码
  const isValid = await bcrypt.compare(newPassword, passwordHash)
  console.log(`\n密码验证: ${isValid}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
