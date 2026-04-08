// 测试周数不匹配问题

// 后端的 getWeekNo
function getWeekNo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-${weekNum.toString().padStart(2, '0')}`
}

// 测试不同的日期
const dates = [
  '2025-03-31', // 周一（4月6日那周的正确周开始）
  '2025-04-06', // 周日（用户截图显示的日期）
  '2025-04-07', // 周一
];

console.log('测试不同日期的 weekNo:');
dates.forEach(dateStr => {
  const date = new Date(dateStr);
  console.log(`\n${dateStr}:`);
  console.log(`  星期: ${date.getDay()} (0=周日, 1=周一, ...)`);
  console.log(`  weekNo: ${getWeekNo(date)}`);
});

// 检查 date-fns 的 format(date, 'yyyy-ww')
function formatWeekNo(date) {
  const d = new Date(date);
  const dayNum = d.getDay() || 7;
  const target = new Date(d);
  target.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getFullYear()}-${weekNum.toString().padStart(2, '0')}`;
}

console.log('\n\n前端 format(date, "yyyy-ww"):');
dates.forEach(dateStr => {
  const date = new Date(dateStr);
  console.log(`${dateStr}: ${formatWeekNo(date)}`);
});
