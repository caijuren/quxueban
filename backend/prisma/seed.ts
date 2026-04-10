import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Check if family 1 exists
  let family = await prisma.family.findFirst({ where: { id: 1 } });

  if (!family) {
    // Create family 1
    family = await prisma.family.create({
      data: {
        id: 1,
        name: '家庭1',
        familyCode: 'FAMILY1',
        settings: {},
      },
    });
    console.log('Created family 1:', family);
  }

  // Check if parent user exists
  let parent = await prisma.user.findFirst({ where: { id: 1, role: 'parent' } });

  if (!parent) {
    // Create parent user
    parent = await prisma.user.create({
      data: {
        id: 1,
        name: 'andycoy',
        role: 'parent',
        passwordHash: await bcrypt.hash('123456', 12),
        familyId: 1,
        status: 'active',
        avatar: '👤',
      },
    });
    console.log('Created parent user:', parent);
  }

  // Create or update child 1: 小胖子
  let child1 = await prisma.user.findFirst({ where: { id: 2, role: 'child' } });

  if (child1) {
    // Update existing child
    child1 = await prisma.user.update({
      where: { id: 2 },
      data: {
        name: '小胖子',
        familyId: 1,
        status: 'active',
        avatar: '🐷',
      },
    });
    console.log('Updated child 1:', child1);
  } else {
    // Create new child
    child1 = await prisma.user.create({
      data: {
        id: 2,
        name: '小胖子',
        role: 'child',
        passwordHash: await bcrypt.hash('1234', 12),
        familyId: 1,
        status: 'active',
        avatar: '🐷',
      },
    });
    console.log('Created child 1:', child1);
  }

  // Create or update child 2: 臭沫沫
  let child2 = await prisma.user.findFirst({ where: { id: 3, role: 'child' } });

  if (child2) {
    // Update existing child
    child2 = await prisma.user.update({
      where: { id: 3 },
      data: {
        name: '臭沫沫',
        familyId: 1,
        status: 'active',
        avatar: '🐶',
      },
    });
    console.log('Updated child 2:', child2);
  } else {
    // Create new child
    child2 = await prisma.user.create({
      data: {
        id: 3,
        name: '臭沫沫',
        role: 'child',
        passwordHash: await bcrypt.hash('5678', 12),
        familyId: 1,
        status: 'active',
        avatar: '🐶',
      },
    });
    console.log('Created child 2:', child2);
  }

  // Deactivate child 3: 小红
  const child3 = await prisma.user.findFirst({ where: { id: 4, role: 'child' } });

  if (child3) {
    await prisma.user.update({
      where: { id: 4 },
      data: { status: 'inactive' },
    });
    console.log('Deactivated child 3:', child3);
  }

  // Deactivate families 2 and 3
  await prisma.family.updateMany({
    where: { id: { in: [2, 3] } },
    data: { settings: { ...(prisma.family.fields.settings as any), status: 'inactive' } },
  });
  console.log('Deactivated families 2 and 3');

  // Deactivate children from families 2 and 3
  await prisma.user.updateMany({
    where: { familyId: { in: [2, 3] }, role: 'child' },
    data: { status: 'inactive' },
  });
  console.log('Deactivated children from families 2 and 3');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
