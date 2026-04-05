const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find user andycoy
  const user = await prisma.user.findFirst({
    where: { name: 'andycoy', role: 'parent' }
  });
  
  if (!user) {
    console.log('User andycoy not found');
    return;
  }
  
  console.log(`Found user: ${user.name}, familyId: ${user.familyId}`);
  
  // Delete all children in this family
  const result = await prisma.user.deleteMany({
    where: {
      familyId: user.familyId,
      role: 'child'
    }
  });
  
  console.log(`Deleted ${result.count} children`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
