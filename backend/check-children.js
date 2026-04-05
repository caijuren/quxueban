const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChildren() {
  try {
    const children = await prisma.user.findMany({
      where: { role: 'child' },
      select: { id: true, name: true, status: true, familyId: true }
    });
    console.log('Children in database:', JSON.stringify(children, null, 2));
    
    const families = await prisma.family.findMany();
    console.log('Families:', JSON.stringify(families, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChildren();
