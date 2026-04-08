const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true, passwordHash: true } });
  console.log('用户列表:', users);
  
  // 测试密码
  const testPassword = '123456';
  for (const user of users) {
    const isMatch = await bcrypt.compare(testPassword, user.passwordHash);
    console.log(`用户 ${user.name} 的密码是否为 '${testPassword}':`, isMatch);
  }
  
  await prisma.$disconnect();
}

check();
