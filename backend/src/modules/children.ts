import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'

export const childrenRouter: Router = Router()

childrenRouter.use(authMiddleware)
childrenRouter.use(requireRole('parent'))

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

export default childrenRouter
