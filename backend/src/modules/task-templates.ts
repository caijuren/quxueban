import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const taskTemplatesRouter: Router = Router()

taskTemplatesRouter.use(authMiddleware)

// ============================================
// 任务模板 CRUD - 仅家长可访问
// ============================================

// 为任务模板 CRUD 操作添加家长角色限制
const parentOnly = requireRole('parent')

// 获取所有任务模板
taskTemplatesRouter.get('/templates', parentOnly, async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { type, subject } = req.query

  const templates = await prisma.$queryRaw`
    SELECT * FROM task_templates 
    WHERE family_id = ${familyId} AND is_active = true
    ${type ? prisma.$queryRaw`AND type = ${type}` : prisma.$queryRaw``}
    ORDER BY sort_order, created_at DESC
  `

  res.json({ status: 'success', data: templates })
})

// 创建任务模板
taskTemplatesRouter.post('/templates', parentOnly, async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const {
    name, type, subject, singleDuration, difficulty,
    description, coverUrl, scheduleRule, defaultWeeklyTarget
  } = req.body

  if (!name || !type) {
    throw new AppError(400, '缺少必填字段：name, type')
  }

  const template = await prisma.$queryRaw`
    INSERT INTO task_templates (name, type, subject, single_duration, difficulty, description, cover_url, schedule_rule, default_weekly_target, family_id)
    VALUES (${name}, ${type}, ${subject || null}, ${singleDuration || 30}, ${difficulty || 'basic'}, ${description || null}, ${coverUrl || null}, ${scheduleRule || 'daily'}, ${defaultWeeklyTarget || null}, ${familyId})
    RETURNING *
  `

  res.status(201).json({ status: 'success', message: '模板创建成功', data: (template as any[])[0] })
})

// 更新任务模板
taskTemplatesRouter.put('/templates/:id', parentOnly, async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const id = parseInt(req.params.id as string)
  const updates = req.body

  const existing = await prisma.$queryRaw`
    SELECT id FROM task_templates WHERE id = ${id} AND family_id = ${familyId}
  ` as any[]

  if (!existing?.length) {
    throw new AppError(404, '模板不存在')
  }

  const template = await prisma.$queryRaw`
    UPDATE task_templates SET
      name = COALESCE(${updates.name || null}, name),
      type = COALESCE(${updates.type || null}, type),
      subject = ${updates.subject !== undefined ? updates.subject : null},
      single_duration = COALESCE(${updates.singleDuration || null}, single_duration),
      difficulty = COALESCE(${updates.difficulty || null}, difficulty),
      description = ${updates.description !== undefined ? updates.description : null},
      schedule_rule = COALESCE(${updates.scheduleRule || null}, schedule_rule),
      default_weekly_target = ${updates.defaultWeeklyTarget !== undefined ? updates.defaultWeeklyTarget : null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  ` as any[]

  res.json({ status: 'success', message: '模板更新成功', data: template[0] })
})

// 删除任务模板
taskTemplatesRouter.delete('/templates/:id', parentOnly, async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const id = parseInt(req.params.id as string)

  const existing = await prisma.$queryRaw`
    SELECT id FROM task_templates WHERE id = ${id} AND family_id = ${familyId}
  ` as any[]

  if (!existing?.length) {
    throw new AppError(404, '模板不存在')
  }

  await prisma.$queryRaw`UPDATE task_templates SET is_active = false WHERE id = ${id}`
  res.json({ status: 'success', message: '模板已删除' })
})

// ============================================
// 孩子任务实例管理
// ============================================

// 获取孩子的所有任务实例
taskTemplatesRouter.get('/children/:childId/tasks', async (req: AuthRequest, res: Response) => {
  const { familyId, userId, role } = req.user!
  const childId = parseInt(req.params.childId as string)

  // 验证权限：家长可以查看所有孩子的任务，孩子只能查看自己的任务
  if (role === 'child' && userId !== childId) {
    throw new AppError(403, '无权限查看其他孩子的任务')
  }

  // 验证孩子属于该家庭
  const child = await prisma.$queryRaw`
    SELECT id FROM users WHERE id = ${childId} AND family_id = ${familyId} AND role = 'child'
  ` as any[]

  if (!child?.length) {
    throw new AppError(404, '孩子不存在或不属于该家庭')
  }

  const tasks = await prisma.$queryRaw`
    SELECT ct.*, tt.name as template_name, tt.type as template_type, tt.subject, tt.single_duration as template_duration, tt.schedule_rule as schedule_rule
    FROM child_tasks ct
    JOIN task_templates tt ON ct.task_template_id = tt.id
    WHERE ct.child_id = ${childId} AND ct.family_id = ${familyId}
    ORDER BY ct.created_at DESC
  `

  res.json({ status: 'success', data: tasks })
})

