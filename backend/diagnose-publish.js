// 诊断发布计划问题的脚本
// 运行方式：node diagnose-publish.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== 开始诊断发布计划问题 ===\n');

// 1. 检查后端进程是否在运行
console.log('1. 检查后端进程状态...');
try {
  const processes = execSync('ps aux | grep "npm run dev" | grep -v grep', { encoding: 'utf-8' });
  if (processes.includes('npm run dev')) {
    console.log('✓ 后端服务正在运行\n');
  } else {
    console.log('✗ 后端服务未运行！请先启动：cd backend && npm run dev\n');
  }
} catch (e) {
  console.log('✗ 无法检查进程状态\n');
}

// 2. 检查最近的日志文件
console.log('2. 检查最近的错误日志...');
const logPath = path.join(__dirname, 'logs');
if (fs.existsSync(logPath)) {
  const logs = fs.readdirSync(logPath).filter(f => f.endsWith('.log')).sort().reverse();
  if (logs.length > 0) {
    const latestLog = path.join(logPath, logs[0]);
    console.log(`最新日志文件: ${logs[0]}`);
    const content = fs.readFileSync(latestLog, 'utf-8');
    const errorLines = content.split('\n').filter(line => 
      line.includes('Error') || 
      line.includes('ERROR') || 
      line.includes('[PUBLISH]')
    ).slice(-20);
    if (errorLines.length > 0) {
      console.log('\n最近的相关日志：');
      errorLines.forEach(line => console.log(line));
    }
  }
} else {
  console.log('未找到日志目录\n');
}

// 3. 检查 Prisma schema
console.log('\n3. 检查 Prisma schema...');
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const weeklyPlanMatch = schema.match(/model WeeklyPlan \{[\s\S]*?\n\}/);
  if (weeklyPlanMatch) {
    console.log('WeeklyPlan 模型定义：');
    console.log(weeklyPlanMatch[0]);
    
    if (weeklyPlanMatch[0].includes('daysAllocated')) {
      console.log('\n✗ 警告：schema 中包含 daysAllocated 字段，但数据库可能未同步！');
    } else {
      console.log('\n✓ schema 中不包含 daysAllocated 字段（正确）');
    }
  }
}

// 4. 检查数据库迁移状态
console.log('\n4. 建议执行的命令：');
console.log('   cd backend && npx prisma migrate status');
console.log('   cd backend && npx prisma generate');
console.log('   # 然后重启后端服务：npm run dev');

console.log('\n=== 诊断完成 ===');
console.log('\n如果仍然报错，请在后端终端中查找包含以下关键字的日志：');
console.log('  - [PUBLISH]');
console.log('  - Error:');
console.log('  - PrismaClient');