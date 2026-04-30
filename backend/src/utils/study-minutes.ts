export type StudyCheckinLike = {
  id?: number | null
  child_id?: number | null
  childId?: number | null
  task_id?: number | null
  taskId?: number | null
  plan_id?: number | null
  planId?: number | null
  resolved_task_id?: number | null
  status?: string | null
  value?: number | null
  completed_value?: number | null
  completedValue?: number | null
  time_per_unit?: number | null
  taskTimePerUnit?: number | null
  check_date?: Date | string | null
  checkDate?: Date | string | null
  created_at?: Date | string | null
  createdAt?: Date | string | null
  plan?: {
    task?: {
      id?: number | null
      timePerUnit?: number | null
    } | null
  } | null
}

export function isCountedStudyStatus(status: unknown): boolean {
  return status === 'completed' || status === 'partial'
}

export function getCountedStudyMinutes(checkin: StudyCheckinLike): number {
  if (!isCountedStudyStatus(checkin.status)) return 0

  const actualMinutes = checkin.completed_value ?? checkin.completedValue
  if (actualMinutes !== null && actualMinutes !== undefined) {
    return Number(actualMinutes) || 0
  }

  const plannedMinutes =
    checkin.time_per_unit ??
    checkin.plan?.task?.timePerUnit ??
    checkin.taskTimePerUnit ??
    0

  return (Number(plannedMinutes) || 0) * (Number(checkin.value) || 1)
}

export function getLocalDateKey(value: Date | string | null | undefined): string {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getStudyTaskKey(checkin: StudyCheckinLike): number | string {
  return (
    checkin.resolved_task_id ??
    checkin.plan?.task?.id ??
    checkin.task_id ??
    checkin.taskId ??
    (checkin.plan_id || checkin.planId ? `plan:${checkin.plan_id ?? checkin.planId}` : undefined) ??
    `row:${checkin.id ?? 'unknown'}`
  )
}

export function dedupeLatestDailyTaskCheckins<T extends StudyCheckinLike>(checkins: T[]): T[] {
  const latestByTask = new Map<string, T>()

  checkins.forEach((checkin) => {
    const childId = checkin.child_id ?? checkin.childId ?? 'unknown-child'
    const dateKey = getLocalDateKey(checkin.check_date ?? checkin.checkDate)
    const key = `${childId}:${dateKey}:${getStudyTaskKey(checkin)}`
    const existing = latestByTask.get(key)

    if (!existing) {
      latestByTask.set(key, checkin)
      return
    }

    const existingCreatedAt = new Date(existing.created_at ?? existing.createdAt ?? 0).getTime()
    const currentCreatedAt = new Date(checkin.created_at ?? checkin.createdAt ?? 0).getTime()
    const existingId = Number(existing.id) || 0
    const currentId = Number(checkin.id) || 0

    if (currentCreatedAt > existingCreatedAt || (currentCreatedAt === existingCreatedAt && currentId > existingId)) {
      latestByTask.set(key, checkin)
    }
  })

  return Array.from(latestByTask.values())
}

export function sumCountedStudyMinutes(checkins: StudyCheckinLike[]): number {
  return checkins.reduce((sum, checkin) => sum + getCountedStudyMinutes(checkin), 0)
}
