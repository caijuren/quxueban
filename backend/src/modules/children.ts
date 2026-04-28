import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const childrenRouter: Router = Router()

childrenRouter.use(authMiddleware)
childrenRouter.use(requireRole('parent'))

type ChildSemesterSettings = {
  schoolYear: string
  term: 'first' | 'second'
  grade: string
  startDate: string
  endDate: string
  readingStage?: string
}

type ChildProfileSettings = {
  gender: 'male' | 'female' | 'unset'
  className: string
  customTags: string[]
  interestTags: string[]
  defaultAbilityLevel: string
  defaultLearningGoal: string
  pushEnabled: boolean
  pushFrequency: string
  pushTime: string
  pushContents: string[]
}

const defaultChildProfile: ChildProfileSettings = {
  gender: 'unset',
  className: '',
  customTags: [],
  interestTags: [],
  defaultAbilityLevel: 'L1（一年级）',
  defaultLearningGoal: '',
  pushEnabled: false,
  pushFrequency: '每日一次',
  pushTime: '18:30',
  pushContents: ['学习日报', '任务提醒', '阅读提醒'],
}

function sanitizeStringList(value: unknown, maxItems = 20, maxLength = 30): string[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, maxItems)
}

function sanitizeChildProfile(input: any): ChildProfileSettings {
  const gender = input?.gender === 'male' || input?.gender === 'female' ? input.gender : 'unset'
  const pushFrequencyOptions = ['每日一次', '每周一次', '仅重要提醒']
  const pushFrequency = pushFrequencyOptions.includes(input?.pushFrequency) ? input.pushFrequency : defaultChildProfile.pushFrequency
  const pushTime = typeof input?.pushTime === 'string' && /^\d{2}:\d{2}$/.test(input.pushTime)
    ? input.pushTime
    : defaultChildProfile.pushTime

  return {
    gender,
    className: typeof input?.className === 'string' ? input.className.trim().slice(0, 50) : '',
    customTags: sanitizeStringList(input?.customTags),
    interestTags: sanitizeStringList(input?.interestTags),
    defaultAbilityLevel: typeof input?.defaultAbilityLevel === 'string' ? input.defaultAbilityLevel.trim().slice(0, 30) : defaultChildProfile.defaultAbilityLevel,
    defaultLearningGoal: typeof input?.defaultLearningGoal === 'string' ? input.defaultLearningGoal.trim().slice(0, 100) : '',
    pushEnabled: Boolean(input?.pushEnabled),
    pushFrequency,
    pushTime,
    pushContents: sanitizeStringList(input?.pushContents, 10, 30),
  }
}

function validateDateString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, `${fieldName} 格式应为 YYYY-MM-DD`)
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new AppError(400, `${fieldName} 不是有效日期`)
  }

  return value
}

async function ensureChildInFamily(childId: number, familyId: number) {
  const child = await prisma.user.findFirst({
    where: {
      id: childId,
      familyId,
      role: 'child',
      status: 'active',
    },
  })

  if (!child) {
    throw new AppError(404, '孩子不存在')
  }

  return child
}

// 获取家庭下所有孩子列表
childrenRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  
  const children = await prisma.user.findMany({
    where: { 
      familyId,
      role: 'child',
      status: 'active'
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      status: true
    },
    orderBy: { id: 'asc' }
  })
  
  res.json({ status: 'success', data: children })
})

// 获取孩子扩展档案配置
childrenRouter.get('/:childId/profile', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = parseInt(req.params.childId as string)

  if (isNaN(childId)) {
    throw new AppError(400, '无效的孩子ID')
  }

  await ensureChildInFamily(childId, familyId)

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })

  const settings = (family?.settings as any) || {}
  const profile = {
    ...defaultChildProfile,
    ...(settings.childProfiles?.[String(childId)] || {}),
  }

  res.json({
    status: 'success',
    data: profile,
  })
})

// 更新孩子扩展档案配置
childrenRouter.put('/:childId/profile', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = parseInt(req.params.childId as string)

  if (isNaN(childId)) {
    throw new AppError(400, '无效的孩子ID')
  }

  await ensureChildInFamily(childId, familyId)

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const currentSettings = (family.settings as any) || {}
  const nextProfile = sanitizeChildProfile(req.body)

  await prisma.family.update({
    where: { id: familyId },
    data: {
      settings: {
        ...currentSettings,
        childProfiles: {
          ...(currentSettings.childProfiles || {}),
          [String(childId)]: nextProfile,
        },
      },
    },
  })

  res.json({
    status: 'success',
    message: '孩子档案已保存',
    data: nextProfile,
  })
})

// 获取孩子的当前学期配置
childrenRouter.get('/:childId/semester', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = parseInt(req.params.childId as string)

  if (isNaN(childId)) {
    throw new AppError(400, '无效的孩子ID')
  }

  await ensureChildInFamily(childId, familyId)

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })

  const settings = (family?.settings as any) || {}
  const semester = settings.childSemesters?.[String(childId)] || null

  res.json({
    status: 'success',
    data: semester,
  })
})

// 更新孩子的当前学期配置
childrenRouter.put('/:childId/semester', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const childId = parseInt(req.params.childId as string)
  const { schoolYear, term, grade, startDate, endDate, readingStage } = req.body

  if (isNaN(childId)) {
    throw new AppError(400, '无效的孩子ID')
  }

  await ensureChildInFamily(childId, familyId)

  if (typeof schoolYear !== 'string' || !schoolYear.trim()) {
    throw new AppError(400, '请输入学年')
  }
  if (term !== 'first' && term !== 'second') {
    throw new AppError(400, '请选择上学期或下学期')
  }
  if (typeof grade !== 'string' || !grade.trim()) {
    throw new AppError(400, '请输入年级')
  }

  const validStartDate = validateDateString(startDate, '开始日期')
  const validEndDate = validateDateString(endDate, '结束日期')

  if (new Date(validStartDate) > new Date(validEndDate)) {
    throw new AppError(400, '开始日期不能晚于结束日期')
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { settings: true },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const currentSettings = (family.settings as any) || {}
  const nextSemester: ChildSemesterSettings = {
    schoolYear: schoolYear.trim(),
    term,
    grade: grade.trim(),
    startDate: validStartDate,
    endDate: validEndDate,
    readingStage: typeof readingStage === 'string' ? readingStage.trim().slice(0, 50) : '',
  }

  await prisma.family.update({
    where: { id: familyId },
    data: {
      settings: {
        ...currentSettings,
        childSemesters: {
          ...(currentSettings.childSemesters || {}),
          [String(childId)]: nextSemester,
        },
      },
    },
  })

  res.json({
    status: 'success',
    message: '学期配置已保存',
    data: nextSemester,
  })
})

// 获取孩子的钉钉配置
childrenRouter.get('/:childId/dingtalk-config', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId } = req.params

  const child = await prisma.user.findFirst({
    where: { 
      id: parseInt(childId as string),
      familyId,
      role: 'child'
    },
    select: {
      id: true,
      name: true,
      dingtalkWebhookUrl: true,
      dingtalkSecret: true
    }
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  res.json({ 
    status: 'success', 
    data: {
      childId: child.id,
      childName: child.name,
      webhookUrl: child.dingtalkWebhookUrl,
      secret: child.dingtalkSecret
    } 
  })
})

// 更新孩子的钉钉配置
childrenRouter.put('/:childId/dingtalk-config', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId } = req.params
  const { webhookUrl, secret } = req.body

  if (!webhookUrl) {
    throw new AppError(400, 'Missing required field: webhookUrl')
  }

  const child = await prisma.user.findFirst({
    where: { 
      id: parseInt(childId as string),
      familyId,
      role: 'child'
    }
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  const updateData: any = {
    dingtalkWebhookUrl: webhookUrl
  }
  
  // Only update secret if provided
  if (secret !== undefined) {
    updateData.dingtalkSecret = secret
  }

  const updatedChild = await prisma.user.update({
    where: { id: parseInt(childId as string) },
    data: updateData,
    select: {
      id: true,
      name: true,
      dingtalkWebhookUrl: true,
      dingtalkSecret: true
    }
  })

  res.json({ 
    status: 'success', 
    data: {
      childId: updatedChild.id,
      childName: updatedChild.name,
      webhookUrl: updatedChild.dingtalkWebhookUrl,
      secret: updatedChild.dingtalkSecret
    } 
  })
})

// 获取孩子的学习统计数据
childrenRouter.get('/:childId/stats', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { childId } = req.params

  // 验证孩子是否存在
  const child = await prisma.user.findFirst({
    where: { 
      id: parseInt(childId as string),
      familyId,
      role: 'child'
    }
  })

  if (!child) {
    throw new AppError(404, 'Child not found')
  }

  // 计算本周开始和结束时间
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  // 获取本周打卡记录
  const weeklyCheckins = await prisma.dailyCheckin.findMany({
    where: {
      childId: parseInt(childId as string),
      checkDate: {
        gte: startOfWeek,
        lte: endOfWeek
      },
      status: 'completed'
    },
    select: {
      value: true,
      completedValue: true
    }
  })

  // 计算本周学习时间（分钟）
  const weeklyStudyMinutes = weeklyCheckins.reduce((sum, checkin) => {
    return sum + (checkin.completedValue || checkin.value || 0)
  }, 0)

  // 获取完成的任务数（本周打卡数）
  const completedTasks = weeklyCheckins.length

  // 获取成就数
  const achievements = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM achievement_logs WHERE child_id = ${parseInt(childId as string)}
  `.then((result: any) => Number(result[0]?.count ?? 0))

  // 获取今日学习时间
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const dailyCheckins = await prisma.dailyCheckin.findMany({
    where: {
      childId: parseInt(childId as string),
      checkDate: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: 'completed'
    },
    select: {
      value: true,
      completedValue: true
    }
  })

  // 计算今日学习时间（分钟）
  const dailyMinutes = dailyCheckins.reduce((sum, checkin) => {
    return sum + (checkin.completedValue || checkin.value || 0)
  }, 0)

  // 计算本周进度（示例：基于完成任务数）
  // 假设每周目标是20个任务
  const weeklyTarget = 20
  const weeklyProgress = Math.min(Math.round((completedTasks / weeklyTarget) * 100), 100)

  res.json({ 
    status: 'success', 
    data: {
      childId: child.id,
      childName: child.name,
      weeklyStudyTime: weeklyStudyMinutes,
      completedTasks,
      achievements,
      dailyMinutes: dailyMinutes,
      weeklyProgress
    } 
  })
})

export default childrenRouter
