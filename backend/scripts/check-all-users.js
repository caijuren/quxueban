const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllUsers() {
  try {
    console.log('正在查询所有用户数据...');
    
    // 查询所有用户
    const users = await prisma.user.findMany({
      include: {
        family: true
      }
    });
    
    console.log(`\n总用户数: ${users.length}`);
    
    // 统计家长和孩子数量
    const parents = users.filter(user => user.role === 'parent');
    const children = users.filter(user => user.role === 'child');
    
    console.log(`家长账号数: ${parents.length}`);
    console.log(`孩子账号数: ${children.length}`);
    
    // 输出家长账号信息
    console.log('\n=== 家长账号信息 ===');
    parents.forEach((parent, index) => {
      console.log(`\n家长 ${index + 1}:`);
      console.log(`  姓名: ${parent.name}`);
      console.log(`  角色: ${parent.role}`);
      console.log(`  家庭: ${parent.family?.name || '无'}`);
      console.log(`  家庭代码: ${parent.family?.familyCode || '无'}`);
      console.log(`  密码哈希: ${parent.passwordHash}`);
      console.log(`  状态: ${parent.status}`);
    });
    
    // 输出孩子账号信息
    console.log('\n=== 孩子账号信息 ===');
    children.forEach((child, index) => {
      console.log(`\n孩子 ${index + 1}:`);
      console.log(`  姓名: ${child.name}`);
      console.log(`  角色: ${child.role}`);
      console.log(`  家庭: ${child.family?.name || '无'}`);
      console.log(`  家庭代码: ${child.family?.familyCode || '无'}`);
      console.log(`  密码哈希: ${child.passwordHash}`);
      console.log(`  状态: ${child.status}`);
    });
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllUsers();