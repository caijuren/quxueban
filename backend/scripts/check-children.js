const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChildren() {
  try {
    // Query all users with role 'child'
    const children = await prisma.user.findMany({
      where: { role: 'child' },
      select: {
        id: true,
        name: true,
        avatar: true,
        status: true,
        familyId: true,
        createdAt: true
      }
    });
    
    console.log('=== Children in Database ===');
    console.log('Total number of children:', children.length);
    console.log('\nDetailed information:');
    
    children.forEach(child => {
      console.log(`ID: ${child.id}, Name: ${child.name}, Avatar: ${child.avatar}, Status: ${child.status}, Family ID: ${child.familyId}`);
    });
    
  } catch (error) {
    console.error('Error querying database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkChildren();