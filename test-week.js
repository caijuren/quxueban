// 测试周数计算

// 模拟前端的 date-fns format
function formatWeekNo(date) {
  // date-fns 的 'yyyy-ww' 格式使用 ISO 周数
  const d = new Date(date);
  const dayNum = d.getDay() || 7; // 1-7 (周一=1, 周日=7)
  const target = new Date(d);
  target.setDate(d.getDate() + 4 - dayNum); // 调整到周四
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getFullYear()}-${weekNum.toString().padStart(2, '0')}`;
}

// 后端的 getWeekNo
function getWeekNo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-${weekNum.toString().padStart(2, '0')}`
}

// 测试日期
const testDate = new Date('2025-04-06'); // 2025年4月6日（周一）

console.log('测试日期:', testDate.toISOString());
console.log('前端 weekNo:', formatWeekNo(testDate));
console.log('后端 weekNo:', getWeekNo(testDate));

// 测试 new Date('2025-04-06') 的行为
const parsedDate = new Date('2025-04-06');
console.log('\n解析日期:');
console.log('  new Date("2025-04-06"):', parsedDate.toISOString());
console.log('  getFullYear():', parsedDate.getFullYear());
console.log('  getMonth():', parsedDate.getMonth());
console.log('  getDate():', parsedDate.getDate());
console.log('  getDay():', parsedDate.getDay()); // 0=周日, 1=周一, ...
