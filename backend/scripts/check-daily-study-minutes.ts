import { PrismaClient } from '@prisma/client'
import { dedupeLatestDailyTaskCheckins, getCountedStudyMinutes, getStudyTaskKey, sumCountedStudyMinutes } from '../src/utils/study-minutes'

const prisma = new PrismaClient()

function parseRequiredNumber(name: string): number {
  const value = process.env[name]
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

function parseDate(value: string | undefined): Date {
  const dateText = value || new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error('CHECK_DATE must use YYYY-MM-DD format')
  }
  const [year, month, day] = dateText.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date
}

async function main() {
  const familyId = parseRequiredNumber('FAMILY_ID')
  const childId = process.env.CHILD_ID ? parseRequiredNumber('CHILD_ID') : null
  const checkDate = parseDate(process.env.CHECK_DATE)
  const checkDateEnd = new Date(checkDate)
  checkDateEnd.setHours(23, 59, 59, 999)

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
    ORDER BY dc.child_id, COALESCE(wp.task_id, dc.task_id), dc.created_at, dc.id`,
    ...(childId ? [familyId, childId, checkDate, checkDateEnd] : [familyId, checkDate, checkDateEnd]),
  ) as any[]

  const duplicates = new Map<string, any[]>()

  rows.forEach((row) => {
    const taskKey = `${row.child_id}:${getStudyTaskKey(row)}`
    const grouped = duplicates.get(taskKey) || []
    grouped.push(row)
    duplicates.set(taskKey, grouped)
  })

  const rawMinutes = sumCountedStudyMinutes(rows)
  const dedupedRows = dedupeLatestDailyTaskCheckins(rows)
  const dedupedMinutes = sumCountedStudyMinutes(dedupedRows)
  const duplicateGroups = Array.from(duplicates.values()).filter((group) => group.length > 1)

  console.log(JSON.stringify({
    status: 'success',
    data: {
      familyId,
      childId,
      checkDate: checkDate.toISOString().slice(0, 10),
      rawRows: rows.length,
      rawMinutes,
      dedupedRows: dedupedRows.length,
      dedupedMinutes,
      duplicateGroups: duplicateGroups.map((group) => ({
        childId: group[0].child_id,
        resolvedTaskId: group[0].resolved_task_id,
        taskName: group[0].task_name,
        rowCount: group.length,
        minutes: group.map((row) => getCountedStudyMinutes(row)),
        ids: group.map((row) => row.id),
        statuses: group.map((row) => row.status),
      })),
      rows: dedupedRows.map((row) => ({
        id: row.id,
        childId: row.child_id,
        taskId: row.resolved_task_id || row.task_id,
        taskName: row.task_name,
        status: row.status,
        completedValue: row.completed_value,
        timePerUnit: row.time_per_unit,
        countedMinutes: getCountedStudyMinutes(row),
        createdAt: row.created_at,
      })),
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
