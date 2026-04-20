const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function reset() {
  const newPassword = '123456';
  const passwordHash = await bcrypt.hash(newPassword, 12);
  
  // 先找到臭沫沫的用户ID
  const user = await prisma.user.findFirst({
    where: { name: '臭沫沫' }
  });
  
  if (!user) {
    console.error('找不到用户臭沫沫');
    return;
  }
  
  // 重置密码
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });
  
  console.log('已将臭沫沫的密码重置为:', newPassword);
  
  await prisma.$disconnect();
}

reset();
