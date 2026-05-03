/**
 * 日期和时间相关的公共工具函数
 */

/**
 * 获取日期所在的 ISO 周编号 (格式: YYYY-WW)
 * 使用 ISO 8601 标准：周一为一周的开始
 */
export function getWeekNo(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`
}

/**
 * 获取日期范围内的所有周编号
 */
export function getWeekNosInRange(startDate: Date, endDate: Date): string[] {
  const weekNos = new Set<string>()
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= endDate) {
    weekNos.add(getWeekNo(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return Array.from(weekNos)
}

/**
 * 获取最近 N 天的周编号列表
 */
export function getWeekNosForDays(days: number): string[] {
  const weekNos = new Set<string>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    weekNos.add(getWeekNo(date))
  }

  return Array.from(weekNos)
}

/**
 * 格式化日期为本地日期字符串 (YYYY-MM-DD)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
