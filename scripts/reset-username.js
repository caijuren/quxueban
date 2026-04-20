#!/usr/bin/env node

/**
 * 重置用户名为 andycoy
 * 使用方法: node reset-username.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetUsername() {
  try {
    // 查找用户 ID 为 1 的用户
    const user = await prisma.user.findUnique({
      where: { id: 1 },
    });

    if (!user) {
      console.log('❌ 用户不存在');
      return;
    }

    console.log('当前用户信息:');
    console.log(`  ID: ${user.id}`);
    console.log(`  用户名: ${user.name}`);
    console.log(`  角色: ${user.role}`);

    // 更新用户名为 andycoy
    const updatedUser = await prisma.user.update({
      where: { id: 1 },
      data: { name: 'andycoy' },
    });

    console.log('\n✅ 用户名已重置为: andycoy');
    console.log('现在可以使用以下信息登录:');
    console.log('  用户名: andycoy');
    console.log('  密码: andycoy');

  } catch (error) {
    console.error('❌ 重置失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetUsername();