// 为孩子分配任务（从模板创建实例）
taskTemplatesRouter.post('/children/:childId/tasks', parentOnly, async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = parseInt(req.params.childId as string)
  const {
    taskTemplateId, customName, customDuration, customScheduleRule,
    weeklyTarget, skipHolidays, excludeDays, startDate, endDate
  } = req.body

  if (!taskTemplateId) {
    throw new AppError(400, '缺少任务模板ID')
  }

  // 验证模板和孩子
  const template = await prisma.$queryRaw`
    SELECT * FROM task_templates WHERE id = ${taskTemplateId} AND family_id = ${familyId} AND is_active = true
  ` as any[]

  if (!template?.length) {
    throw new AppError(404, '任务模板不存在')
  }

  const child = await prisma.$queryRaw`
    SELECT id FROM users WHERE id = ${childId} AND family_id = ${familyId} AND role = 'child'
  ` as any[]

  if (!child?.length) {
    throw new AppError(404, '孩子不存在')
  }

  // 检查是否已分配
  const existing = await prisma.$queryRaw`
    SELECT id FROM child_tasks WHERE child_id = ${childId} AND task_template_id = ${taskTemplateId}
  ` as any[]

  if (existing?.length) {
    throw new AppError(400, '该任务已分配给此孩子')
  }

  await prisma.$queryRaw`
    INSERT INTO child_tasks (child_id, task_template_id, custom_name, custom_duration, custom_schedule_rule, weekly_target, skip_holidays, exclude_days, start_date, end_date, family_id)
    VALUES (${childId}, ${taskTemplateId}, ${customName || null}, ${customDuration || null}, ${customScheduleRule || null}, ${weeklyTarget || null}, ${skipHolidays !== false}, ${excludeDays || null}, ${startDate || null}, ${endDate || null}, ${familyId})
  `

  const newTask = await prisma.$queryRaw`
    SELECT * FROM child_tasks WHERE child_id = ${childId} AND task_template_id = ${taskTemplateId}
  ` as any[]

  res.status(201).json({ status: 'success', message: '任务分配成功', data: newTask[0] })
})

// 更新孩子任务实例
taskTemplatesRouter.put('/children/:childId/tasks/:taskId', parentOnly, async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = parseInt(req.params.childId as string)
  const taskId = parseInt(req.params.taskId as string)
  const updates = req.body

  const existing = await prisma.$queryRaw`
    SELECT * FROM child_tasks WHERE id = ${taskId} AND child_id = ${childId} AND family_id = ${familyId}
  ` as any[]

  if (!existing?.length) {
    throw new AppError(404, '任务实例不存在')
  }

  const updated = await prisma.$queryRaw`
    UPDATE child_tasks SET
      custom_name = ${updates.customName !== undefined ? updates.customName : existing[0].custom_name},
      custom_duration = ${updates.customDuration !== undefined ? updates.customDuration : existing[0].custom_duration},
      custom_schedule_rule = ${updates.customScheduleRule !== undefined ? updates.customScheduleRule : existing[0].custom_schedule_rule},
      weekly_target = ${updates.weeklyTarget !== undefined ? updates.weeklyTarget : existing[0].weekly_target},
      status = COALESCE(${updates.status || null}, status),
      skip_holidays = ${updates.skipHolidays !== undefined ? updates.skipHolidays : existing[0].skip_holidays},
      exclude_days = ${updates.excludeDays !== undefined ? updates.excludeDays : existing[0].exclude_days},
      updated_at = NOW()
    WHERE id = ${taskId}
    RETURNING *
  ` as any[]

  res.json({ status: 'success', message: '任务更新成功', data: updated[0] })
})

// 删除孩子任务实例
taskTemplatesRouter.delete('/children/:childId/tasks/:taskId', parentOnly, async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = parseInt(req.params.childId as string)
  const taskId = parseInt(req.params.taskId as string)

  const existing = await prisma.$queryRaw`
    SELECT id FROM child_tasks WHERE id = ${taskId} AND child_id = ${childId} AND family_id = ${familyId}
  ` as any[]

  if (!existing?.length) {
    throw new AppError(404, '任务实例不存在')
  }

  await prisma.$queryRaw`DELETE FROM child_tasks WHERE id = ${taskId}`
  res.json({ status: 'success', message: '任务已移除' })
})

// 批量分配任务给多个孩子
taskTemplatesRouter.post('/templates/:templateId/assign', parentOnly, async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const templateId = parseInt(req.params.templateId as string)
  const { childIds } = req.body

  if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
    throw new AppError(400, '请选择要分配的孩子')
  }

  // 验证模板
  const template = await prisma.$queryRaw`
    SELECT * FROM task_templates WHERE id = ${templateId} AND family_id = ${familyId} AND is_active = true
  ` as any[]

  if (!template?.length) {
    throw new AppError(404, '任务模板不存在')
  }

  // 验证孩子 - 使用参数化 IN 查询
  const children = await prisma.$queryRaw`
    SELECT id FROM users WHERE id = ANY(${childIds}) AND family_id = ${familyId} AND role = 'child'
  ` as any[]

  if (children.length !== childIds.length) {
    throw new AppError(400, '部分孩子不存在或不属于该家庭')
  }

  // 批量创建
  const results: any[] = []
  for (const child of children) {
    // 检查是否已分配
    const existing = await prisma.$queryRaw`
      SELECT id FROM child_tasks WHERE child_id = ${child.id} AND task_template_id = ${templateId}
    ` as any[]

    if (!existing?.length) {
      await prisma.$queryRaw`
        INSERT INTO child_tasks (child_id, task_template_id, family_id)
        VALUES (${child.id}, ${templateId}, ${familyId})
      `
      results.push({ childId: child.id, status: 'created' })
    } else {
      results.push({ childId: child.id, status: 'already_exists' })
    }
  }

  res.json({ status: 'success', message: '批量分配完成', data: results })
})

export default taskTemplatesRouter
