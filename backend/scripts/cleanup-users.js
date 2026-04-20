const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupUsers() {
  try {
    console.log('开始清理用户账号...');
    
    // 保留的用户
    const keepUsers = [
      { name: 'andycoy', role: 'parent' },
      { name: '小胖子', role: 'child' },
      { name: '臭沫沫', role: 'child' }
    ];
    
    // 获取所有用户
    const allUsers = await prisma.user.findMany();
    
    // 筛选需要删除的用户
    const usersToDelete = allUsers.filter(user => {
      const shouldKeep = keepUsers.some(keep => keep.name === user.name && keep.role === user.role);
      return !shouldKeep;
    });
    
    console.log(`需要删除的用户数: ${usersToDelete.length}`);
    console.log('需要删除的用户:', usersToDelete.map(u => `${u.name} (${u.role})`));
    
    // 删除用户
    for (const user of usersToDelete) {
      console.log(`删除用户: ${user.name} (${user.role})`);
      await prisma.user.delete({ where: { id: user.id } });
    }
    
    console.log('\n清理完成！');
    
    // 验证保留的用户
    const remainingUsers = await prisma.user.findMany({
      include: { family: true }
    });
    
    console.log(`\n剩余用户数: ${remainingUsers.length}`);
    console.log('剩余用户:');
    remainingUsers.forEach(user => {
      console.log(`  ${user.name} (${user.role}) - 家庭: ${user.family?.name || '无'}`);
    });
    
  } catch (error) {
    console.error('清理失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupUsers();