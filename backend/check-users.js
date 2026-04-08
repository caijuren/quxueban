const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true, familyId: true } });
  console.log('用户列表:', users);
  await prisma.$disconnect();
}

check();
