// 测试 date-fns 的 startOfWeek
const { startOfWeek, format } = require('date-fns');

const today = new Date();
console.log('今天:', today.toISOString());
console.log('今天是星期:', today.getDay()); // 0=周日, 1=周一, ...

// 使用 weekStartsOn: 1（周一开始）
const weekStart = startOfWeek(today, { weekStartsOn: 1 });
console.log('\n周开始 (周一):', weekStart.toISOString());
console.log('周开始的日期:', format(weekStart, 'yyyy-MM-dd'));
console.log('周开始是星期:', weekStart.getDay());

// 检查 2025-04-06
const testDate = new Date('2025-04-06');
console.log('\n2025-04-06:', testDate.toISOString());
console.log('2025-04-06 是星期:', testDate.getDay());

const testWeekStart = startOfWeek(testDate, { weekStartsOn: 1 });
console.log('2025-04-06 的周开始:', testWeekStart.toISOString());
console.log('2025-04-06 的周开始日期:', format(testWeekStart, 'yyyy-MM-dd'));
