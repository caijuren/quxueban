/**
 * 任务相关的公共工具函数
 */

/**
 * 解析任务标签 (支持 JSON 对象或 JSON 字符串)
 */
export function parseTaskTags(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }

  return {}
}

/**
 * 获取分配的日期列表 (支持数组或 JSON 字符串)
 */
export function getAssignedDays(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((day): day is number => typeof day === 'number')
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((day): day is number => typeof day === 'number')
        : []
    } catch {
      return []
    }
  }

  return []
}

/**
 * 获取有效的调度规则
 * 优先使用 task.schedule_rule，然后是 tags.schedule_rule，最后是默认值
 */
export function getEffectiveScheduleRule(task: {
  schedule_rule?: unknown
  tags?: unknown
  weekly_rule?: unknown
}): string {
  if (typeof task.schedule_rule === 'string' && task.schedule_rule) {
    return task.schedule_rule
  }

  const tags = parseTaskTags(task.tags)
  if (typeof tags.scheduleRule === 'string' && tags.scheduleRule) {
    return tags.scheduleRule
  }

  if (typeof task.weekly_rule === 'string' && task.weekly_rule) {
    return task.weekly_rule
  }

  return 'daily'
}

/**
 * 获取允许的日期列表 (根据调度规则和分配的日期)
 */
export function getAllowedDays(scheduleRule: string, assignedDays: unknown): number[] {
  const storedDays = getAssignedDays(assignedDays)
  if (storedDays.length > 0) {
    return storedDays
  }

  switch (scheduleRule) {
    case 'school':
      return [1, 2, 4, 5]
    case 'weekend':
      return [0, 6]
    case 'flexible':
      return [1, 2, 3, 4, 5]
    case 'daily':
    default:
      return [0, 1, 2, 3, 4, 5, 6]
  }
}

/**
 * 计算日期范围内的分配天数
 */
export function countAssignedDaysInRange(startDate: Date, endDate: Date, allowedDays: number[]): number {
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  let count = 0

  while (cursor <= endDate) {
    if (allowedDays.includes(cursor.getDay())) {
      count += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return count
}
