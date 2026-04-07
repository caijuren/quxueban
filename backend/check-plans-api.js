// 检查 Plans API 返回的数据
// 运行方式：cd backend && node check-plans-api.js

const API_BASE = 'http://localhost:10000/api';

async function checkPlansAPI() {
  console.log('=== 检查 Plans API 响应数据 ===\n');
  
  try {
    // 1. 登录获取 token（需要替换为实际的登录信息）
    console.log('请提供以下信息以继续：');
    console.log('1. 在浏览器中打开：http://localhost:5173/parent/plans');
    console.log('2. 打开浏览器开发者工具（F12）');
    console.log('3. 切换到 Network 标签');
    console.log('4. 找到 week/ 开头的请求');
    console.log('5. 查看响应数据中的 assignedDays 字段\n');
    
    console.log('=== 期望看到的数据结构 ===');
    console.log('对于"高思数学一上"（scheduleRule: weekend）：');
    console.log('  正确：assignedDays: [5, 6]（周六、周日）');
    console.log('  错误：assignedDays: [0, 1, 2, 3, 4, 5, 6]（包含周一至周五）\n');
    
    console.log('=== 下一步诊断 ===');
    console.log('如果 assignedDays 数据不正确，说明：');
    console.log('1. 后端推算逻辑错误（plans.ts 第370-392行）');
    console.log('2. 需要从数据库读取实际分配数据，而不是重新推算\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPlansAPI();