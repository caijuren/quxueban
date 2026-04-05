import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const tasksRouter: Router = Router()

// All routes require authentication and parent role
tasksRouter.use(authMiddleware)
tasksRouter.use(requireRole('parent'))

// ============================================
// Task Routes (Parent only)
// ============================================

// Tag definitions
const VALID_SUBJECTS = ['chinese', 'math', 'english', 'sports']
const VALID_FORMATS = ['paper', 'tablet', 'app', 'reading', 'recite', 'exercise']
const VALID_PARTICIPATIONS = ['independent', 'accompany', 'interactive', 'parent']
const VALID_DIFFICULTIES = ['basic', 'advanced', 'challenge']

/**
 * POST / - Create a new task
 * Body: { name, category, type, timePerUnit, weeklyRule, tags, appliesTo }
 */
// Category mapping: Chinese to English
const CATEGORY_MAP: Record<string, string> = {
  '校内巩固': 'school',
  '校内拔高': 'extra',
  '课外课程': 'extra',
  '英语阅读': 'english',
  '体育运动': 'sports',
  '中文阅读': 'chinese',
}

// Type mapping: Chinese to English
const TYPE_MAP: Record<string, string> = {
  '固定': 'fixed',
  '灵活': 'flexible',
  '跟随学校': 'follow',
}

tasksRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { name, category, type, timePerUnit, weeklyRule, tags, appliesTo } = req.body
  const { familyId } = req.user!

  if (!name || !category || !type) {
    throw new AppError(400, 'Missing required fields: name, category, type')
  }

  // Map Chinese category to English
  const mappedCategory = CATEGORY_MAP[category] || category
  const validCategories = ['school', 'extra', 'english', 'sports', 'chinese']
  if (!validCategories.includes(mappedCategory)) {
    throw new AppError(400, `Invalid category. Must be one of: ${validCategories.join(', ')}`)
  }

  // Map Chinese type to English
  const mappedType = TYPE_MAP[type] || type
  const validTypes = ['fixed', 'flexible', 'follow']
  if (!validTypes.includes(mappedType)) {
    throw new AppError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`)
  }

  // Validate tags if provided
  let validatedTags = {}
  if (tags && typeof tags === 'object') {
    validatedTags = {
      ...(tags.subject && VALID_SUBJECTS.includes(tags.subject) && { subject: tags.subject }),
      ...(tags.format && Array.isArray(tags.format) && { format: tags.format.filter((f: string) => VALID_FORMATS.includes(f)) }),
      ...(tags.participation && VALID_PARTICIPATIONS.includes(tags.participation) && { participation: tags.participation }),
      ...(tags.difficulty && VALID_DIFFICULTIES.includes(tags.difficulty) && { difficulty: tags.difficulty }),
    }
  }

  // Validate appliesTo - should be array of child IDs or empty for all children
  let validatedAppliesTo: number[] = []
  if (appliesTo !== undefined && appliesTo !== null) {
    if (Array.isArray(appliesTo)) {
      validatedAppliesTo = appliesTo.filter((id: any) => typeof id === 'number')
    }
  }

  const task = await prisma.task.create({
    data: {
      familyId,
      name,
      category: mappedCategory,
      type: mappedType,
      timePerUnit: timePerUnit || 30,
      weeklyRule: weeklyRule || {},
      tags: validatedTags,
      appliesTo: validatedAppliesTo,
    },
  })

  res.status(201).json({
    status: 'success',
    message: 'Task created successfully',
    data: task,
  })
})

/**
 * GET / - List all family tasks
 * Query: ?childId=123 - Filter tasks applicable to specific child
 */
tasksRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = req.query.childId ? parseInt(req.query.childId as string) : undefined

  try {
    // Use raw query to avoid schema mismatch issues
    let query = `
      SELECT id, family_id, name, category, type, time_per_unit, 
             weekly_rule, sort_order, is_active, applies_to, created_at, updated_at
      FROM tasks 
      WHERE family_id = ${familyId} AND is_active = true
    `
    
    if (childId) {
      query += ` AND (
        applies_to::jsonb = '[]'::jsonb 
        OR applies_to::jsonb @> '[${childId}]'::jsonb
      )`
    }
    
    query += ` ORDER BY sort_order ASC, created_at DESC`

    const tasks = await prisma.$queryRawUnsafe(query)

    // Transform raw results to match expected format
    const formattedTasks = (tasks as any[]).map(task => ({
      id: task.id,
      familyId: task.family_id,
      name: task.name,
      category: task.category,
      type: task.type,
      timePerUnit: task.time_per_unit,
      weeklyRule: task.weekly_rule,
      sortOrder: task.sort_order,
      isActive: task.is_active,
      appliesTo: task.applies_to || [],
      tags: {}, // Default empty tags to avoid frontend errors
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    }))

    res.json({
      status: 'success',
      data: formattedTasks,
    })
  } catch (error: any) {
    console.error('[GET TASKS] Error:', error)
    throw new AppError(500, `Failed to get tasks: ${error.message}`)
  }
})

/**
 * GET /:id - Get task by ID
 */
tasksRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const { familyId } = req.user!

    const task = await prisma.$queryRawUnsafe(
      `SELECT id, family_id, name, category, type, time_per_unit, 
              weekly_rule, sort_order, is_active, applies_to, created_at, updated_at
       FROM tasks WHERE id = ${id} AND family_id = ${familyId} LIMIT 1`
    ) as any[]

    if (!task || task.length === 0) {
      throw new AppError(404, 'Task not found')
    }

    const formattedTask = {
      id: task[0].id,
      familyId: task[0].family_id,
      name: task[0].name,
      category: task[0].category,
      type: task[0].type,
      timePerUnit: task[0].time_per_unit,
      weeklyRule: task[0].weekly_rule,
      sortOrder: task[0].sort_order,
      isActive: task[0].is_active,
      appliesTo: task[0].applies_to || [],
      tags: {},
      createdAt: task[0].created_at,
      updatedAt: task[0].updated_at,
    }

    res.json({
      status: 'success',
      data: formattedTask,
    })
  } catch (error: any) {
    console.error('[GET TASK] Error:', error)
    throw new AppError(500, `Failed to get task: ${error.message}`)
  }
})

/**
 * PUT /:id - Update task
 * Body: { name?, category?, type?, timePerUnit?, weeklyRule?, isActive?, tags?, appliesTo? }
 */
tasksRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const { familyId } = req.user!
    const { name, category, type, timePerUnit, weeklyRule, isActive, appliesTo } = req.body

    console.log(`[UPDATE TASK] Task ${id}, Family ${familyId}, Body:`, JSON.stringify(req.body))

    // Check task exists and belongs to family using raw query
    const existingTask = await prisma.$queryRawUnsafe(
      `SELECT id FROM tasks WHERE id = ${id} AND family_id = ${familyId} LIMIT 1`
    ) as any[]

    if (!existingTask || existingTask.length === 0) {
      throw new AppError(404, 'Task not found')
    }

    // Validate category if provided
    if (category) {
      const validCategories = ['school', 'extra', 'english', 'sports', 'chinese']
      if (!validCategories.includes(category)) {
        throw new AppError(400, `Invalid category. Must be one of: ${validCategories.join(', ')}`)
      }
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['fixed', 'flexible', 'follow']
      if (!validTypes.includes(type)) {
        throw new AppError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`)
      }
    }

    // Validate and process appliesTo if provided
    let validatedAppliesTo: number[] | undefined
    if (appliesTo !== undefined) {
      if (appliesTo === null) {
        validatedAppliesTo = []
      } else if (Array.isArray(appliesTo)) {
        validatedAppliesTo = appliesTo.filter((id: any) => typeof id === 'number')
      }
    }

    // Build update query dynamically
    const updates: string[] = []
    if (name) updates.push(`name = '${name.replace(/'/g, "''")}'`)
    if (category) updates.push(`category = '${category}'`)
    if (type) updates.push(`type = '${type}'`)
    if (timePerUnit !== undefined) updates.push(`time_per_unit = ${timePerUnit}`)
    if (weeklyRule !== undefined) updates.push(`weekly_rule = '${JSON.stringify(weeklyRule).replace(/'/g, "''")}'::jsonb`)
    if (isActive !== undefined) updates.push(`is_active = ${isActive}`)
    if (validatedAppliesTo !== undefined) updates.push(`applies_to = '${JSON.stringify(validatedAppliesTo)}'::jsonb`)

    if (updates.length > 0) {
      const query = `UPDATE tasks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ${id}`
      await prisma.$executeRawUnsafe(query)
    }

    // Fetch updated task
    const updatedTask = await prisma.$queryRawUnsafe(
      `SELECT id, family_id, name, category, type, time_per_unit, 
              weekly_rule, sort_order, is_active, applies_to, created_at, updated_at
       FROM tasks WHERE id = ${id} LIMIT 1`
    ) as any[]

    console.log(`[UPDATE TASK] Success: Task ${id} updated`)

    res.json({
      status: 'success',
      message: 'Task updated successfully',
      data: updatedTask[0],
    })
  } catch (error: any) {
    console.error('[UPDATE TASK] Error:', error)
    throw new AppError(500, `Update failed: ${error.message}`)
  }
})

/**
 * DELETE /:id - Delete task
 */
tasksRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const { familyId, userId } = req.user!

    console.log(`[DELETE TASK] User ${userId}, Task ${id}, Family ${familyId}`)

    // First check if task exists at all
    const anyTask = await prisma.$queryRawUnsafe(
      `SELECT id, family_id, name FROM tasks WHERE id = ${id} LIMIT 1`
    ) as any[]

    if (!anyTask || anyTask.length === 0) {
      console.log(`[DELETE TASK] Task ${id} not found in database`)
      throw new AppError(404, '任务不存在')
    }

    const task = anyTask[0]
    console.log(`[DELETE TASK] Found task:`, task)

    // Check if task belongs to user's family
    if (task.family_id !== familyId) {
      console.log(`[DELETE TASK] Task family_id ${task.family_id} != user family_id ${familyId}`)
      throw new AppError(403, '您没有权限删除此任务')
    }

    // Soft delete by marking as inactive
    await prisma.$executeRawUnsafe(
      `UPDATE tasks SET is_active = false WHERE id = ${id}`
    )

    console.log(`[DELETE TASK] Success: Task ${id} marked as inactive`)

    res.json({
      status: 'success',
      message: 'Task deleted successfully',
    })
  } catch (error: any) {
    console.error('[DELETE TASK] Error:', error)
    throw new AppError(500, `删除失败: ${error.message}`)
  }
})

/**
 * POST /publish - Publish weekly plan for children
 * Body: { childIds, weekNo }
 *
 * Smart allocation rules:
 * - school homework: Mon/Tue/Thu/Fri (exclude day 3 - Wednesday)
 * - school advanced (培优/高思/全新英语): weekend only (day 0, 6)
 * - OD course urgency: remaining >= days left in week
 * - daily limit: 210 minutes
 */
tasksRouter.post('/publish', async (req: AuthRequest, res: Response) => {
  const { childIds, weekNo } = req.body
  const { familyId } = req.user!

  if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
    throw new AppError(400, 'Missing or invalid childIds')
  }

  if (!weekNo) {
    throw new AppError(400, 'Missing weekNo')
  }

  // Get all active tasks for the family
  const tasks = await prisma.task.findMany({
    where: { familyId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  if (tasks.length === 0) {
    throw new AppError(400, 'No active tasks found. Please create tasks first.')
  }

  // Verify all children belong to the family
  const children = await prisma.user.findMany({
    where: {
      id: { in: childIds },
      familyId,
      role: 'child',
      status: 'active',
    },
  })

  if (children.length !== childIds.length) {
    throw new AppError(400, 'Some children not found or do not belong to your family')
  }

  // Get family settings for daily time limit
  const family = await prisma.family.findUnique({
    where: { id: familyId },
  })

  const settings = family?.settings as { dailyTimeLimit?: number } | null
  const dailyTimeLimit = settings?.dailyTimeLimit || 210

  // Calculate allocations for each child
  const results: Array<{
    childId: number
    childName: string
    allocation: Array<{
      taskId: number
      taskName: string
      category: string
      type: string
      timePerUnit: number
      target: number
      weeklyRule: any
      daysAllocated: number[]
    }>
  }> = []

  // Use transaction for atomicity
  await prisma.$transaction(async (tx) => {
    for (const child of children) {
      // Delete existing plans for this week
      await tx.weeklyPlan.deleteMany({
        where: { childId: child.id, weekNo },
      })

      const allocation: Array<{
        taskId: number
        taskName: string
        category: string
        type: string
        timePerUnit: number
        target: number
        weeklyRule: any
        daysAllocated: number[]
      }> = []

      const dayTimeUsed = [0, 0, 0, 0, 0, 0, 0] // Time used per day (0=Sun, 6=Sat)

      // Filter tasks that apply to this child
      // appliesTo is empty array [] means applies to all children
      const childTasks = tasks.filter(task => {
        const appliesTo = task.appliesTo as number[] | null
        return !appliesTo || appliesTo.length === 0 || appliesTo.includes(child.id)
      })

      // Sort tasks by priority
      // Fixed tasks first, then flexible
      const sortedTasks = [...childTasks].sort((a, b) => {
        if (a.type === 'fixed' && b.type !== 'fixed') return -1
        if (a.type !== 'fixed' && b.type === 'fixed') return 1
        return a.sortOrder - b.sortOrder
      })

      for (const task of sortedTasks) {
        const weeklyRule = task.weeklyRule as {
          excludeDays?: number[]
          onlyWeekend?: boolean
          days?: number[]
        } | null

        let allowedDays: number[] = []

        // Determine allowed days based on task category and rules
        if (task.category === 'school') {
          // School homework: exclude Wednesday (day 3)
          // School advanced (培优/高思/全新英语): weekend only
          if (task.name.includes('培优') || task.name.includes('高思') || task.name.includes('全新英语')) {
            allowedDays = [0, 6] // Weekend only
          } else {
            allowedDays = [1, 2, 4, 5] // Mon, Tue, Thu, Fri (exclude Wed=3)
          }
        } else {
          // Default: all days
          allowedDays = [0, 1, 2, 3, 4, 5, 6]
        }

        // Apply weekly rule overrides
        if (weeklyRule?.onlyWeekend) {
          allowedDays = allowedDays.filter(d => d === 0 || d === 6)
        }
        if (weeklyRule?.excludeDays && weeklyRule.excludeDays.length > 0) {
          allowedDays = allowedDays.filter(d => !weeklyRule.excludeDays!.includes(d))
        }
        if (weeklyRule?.days && weeklyRule.days.length > 0) {
          allowedDays = weeklyRule.days
        }

        // Filter out days where daily limit would be exceeded
        const daysAllocated: number[] = []
        for (const day of allowedDays) {
          if (dayTimeUsed[day] + task.timePerUnit <= dailyTimeLimit) {
            daysAllocated.push(day)
            dayTimeUsed[day] += task.timePerUnit
          }
        }

        // Create weekly plan for this task
        const target = daysAllocated.length
        if (target > 0) {
          await tx.weeklyPlan.create({
            data: {
              familyId,
              childId: child.id,
              taskId: task.id,
              target,
              progress: 0,
              weekNo,
              status: 'active',
            },
          })

          allocation.push({
            taskId: task.id,
            taskName: task.name,
            category: task.category,
            type: task.type,
            timePerUnit: task.timePerUnit,
            target,
            weeklyRule,
            daysAllocated,
          })
        }
      }

      results.push({
        childId: child.id,
        childName: child.name,
        allocation,
      })
    }
  })

  res.json({
    status: 'success',
    message: 'Weekly plan published successfully',
    data: {
      weekNo,
      children: results,
      summary: {
        totalTasks: tasks.length,
        totalChildren: children.length,
        dailyTimeLimit,
      },
    },
  })
})
