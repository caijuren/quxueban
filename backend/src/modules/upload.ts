import { Router } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import fs from 'fs'
import path from 'path'
import multer from 'multer'

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars')
    try {
      // Use synchronous mkdir to avoid async issues with multer
      fs.mkdirSync(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error as any, uploadDir)
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `avatar-${uniqueSuffix}${ext}`)
  }
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError(400, 'Only image files are allowed'))
    }
    cb(null, true)
  }
})

// Configure multer for task evidence uploads
const evidenceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/evidence')
    try {
      fs.mkdirSync(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error as any, uploadDir)
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `evidence-${uniqueSuffix}${ext}`)
  }
})

const evidenceUpload = multer({
  storage: evidenceStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for evidence
  },
  fileFilter: (_req, file, cb) => {
    // Allow images, audio, and video files
    const allowedTypes = [
      'image/',
      'audio/',
      'video/',
      'application/pdf'
    ]
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type))
    if (!isAllowed) {
      return cb(new AppError(400, 'Only image, audio, video, and PDF files are allowed'))
    }
    cb(null, true)
  }
})

// Router setup
export const uploadRouter: Router = Router()

// All routes require authentication and parent role
uploadRouter.use(authMiddleware)
uploadRouter.use(requireRole('parent'))

/**
 * POST /upload/avatar - Upload avatar for child
 */
uploadRouter.post('/avatar', avatarUpload.single('avatar'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No file uploaded')
    }

    // Generate the file URL
    const fileName = req.file.filename
    const fileUrl = `/api/uploads/avatars/${fileName}`

    res.json({
      status: 'success',
      data: {
        url: fileUrl,
        filename: fileName
      }
    })
  } catch (error) {
    console.error('[Upload] Error uploading avatar:', error)
    res.status(500).json({
      status: 'error',
      message: '上传头像失败'
    })
  }
})

/**
 * POST /upload/evidence - Upload task completion evidence
 */
uploadRouter.post('/evidence', evidenceUpload.single('evidence'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No file uploaded')
    }

    const { checkinId } = req.body
    const { familyId } = req.user!

    // Verify the checkin belongs to this family
    if (checkinId) {
      const checkin = await prisma.dailyCheckin.findFirst({
        where: { id: parseInt(checkinId), familyId }
      })
      if (!checkin) {
        throw new AppError(404, '打卡记录不存在')
      }

      // Return uploaded evidence URL for the caller to persist on the correct model
      const fileUrl = `/api/uploads/evidence/${req.file.filename}`
      await prisma.dailyCheckin.update({
        where: { id: parseInt(checkinId) },
        data: { evidenceUrl: fileUrl },
      })

      res.json({
        status: 'success',
        data: {
          url: fileUrl,
          filename: req.file.filename,
          checkinId: parseInt(checkinId)
        }
      })
    } else {
      // Just return the URL without linking to checkin
      const fileUrl = `/api/uploads/evidence/${req.file.filename}`
      res.json({
        status: 'success',
        data: {
          url: fileUrl,
          filename: req.file.filename
        }
      })
    }
  } catch (error) {
    console.error('[Upload] Error uploading evidence:', error)
    res.status(500).json({
      status: 'error',
      message: '上传证据失败'
    })
  }
})

export default uploadRouter
