import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import axios from 'axios'

export const aiRouter: Router = Router()

// All routes require authentication and parent role
aiRouter.use(authMiddleware)
aiRouter.use(requireRole('parent'))

/**
 * POST /analyze-dashboard - Analyze today's task completion status with AI
 * Body: { childId, date }
 */
aiRouter.post('/analyze-dashboard', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId, date } = req.body

  if (!childId) {
    throw new AppError(400, 'Missing required field: childId')
  }

  // Get child information
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId, role: 'child' },
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  // Get target date
  let targetDate: Date
  if (date) {
    const [year, month, day] = date.split('-').map(Number)
    targetDate = new Date(year, month - 1, day)
  } else {
    targetDate = new Date()
  }
  targetDate.setHours(0, 0, 0, 0)
  const targetDateEnd = new Date(targetDate)
  targetDateEnd.setHours(23, 59, 59, 999)

  // Get child's weekly plans
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      childId,
      status: 'active'
    },
    include: {
      task: true
    }
  })

  // Get target date's checkins
  const todayCheckins = await prisma.dailyCheckin.findMany({
    where: {
      childId,
      checkDate: {
        gte: targetDate,
        lte: targetDateEnd
      }
    },
    include: {
      plan: {
        include: { task: true }
      }
    }
  })

  // Get target date's day of week
  const todayDayOfWeek = targetDate.getDay()

  // Filter plans scheduled for target date
  const todayScheduledPlans = weeklyPlans.filter(plan => {
    let assignedDays: number[] = []
    if (plan.assignedDays) {
      try {
        const parsedDays = typeof plan.assignedDays === 'string' ? JSON.parse(plan.assignedDays) : plan.assignedDays
        if (Array.isArray(parsedDays)) {
          assignedDays = parsedDays
        }
      } catch (e) {
        console.error('Failed to parse assignedDays:', e)
      }
    }

    if (assignedDays.length === 0) {
      const taskTags = plan.task.tags as any || {}
      const taskWeeklyRule = plan.task.weeklyRule as any || {}
      const scheduleRule = taskTags.scheduleRule || taskWeeklyRule.scheduleRule || 'daily'

      if (scheduleRule === 'daily') {
        assignedDays = [0, 1, 2, 3, 4, 5, 6]
      } else if (scheduleRule === 'school') {
        assignedDays = [1, 2, 4, 5]
      } else if (scheduleRule === 'weekend') {
        assignedDays = [0, 6]
      } else if (scheduleRule === 'flexible') {
        assignedDays = [1, 2, 3, 4, 5]
      } else {
        assignedDays = [0, 1, 2, 3, 4, 5, 6]
      }
    }

    return assignedDays.includes(todayDayOfWeek)
  })

  // Group tasks by status
  const tasksByStatus = {
    completed: [] as any[],
    partial: [] as any[],
    postponed: [] as any[],
    notCompleted: [] as any[],
    notInvolved: [] as any[]
  }

  const checkinMap = new Map<number, any>()
  todayCheckins.forEach(checkin => {
    if (checkin.planId) {
      checkinMap.set(checkin.planId, checkin)
    }
  })

  todayScheduledPlans.forEach(plan => {
    const checkin = checkinMap.get(plan.id)
    if (checkin) {
      const taskWithCheckin = {
        name: plan.task.name,
        category: plan.task.category,
        timePerUnit: plan.task.timePerUnit,
        actualTime: checkin.completedValue !== null ? checkin.completedValue : plan.task.timePerUnit,
        notes: checkin.notes || '',
        status: checkin.status
      }
      if (checkin.status === 'completed') {
        tasksByStatus.completed.push(taskWithCheckin)
      } else if (checkin.status === 'partial') {
        tasksByStatus.partial.push(taskWithCheckin)
      } else if (checkin.status === 'postponed') {
        tasksByStatus.postponed.push(taskWithCheckin)
      } else if (checkin.status === 'not_involved') {
        tasksByStatus.notInvolved.push(taskWithCheckin)
      } else {
        tasksByStatus.notCompleted.push(taskWithCheckin)
      }
    } else {
      tasksByStatus.notCompleted.push({
        name: plan.task.name,
        category: plan.task.category,
        timePerUnit: plan.task.timePerUnit,
        actualTime: 0,
        notes: '',
        status: 'not_completed'
      })
    }
  })

  // Add not involved tasks
  const todayScheduledTaskIds = new Set(todayScheduledPlans.map(plan => plan.task.id))
  weeklyPlans.forEach(plan => {
    if (!todayScheduledTaskIds.has(plan.task.id)) {
      tasksByStatus.notInvolved.push({
        name: plan.task.name,
        category: plan.task.category,
        timePerUnit: plan.task.timePerUnit,
        actualTime: 0,
        notes: '',
        status: 'not_involved'
      })
    }
  })

  // Calculate statistics
  const totalTasks = todayScheduledPlans.length
  const completedTasks = tasksByStatus.completed.length
  const partialTasks = tasksByStatus.partial.length
  const postponedTasks = tasksByStatus.postponed.length
  const notCompletedTasks = tasksByStatus.notCompleted.length
  const notInvolvedTasks = tasksByStatus.notInvolved.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const actualStudyMinutes = todayCheckins
    .filter(c => c.status === 'completed' || c.status === 'partial')
    .reduce((sum, c) => sum + (c.completedValue || 0), 0)

  // Get AI configuration
  const aiConfig = await prisma.userAIConfig.findFirst({
    where: { familyId, isActive: true },
    orderBy: { updatedAt: 'desc' }
  })
  const aiSettings =
    aiConfig?.config && typeof aiConfig.config === 'object' && !Array.isArray(aiConfig.config)
      ? (aiConfig.config as { apiKey?: string })
      : null

  // Generate AI analysis
  let analysis: any
  if (aiConfig && aiConfig.provider === 'kimi' && aiSettings?.apiKey) {
    // Use real Kimi AI
    analysis = await generateKimiAnalysis(
      child.name,
      targetDate,
      totalTasks,
      completedTasks,
      partialTasks,
      postponedTasks,
      notCompletedTasks,
      notInvolvedTasks,
      completionRate,
      actualStudyMinutes,
      tasksByStatus,
      aiSettings.apiKey
    )
  } else {
    // Fallback to rule-based analysis
    analysis = generateRuleBasedAnalysis(
      child.name,
      targetDate,
      totalTasks,
      completedTasks,
      partialTasks,
      postponedTasks,
      notCompletedTasks,
      notInvolvedTasks,
      completionRate,
      actualStudyMinutes,
      tasksByStatus
    )
  }

  res.json({
    success: true,
    data: analysis
  })
})

