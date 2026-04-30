import { PrismaClient } from '@prisma/client'
import { getCountedStudyMinutes, getStudyTaskKey } from '../src/utils/study-minutes'

const prisma = new PrismaClient()

function parseRequiredNumber(name: string): number {
  const value = process.env[name]
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

function parseOptionalNumber(name: string): number | null {
  const value = process.env[name]
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer when provided`)
  }
  return parsed
}

function parseDate(name: string, fallback: Date): Date {
  const value = process.env[name]
  if (!value) return fallback
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultStartDate(): Date {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  date.setHours(0, 0, 0, 0)
  return date
}

function defaultEndDate(): Date {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

async function main() {
  const familyId = parseRequiredNumber('FAMILY_ID')
  const childId = parseOptionalNumber('CHILD_ID')
  const startDate = parseDate('START_DATE', defaultStartDate())
  const endDate = parseDate('END_DATE', defaultEndDate())
  endDate.setHours(23, 59, 59, 999)
  const apply = process.env.APPLY === 'true'

  if (startDate > endDate) {
    throw new Error('START_DATE must be before or equal to END_DATE')
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT
      dc.id,
      dc.child_id,
      dc.task_id,
      dc.plan_id,
      dc.status,
      dc.value,
      dc.completed_value,
      dc.check_date,
      dc.created_at,
      COALESCE(wp.task_id, dc.task_id) AS resolved_task_id,
      COALESCE(t_plan.name, t_direct.name) AS task_name,
      COALESCE(t_plan.time_per_unit, t_direct.time_per_unit) AS time_per_unit
    FROM daily_checkins dc
    LEFT JOIN weekly_plans wp ON wp.id = dc.plan_id
    LEFT JOIN tasks t_plan ON t_plan.id = wp.task_id
    LEFT JOIN tasks t_direct ON t_direct.id = dc.task_id
    WHERE dc.family_id = $1
      ${childId ? 'AND dc.child_id = $2' : ''}
      AND dc.check_date >= $${childId ? 3 : 2}
      AND dc.check_date <= $${childId ? 4 : 3}
    ORDER BY dc.child_id, dc.check_date, COALESCE(wp.task_id, dc.task_id), dc.created_at, dc.id`,
    ...(childId ? [familyId, childId, startDate, endDate] : [familyId, startDate, endDate]),
  ) as any[]

  const groups = new Map<string, any[]>()
  rows.forEach((row) => {
    const key = `${row.child_id}:${formatDate(new Date(row.check_date))}:${getStudyTaskKey(row)}`
    const group = groups.get(key) || []
    group.push(row)
    groups.set(key, group)
  })

  const duplicateGroups = Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => {
      const sorted = [...group].sort((a, b) => {
        const aTime = new Date(a.created_at).getTime()
        const bTime = new Date(b.created_at).getTime()
        if (aTime !== bTime) return bTime - aTime
        return Number(b.id) - Number(a.id)
      })
      const keep = sorted[0]
      const remove = sorted.slice(1)
      return {
        childId: keep.child_id,
        checkDate: formatDate(new Date(keep.check_date)),
        resolvedTaskId: keep.resolved_task_id,
        taskName: keep.task_name,
        keepId: keep.id,
        removeIds: remove.map((row) => row.id),
        rawMinutes: group.reduce((sum, row) => sum + getCountedStudyMinutes(row), 0),
        keptMinutes: getCountedStudyMinutes(keep),
        rows: sorted.map((row) => ({
          id: row.id,
          status: row.status,
          completedValue: row.completed_value,
          timePerUnit: row.time_per_unit,
          countedMinutes: getCountedStudyMinutes(row),
          createdAt: row.created_at,
        })),
      }
    })

  const removeIds = duplicateGroups.flatMap((group) => group.removeIds)

  if (apply && removeIds.length > 0) {
    await prisma.dailyCheckin.deleteMany({
      where: {
        familyId,
        id: { in: removeIds },
      },
    })
  }

  console.log(JSON.stringify({
    status: 'success',
    mode: apply ? 'apply' : 'dry-run',
    data: {
      familyId,
      childId,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      scannedRows: rows.length,
      duplicateGroupCount: duplicateGroups.length,
      duplicateRowsToRemove: removeIds.length,
      removedRows: apply ? removeIds.length : 0,
      duplicateGroups,
    },
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
