import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, generateToken, requireRole } from '../middleware/auth'

export const authRouter: Router = Router()

// ============================================
// Auth Routes
// ============================================

/**
 * POST /register - Register a new user (simplified)
 * Body: { username, password, role }
 */
authRouter.post('/register', async (req, res: Response) => {
  try {
    const { username, password, role = 'parent' } = req.body

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

    // Generate unique family code
    const familyCode = `F${Date.now().toString(36).toUpperCase()}`

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
      avatar: user.avatar,
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

  // Find user by username
  const user = await prisma.user.findFirst({
    where: {
      name: username,
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

  console.log(`[LOGIN] User ${user.name} (ID: ${user.id}), Family ${user.familyId}, FamilyCode: ${user.family.familyCode}`)

  // Generate JWT token
  const token = generateToken({
    id: user.id,
    name: user.name,
    role: user.role,
    familyId: user.familyId,
    avatar: user.avatar,
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
 * POST /child/login - Simplified login for children using PIN
 * Body: { familyCode, childName, childPin }
 */
authRouter.post('/child/login', async (req, res: Response) => {
  const { familyCode, childName, childPin } = req.body

  if (!familyCode || !childName || !childPin) {
    throw new AppError(400, 'Missing required fields: familyCode, childName, childPin')
  }

  // Find family
  const family = await prisma.family.findUnique({
    where: { familyCode },
  })

  if (!family) {
    throw new AppError(401, 'Invalid family code')
  }

  // Find child user
  const child = await prisma.user.findFirst({
    where: {
      familyId: family.id,
      name: childName,
      role: 'child',
      status: 'active',
    },
  })

  if (!child) {
    throw new AppError(401, 'Child not found')
  }

  // Verify PIN (PIN is stored as password hash, but for children it's a simple 4-digit number)
  const isPinValid = await bcrypt.compare(childPin, child.passwordHash)

  if (!isPinValid) {
    throw new AppError(401, 'Invalid PIN')
  }

  // Generate JWT token
  const token = generateToken({
    id: child.id,
    name: child.name,
    role: child.role,
    familyId: family.id,
    avatar: child.avatar,
  })

  res.json({
    status: 'success',
    message: 'Login successful',
    data: {
      token,
      user: {
        id: child.id,
        name: child.name,
        role: child.role,
        familyId: family.id,
        familyName: family.name,
        familyCode: family.familyCode,
        avatar: child.avatar,
      },
    },
  })
})

/**
 * POST /add-child - Parent adds a new child
 * Body: { name, avatar, pin }
 * Auth required, parent only
 */
authRouter.post('/add-child', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar, pin } = req.body
    const { familyId, userId } = req.user!

    console.log(`[ADD CHILD] User ${userId}, Family ${familyId}, Name: ${name}`)

    if (!name || !pin) {
      throw new AppError(400, 'Missing required fields: name, pin')
    }

    // Validate PIN format (4-digit number)
    if (!/^\d{4}$/.test(pin)) {
      throw new AppError(400, 'PIN must be a 4-digit number')
    }

    // Check if child with same name already exists in family
    const existingChild = await prisma.user.findFirst({
      where: {
        familyId,
        name,
        status: 'active',
      },
    })

    if (existingChild) {
      throw new AppError(409, '该名字的孩子已存在')
    }

    // Hash PIN
    const passwordHash = await bcrypt.hash(pin, 12)

    // Create child user
    const child = await prisma.user.create({
      data: {
        name,
        role: 'child',
        avatar: avatar || '🐛',
        passwordHash,
        familyId,
        status: 'active',
      },
    })

    console.log(`[ADD CHILD] Success: Child ${child.name} (ID: ${child.id}) created`)

    res.status(201).json({
      status: 'success',
      message: 'Child added successfully',
      data: {
        id: child.id,
        name: child.name,
        avatar: child.avatar,
        role: child.role,
      },
    })
  } catch (error: any) {
    console.error('[ADD CHILD] Error:', error)
    throw new AppError(500, `添加孩子失败: ${error.message}`)
  }
})

/**
 * GET /me - Get current user info
 * Auth required
 */
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!

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
    avatar: user!.avatar,
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
  const { familyId, userId } = req.user!
  
  console.log(`[GET CHILDREN] User ${userId}, Family ${familyId}`)

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
      createdAt: true,
    },
  })
  
  console.log(`[GET CHILDREN] Found ${children.length} children:`, children.map(c => c.name))

  // TODO: Replace with actual statistics from database
  const childrenWithStats = children.map(child => ({
    ...child,
    pin: '1234', // Placeholder - PIN should not be returned in production
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
    const { name, avatar, pin } = req.body
    const { familyId, userId } = req.user!

    console.log(`[UPDATE CHILD] User ${userId}, Family ${familyId}, Child ${id}, Body:`, JSON.stringify(req.body))

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
      console.log(`[UPDATE CHILD] Child ${id} not found in family ${familyId}`)
      throw new AppError(404, '孩子不存在')
    }

    // Build update data
    const updateData: { name?: string; avatar?: string; passwordHash?: string } = {}

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
      console.log(`[UPDATE CHILD] Setting avatar: ${avatar?.substring(0, 50)}...`)
      updateData.avatar = avatar
    }

    if (pin !== undefined && pin !== '') {
      // Validate PIN format (4-digit number)
      if (!/^\d{4}$/.test(pin)) {
        throw new AppError(400, 'PIN必须是4位数字')
      }
      updateData.passwordHash = await bcrypt.hash(pin, 12)
    }

    // Update child
    const updatedChild = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
        updatedAt: true,
      },
    })

    console.log(`[UPDATE CHILD] Success: Child ${id} updated`)

    res.json({
      status: 'success',
      message: '孩子信息更新成功',
      data: updatedChild,
    })
  } catch (error: any) {
    console.error('[UPDATE CHILD] Error:', error)
    throw new AppError(500, `更新失败: ${error.message}`)
  }
})

/**
 * DELETE /children/all - Delete all children in the family
 * Auth required, parent only
 */
authRouter.delete('/children/all', authMiddleware, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  const { familyId, userId } = req.user!
  
  console.log(`[DELETE ALL] User ${userId}, Family ${familyId}`)

  // Find all children in this family
  const children = await prisma.user.findMany({
    where: {
      familyId,
      role: 'child',
      status: 'active',
    },
    select: { id: true, name: true },
  })
  
  console.log(`[DELETE ALL] Found ${children.length} children:`, children.map(c => c.name))

  const childIds = children.map(c => c.id)

  if (childIds.length === 0) {
    console.log('[DELETE ALL] No children to delete')
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
  
  console.log(`[DELETE ALL] Soft deleted ${result.count} children`)

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
    const { familyId } = req.user!

    console.log(`Deleting child ${id} from family ${familyId}`)

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
      console.log(`Child ${id} not found in family ${familyId}`)
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
    throw new AppError(500, `删除失败: ${error.message}`)
  }
})
