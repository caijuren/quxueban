const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAll() {
  try {
    const users = await prisma.user.findMany();
    console.log('All users:', JSON.stringify(users, null, 2));
    
    const families = await prisma.family.findMany();
    console.log('Families:', JSON.stringify(families, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAll();
