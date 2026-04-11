const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabaseData() {
  try {
    // Check total users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        familyId: true
      }
    });
    
    // Check children
    const children = await prisma.user.findMany({
      where: { role: 'child' },
      select: {
        id: true,
        name: true,
        status: true,
        familyId: true,
        avatar: true
      }
    });
    
    // Check families
    const families = await prisma.family.findMany();
    
    console.log('=== Database Status ===');
    console.log('Total users:', users.length);
    console.log('Total children:', children.length);
    console.log('Total families:', families.length);
    
    console.log('\n=== Users ===');
    users.forEach(user => {
      console.log(`ID: ${user.id}, Name: ${user.name}, Role: ${user.role}, Status: ${user.status}`);
    });
    
    console.log('\n=== Children ===');
    children.forEach(child => {
      console.log(`ID: ${child.id}, Name: ${child.name}, Status: ${child.status}, Avatar: ${child.avatar}`);
    });
    
  } catch (error) {
    console.error('Error querying database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseData();