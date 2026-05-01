import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, generateToken, requireRole } from '../middleware/auth'
import { env } from '../config/env'

export const authRouter: Router = Router()

const educationStages = new Set(['primary', 'middle'])

function normalizeEducationStage(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'primary'
  }

  if (typeof value !== 'string' || !educationStages.has(value)) {
    throw new AppError(400, '教育阶段只能选择小学或初中')
  }

  return value
}

// ============================================
// Auth Routes
// ============================================

/**
 * POST /register - Register a new user (simplified)
 * Body: { username, password, role }
 */
authRouter.post('/register', async (req, res: Response) => {
  try {
    const { username, password } = req.body
    const role = 'parent' // Registration always creates parent accounts

    // Validate required fields
    if (!username || !password) {
      throw new AppError(400, '用户名和密码不能为空')
    }

    if (password.length < 6) {
      throw new AppError(400, '密码至少6位')
    }

    // Check if username already exists
    const existingUser = await prisma.user.findFirst({
      where: { name: username },
    })

    if (existingUser) {
      throw new AppError(409, '用户名已存在')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Generate unique family code with random suffix to prevent collisions
    const familyCode = `F${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Create a new family for each registered user
    const family = await prisma.family.create({
      data: {
        name: `${username}的家庭`,
        familyCode,
        settings: {
          dailyTimeLimit: 210,
          dingtalkWebhook: '',
        },
      },
    })

    // Create user
    const user = await prisma.user.create({
      data: {
        name: username,
        role: role,
        passwordHash,
        familyId: family.id,
        status: 'active',
      },
    })

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      name: user.name,
      role: user.role,
      familyId: family.id,
    })

    res.status(201).json({
      status: 'success',
      message: '注册成功',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          familyId: family.id,
          familyName: family.name,
          familyCode: family.familyCode,
          avatar: user.avatar,
        },
      },
    })
  } catch (error: any) {
    console.error('Register error:', error)
    if (error instanceof AppError) throw error
    throw new AppError(500, `注册失败: ${error.message}`)
  }
})

/**
 * POST /login - Login with username and password (simplified)
 * Body: { username, password }
 */
authRouter.post('/login', async (req, res: Response) => {
  const { username, password } = req.body

  if (!username || !password) {
    throw new AppError(400, '用户名和密码不能为空')
  }



  // Find user by username (parent login only finds parent users)
  const user = await prisma.user.findFirst({
    where: {
      name: username,
      role: 'parent',
      status: 'active',
    },
    include: { family: true }
  })

  if (!user) {
    throw new AppError(401, '用户名或密码错误')
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

  if (!isPasswordValid) {
    throw new AppError(401, '用户名或密码错误')
  }

  // Generate JWT token
  const token = generateToken({
    id: user.id,
    name: user.name,
    role: user.role,
    familyId: user.familyId,
  })

  res.json({
    status: 'success',
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        familyId: user.familyId,
        familyName: user.family.name,
        familyCode: user.family.familyCode,
        avatar: user.avatar,
      },
    },
  })
})

/**
 * POST /add-child - Parent adds a new child
 * Body: { name, avatar }
 * Auth required, parent only
 */
authRouter.post('/add-child', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar, age, grade, gender, birthday, interests, personality, educationStage } = req.body
    const { familyId, userId } = req.user!

    if (!name) {
      throw new AppError(400, 'Missing required field: name')
    }

    // Check if child with same name already exists in family
    const existingChild = await prisma.user.findFirst({
      where: {
        familyId,
        name,
        role: 'child',
        status: 'active',
      },
    })

    if (existingChild) {
      throw new AppError(409, '该名字的孩子已存在')
    }

    // Child-side login has been removed, so keep an internal password hash only.
    const passwordHash = await bcrypt.hash(randomUUID(), 12)

    // Create child user
    const child = await prisma.user.create({
      data: {
        name,
        role: 'child',
        avatar: avatar || '🐛',
        passwordHash,
        familyId,
        educationStage: normalizeEducationStage(educationStage),
        status: 'active',
      },
    })

    res.status(201).json({
      status: 'success',
      message: 'Child added successfully',
      data: {
        id: child.id,
        name: child.name,
        avatar: child.avatar,
        role: child.role,
        educationStage: child.educationStage,
      },
    })
  } catch (error: any) {
    console.error('[ADD CHILD] Error:', error)
    if (error instanceof AppError) throw error
    throw new AppError(500, `添加孩子失败: ${error.message}`)
  }
})

/**
 * GET /me - Get current user info
 * Auth required
 */
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId, name, role, familyId } = req.user!

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock user info
    res.json({
      status: 'success',
      data: {
        id: userId,
        name: name,
        role: role,
        avatar: '👤',
        familyId: familyId,
        familyName: `${name}的家庭`,
        familyCode: 'F123456',
        family: {
          id: familyId,
          name: `${name}的家庭`,
          familyCode: 'F123456',
          settings: {
            dailyTimeLimit: 210,
            dingtalkWebhook: '',
          },
        },
      },
    })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      family: true,
    },
  })

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  res.json({
    status: 'success',
    data: {
      id: user.id,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      familyId: user.familyId,
      familyName: user.family.name,
      familyCode: user.family.familyCode,
      family: {
        id: user.family.id,
        name: user.family.name,
        familyCode: user.family.familyCode,
        settings: user.family.settings || {},
      },
    },
  })
})

/**
 * POST /migrate-family - Migrate user to a new independent family
 * For users who were previously in shared 'default' family
 * Auth required, parent only
 */
authRouter.post('/migrate-family', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { userId, familyId: currentFamilyId } = req.user!

  // Check if user is in a shared family
  const currentFamily = await prisma.family.findUnique({
    where: { id: currentFamilyId },
    include: {
      users: {
        where: { role: 'parent', status: 'active' }
      }
    }
  })

  if (!currentFamily) {
    throw new AppError(404, '家庭不存在')
  }

  // If family has multiple parents or is 'default', user needs migration
  const needsMigration = currentFamily.familyCode === 'default' || currentFamily.users.length > 1

  if (!needsMigration) {
    throw new AppError(400, '您已经在独立家庭中，无需迁移')
  }

  // Generate unique family code
  const familyCode = `F${Date.now().toString(36).toUpperCase()}`

  // Create new family
  const newFamily = await prisma.family.create({
    data: {
      name: `${req.user!.name}的家庭`,
      familyCode,
      settings: {
        dailyTimeLimit: 210,
        dingtalkWebhook: '',
      },
    },
  })

  // Update parent's family (don't auto-migrate children from shared family)
  // Users should re-add their own children after migration
  await prisma.user.update({
    where: { id: userId },
    data: { familyId: newFamily.id }
  })

  // Generate new token with new familyId
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { family: true }
  })

  const token = generateToken({
    id: user!.id,
    name: user!.name,
    role: user!.role,
    familyId: newFamily.id,
  })

  res.json({
    status: 'success',
    message: '家庭迁移成功',
    data: {
      token,
      user: {
        id: user!.id,
        name: user!.name,
        role: user!.role,
        familyId: newFamily.id,
        familyName: newFamily.name,
        familyCode: newFamily.familyCode,
        avatar: user!.avatar,
      },
    },
  })
})

/**
 * GET /children - Get all children in the family
 * Auth required, parent only
 */
authRouter.get('/children', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId, userId, name } = req.user!
  

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock children
    const mockChildren = [
      {
        id: 2,
        name: '小明',
        avatar: '👶',
        educationStage: 'primary',
        createdAt: new Date().toISOString(),
        weeklyProgress: 0,
        todayMinutes: 0,
        completedTasks: 0,
        totalTasks: 0,
        streak: 0,
        achievements: 0,
      },
      {
        id: 3,
        name: '小红',
        avatar: '🧒',
        educationStage: 'primary',
        createdAt: new Date().toISOString(),
        weeklyProgress: 0,
        todayMinutes: 0,
        completedTasks: 0,
        totalTasks: 0,
        streak: 0,
        achievements: 0,
      },
    ]

    res.json({
      status: 'success',
      data: mockChildren,
    })
    return
  }

  const children = await prisma.user.findMany({
    where: {
      familyId,
      role: 'child',
      status: 'active',
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      educationStage: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  // TODO: Replace with actual statistics from database
  const childrenWithStats = children.map(child => ({
    ...child,
    weeklyProgress: 0,
    todayMinutes: 0,
    completedTasks: 0,
    totalTasks: 0,
    streak: 0,
    achievements: 0,
  }))

  res.json({
    status: 'success',
    data: childrenWithStats,
  })
})

/**
 * PUT /children/:id - Update child information
 * Auth required, parent only
 */
authRouter.put('/children/:id', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    
    // Validate ID parameter
    if (isNaN(id) || id <= 0) {
      throw new AppError(400, '无效的孩子ID')
    }
    
    const { name, avatar, age, grade, gender, birthday, interests, personality, educationStage } = req.body
    const { familyId, userId } = req.user!


    // Check if child exists and belongs to the family
    const existingChild = await prisma.user.findFirst({
      where: {
        id,
        familyId,
        role: 'child',
        status: 'active',
      },
    })

    if (!existingChild) {
      throw new AppError(404, '孩子不存在')
    }

    // Build update data
    const updateData: { name?: string; avatar?: string; educationStage?: string; passwordHash?: string } = {}

    if (name !== undefined && name !== existingChild.name) {
      // Check if another child with the same name exists (excluding current child)
      const duplicateName = await prisma.user.findFirst({
        where: {
          familyId,
          name,
          role: 'child',
          status: 'active',
          NOT: { id },
        },
      })

      if (duplicateName) {
        throw new AppError(409, '该名字的孩子已存在')
      }

      updateData.name = name
    }

    if (avatar !== undefined) {
      if (typeof avatar !== 'string') {
        throw new AppError(400, '头像格式不正确')
      }
      if (avatar.startsWith('data:')) {
        throw new AppError(400, '请先上传头像文件，再保存头像链接')
      }
      if (avatar.length > 500) {
        throw new AppError(400, '头像链接过长')
      }
      updateData.avatar = avatar
    }

    if (educationStage !== undefined) {
      updateData.educationStage = normalizeEducationStage(educationStage)
    }

    // Note: age, grade, gender, birthday, interests, personality
    // are not stored on User model - these should be stored in Family.settings if needed

    // Update child
    const updatedChild = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
        educationStage: true,
        updatedAt: true,
      },
    })


    res.json({
      status: 'success',
      message: '孩子信息更新成功',
      data: updatedChild,
    })
  } catch (error: any) {
    console.error('[UPDATE CHILD] Error:', error)
    if (error instanceof AppError) throw error
    throw new AppError(500, `更新失败: ${error.message}`)
  }
})

/**
 * DELETE /children/all - Delete all children in the family
 * Auth required, parent only
 */
authRouter.delete('/children/all', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId, userId } = req.user!
  

  // Find all children in this family
  const children = await prisma.user.findMany({
    where: {
      familyId,
      role: 'child',
      status: 'active',
    },
    select: { id: true, name: true },
  })
  

  const childIds = children.map(c => c.id)

  if (childIds.length === 0) {
    res.json({
      status: 'success',
      message: '没有需要删除的孩子',
      data: { deletedCount: 0 },
    })
    return
  }

  // Soft delete by updating status to 'inactive'
  const result = await prisma.user.updateMany({
    where: {
      id: { in: childIds },
    },
    data: { status: 'inactive' },
  })
  

  res.json({
    status: 'success',
    message: `已删除 ${result.count} 个孩子`,
    data: { deletedCount: result.count },
  })
})

/**
 * DELETE /children/:id - Delete a child
 * Auth required, parent only
 */
authRouter.delete('/children/:id', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    
    // Validate ID parameter
    if (isNaN(id) || id <= 0) {
      throw new AppError(400, '无效的孩子ID')
    }
    
    const { familyId } = req.user!


    // Check if child exists and belongs to the family
    const existingChild = await prisma.user.findFirst({
      where: {
        id,
        familyId,
        role: 'child',
        status: 'active',
      },
    })

    if (!existingChild) {
      throw new AppError(404, '孩子不存在')
    }

    // Soft delete by updating status to 'inactive'
    await prisma.user.update({
      where: { id },
      data: { status: 'inactive' },
    })

    res.json({
      status: 'success',
      message: '孩子已删除',
    })
  } catch (error: any) {
    console.error('Delete child error:', error)
    if (error instanceof AppError) throw error
    throw new AppError(500, `删除失败: ${error.message}`)
  }
})

/**
 * GET /config - Get user configuration
 * Auth required, parent only
 */
authRouter.get('/config', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  const family = await prisma.family.findUnique({
    where: { id: familyId },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const config = family.settings as any || {}

  res.json({
    status: 'success',
    data: {
      publishSettings: config.publishSettings || {},
    },
  })
})

/**
 * POST /config - Update user configuration
 * Auth required, parent only
 */
authRouter.post('/config', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { publishSettings } = req.body

  const family = await prisma.family.findUnique({
    where: { id: familyId },
  })

  if (!family) {
    throw new AppError(404, '家庭不存在')
  }

  const currentSettings = family.settings as any || {}
  const updatedSettings = {
    ...currentSettings,
    publishSettings,
  }

  const updatedFamily = await prisma.family.update({
    where: { id: familyId },
    data: {
      settings: updatedSettings,
    },
  })

  res.json({
    status: 'success',
    message: '配置更新成功',
    data: {
      publishSettings: (updatedFamily.settings as any).publishSettings,
    },
  })
})

/**
 * POST /avatar - Upload user avatar
 * Auth required
 */
authRouter.post('/avatar', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!
  const { avatar } = req.body

  if (!avatar || typeof avatar !== 'string') {
    throw new AppError(400, '头像不能为空')
  }
  if (avatar.startsWith('data:')) {
    throw new AppError(400, '请先上传头像文件，再保存头像链接')
  }
  if (avatar.length > 500) {
    throw new AppError(400, '头像链接过长')
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatar },
  })

  const token = generateToken({
    id: updatedUser.id,
    name: updatedUser.name,
    role: updatedUser.role,
    familyId: updatedUser.familyId,
  })

  res.json({
    status: 'success',
    message: '头像上传成功',
    data: {
      avatar: updatedUser.avatar,
      token,
    },
  })
})

/**
 * PUT /password - Update user password
 * Auth required
 */
authRouter.put('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!
  const { oldPassword, newPassword } = req.body

  if (!oldPassword || !newPassword) {
    throw new AppError(400, '原密码和新密码不能为空')
  }

  if (newPassword.length < 6) {
    throw new AppError(400, '密码至少6位')
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new AppError(404, '用户不存在')
  }

  // Verify old password
  const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash)

  if (!isPasswordValid) {
    throw new AppError(401, '原密码错误')
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12)

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })

  res.json({
    status: 'success',
    message: '密码修改成功',
  })
})

/**
 * PUT /me/username - Update username with password verification
 * Auth required
 */
authRouter.put('/me/username', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!
  const { name, password } = req.body

  if (!name || !password) {
    throw new AppError(400, '用户名和密码不能为空')
  }

  if (name.length < 2 || name.length > 20) {
    throw new AppError(400, '用户名长度应在2-20个字符之间')
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new AppError(404, '用户不存在')
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

  if (!isPasswordValid) {
    throw new AppError(401, '密码错误')
  }

  // Check if username is already taken by another user
  const existingUser = await prisma.user.findFirst({
    where: {
      name,
      id: { not: userId },
    },
  })

  if (existingUser) {
    throw new AppError(409, '该用户名已被使用')
  }

  // Update username
  await prisma.user.update({
    where: { id: userId },
    data: { name },
  })

  // Generate new token with updated name
  const token = generateToken({
    id: userId,
    name,
    role: user.role,
    familyId: user.familyId,
  })

  res.json({
    status: 'success',
    message: '用户名修改成功',
    data: {
      name,
      token,
    },
  })
})