async function generateKimiAnalysis(
  childName: string,
  targetDate: Date,
  totalTasks: number,
  completedTasks: number,
  partialTasks: number,
  postponedTasks: number,
  notCompletedTasks: number,
  notInvolvedTasks: number,
  completionRate: number,
  actualStudyMinutes: number,
  tasksByStatus: any,
  apiKey: string
): Promise<any> {
  const dateStr = `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
  const studyHours = Math.floor(actualStudyMinutes / 60)
  const studyMins = actualStudyMinutes % 60
  const studyTimeStr = studyHours > 0 ? `${studyHours}小时${studyMins}分钟` : `${studyMins}分钟`

  // Build task lists
  const completedList = tasksByStatus.completed.map((t: any, i: number) => `${i + 1}. ${t.name}（实际用时${t.actualTime}分钟${t.notes ? '，备注：' + t.notes : ''}）`).join('\n')
  const partialList = tasksByStatus.partial.map((t: any, i: number) => `${i + 1}. ${t.name}（实际用时${t.actualTime}分钟${t.notes ? '，备注：' + t.notes : ''}）`).join('\n')
  const postponedList = tasksByStatus.postponed.map((t: any, i: number) => `${i + 1}. ${t.name}（${t.timePerUnit}分钟）`).join('\n')
  const notCompletedList = tasksByStatus.notCompleted.map((t: any, i: number) => `${i + 1}. ${t.name}（${t.timePerUnit}分钟）`).join('\n')
  const notInvolvedList = tasksByStatus.notInvolved.map((t: any, i: number) => `${i + 1}. ${t.name}（${t.timePerUnit}分钟）`).join('\n')

  const prompt = `你是一位资深儿童教育专家。请分析${childName}在${dateStr}的学习情况，并给出专业、有针对性的建议。

【学习数据】
- 总任务数：${totalTasks}项
- 已完成：${completedTasks}项
- 部分完成：${partialTasks}项
- 推迟：${postponedTasks}项
- 未完成：${notCompletedTasks}项
- 今日不涉及：${notInvolvedTasks}项
- 完成率：${completionRate}%
- 实际学习时长：${studyTimeStr}

${completedTasks > 0 ? `【已完成任务】\n${completedList}` : ''}
${partialTasks > 0 ? `【部分完成任务】\n${partialList}` : ''}
${postponedTasks > 0 ? `【推迟任务】\n${postponedList}` : ''}
${notCompletedTasks > 0 ? `【未完成任务】\n${notCompletedList}` : ''}
${notInvolvedTasks > 0 ? `【今日不涉及】\n${notInvolvedList}` : ''}

请以JSON格式返回分析结果，包含以下字段：
{
  "overallEvaluation": "总体评价（2-3句话，基于实际数据）",
  "taskCompletionAnalysis": "任务完成情况分析",
  "learningEfficiencyAnalysis": "学习效率分析",
  "strengths": "学习亮点（2-3点具体优点）",
  "improvementSuggestions": "改进建议（2-3点具体建议）",
  "tomorrowPlan": "明日计划建议"
}

请确保所有分析严格基于上述数据，不得编造数据。`

  try {
    const response = await axios.post(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        messages: [{ role: 'user', content: prompt }],
        model: 'moonshot-v1-8k'
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const aiResponseText = response.data.choices[0].message.content
    try {
      return JSON.parse(aiResponseText)
    } catch (e) {
      console.error('Kimi AI返回结果非JSON格式:', aiResponseText)
      return generateRuleBasedAnalysis(
        childName, targetDate, totalTasks, completedTasks, partialTasks,
        postponedTasks, notCompletedTasks, notInvolvedTasks, completionRate,
        actualStudyMinutes, tasksByStatus
      )
    }
  } catch (error) {
    console.error('Error calling Kimi AI API:', error)
    return generateRuleBasedAnalysis(
      childName, targetDate, totalTasks, completedTasks, partialTasks,
      postponedTasks, notCompletedTasks, notInvolvedTasks, completionRate,
      actualStudyMinutes, tasksByStatus
    )
  }
}

function generateRuleBasedAnalysis(
  childName: string,
  targetDate: Date,
  totalTasks: number,
  completedTasks: number,
  partialTasks: number,
  postponedTasks: number,
  notCompletedTasks: number,
  notInvolvedTasks: number,
  completionRate: number,
  actualStudyMinutes: number,
  tasksByStatus: any
): any {
  void notInvolvedTasks
  void tasksByStatus
  const dateStr = `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
  const studyHours = Math.floor(actualStudyMinutes / 60)
  const studyMins = actualStudyMinutes % 60
  const studyTimeStr = studyHours > 0 ? `${studyHours}小时${studyMins}分钟` : `${studyMins}分钟`

  // Overall evaluation
  let overallEvaluation = ''
  if (completionRate >= 80) {
    overallEvaluation = `${childName}在${dateStr}表现优秀！完成了${completedTasks}项任务，完成率达到${completionRate}%，学习态度认真，继续保持！`
  } else if (completionRate >= 60) {
    overallEvaluation = `${childName}在${dateStr}表现良好，完成了${completedTasks}项任务，完成率为${completionRate}%，还有提升空间，继续加油！`
  } else if (completionRate >= 40) {
    overallEvaluation = `${childName}在${dateStr}完成率偏低，只完成了${completedTasks}项任务，完成率为${completionRate}%，需要调整学习计划。`
  } else {
    overallEvaluation = `${childName}在${dateStr}完成率较低，只完成了${completedTasks}项任务，完成率为${completionRate}%，建议家长多关注学习情况。`
  }

  // Task completion analysis
  const taskCompletionAnalysis = `今日安排了${totalTasks}项任务，${completedTasks}项已完成，${partialTasks}项部分完成，${postponedTasks}项推迟，${notCompletedTasks}项未完成。`

  // Learning efficiency analysis
  let learningEfficiencyAnalysis = ''
  if (actualStudyMinutes > 0 && totalTasks > 0) {
    const avgTime = Math.round(actualStudyMinutes / (completedTasks + partialTasks))
    if (avgTime <= 30) {
      learningEfficiencyAnalysis = `学习效率较高，平均每项任务用时${avgTime}分钟，能够在有限时间内完成较多任务。`
    } else if (avgTime <= 60) {
      learningEfficiencyAnalysis = `学习效率适中，平均每项任务用时${avgTime}分钟，建议进一步优化学习方法。`
    } else {
      learningEfficiencyAnalysis = `学习效率有提升空间，平均每项任务用时${avgTime}分钟，建议分析原因并调整。`
    }
  } else {
    learningEfficiencyAnalysis = `今日暂无有效学习时长数据。`
  }

  // Strengths
  const strengths: string[] = []
  if (completedTasks >= totalTasks * 0.6) {
    strengths.push('大部分任务能够完成，说明学习态度认真')
  }
  if (actualStudyMinutes >= 120) {
    strengths.push('学习投入时间充足，学习积极性高')
  }
  if (partialTasks > 0) {
    strengths.push('部分任务有进展，说明在努力尝试')
  }
  if (strengths.length === 0) {
    strengths.push('开始学习和完成任务是第一步，继续坚持')
  }

  // Improvement suggestions
  const improvementSuggestions: string[] = []
  if (completionRate < 60) {
    improvementSuggestions.push('建议合理安排学习时间，优先完成重要任务')
    improvementSuggestions.push('可以将大任务分解为小任务，逐步完成')
  }
  if (actualStudyMinutes < 60) {
    improvementSuggestions.push('建议适当增加每日学习时间，保持学习的连续性')
  }
  if (notCompletedTasks > 2) {
    improvementSuggestions.push('未完成任务较多，建议分析原因并调整任务难度')
  }
  if (improvementSuggestions.length === 0) {
    improvementSuggestions.push('继续保持良好的学习习惯')
    improvementSuggestions.push('可以尝试挑战更高难度的任务')
  }

  // Tomorrow plan
  let tomorrowPlan = ''
  if (completionRate >= 80) {
    tomorrowPlan = '建议保持今日的学习状态，可以适当增加任务难度或数量，挑战自己的学习能力。'
  } else if (completionRate >= 60) {
    tomorrowPlan = '建议保持今日的学习节奏，重点关注未完成的任务类型，确保任务的均衡完成。'
  } else {
    tomorrowPlan = '建议减少明日的任务数量，确保能够完成大部分任务，逐步提高完成率。'
  }

  return {
    overallEvaluation,
    taskCompletionAnalysis,
    learningEfficiencyAnalysis,
    strengths,
    improvementSuggestions,
    tomorrowPlan
  }
}
