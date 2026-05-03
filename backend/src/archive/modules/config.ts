import { Router, Response } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import CryptoJS from 'crypto-js'

export const configRouter: Router = Router()

// All routes require authentication and parent role
configRouter.use(authMiddleware)
configRouter.use(requireRole('parent'))

/**
 * GET /backup - Create a backup of configuration data
 */
configRouter.get('/backup', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { include, password } = req.query
  
  // Parse include parameter
  const includeData = typeof include === 'string' ? JSON.parse(include) : {
    family: true,
    users: true,
    tasks: true,
    taskTemplates: true,
    books: true,
    userAIConfigs: true,
    achievements: true,
    readingLogs: true,
    bookReadStates: true,
    activeReadings: true,
    weeklyPlans: true,
    dailyCheckins: true,
    childTasks: true,
    achievementLogs: true,
    bookAIInsights: true
  }

  try {
    // Get configuration data based on include parameters
    const backupData = {
      timestamp: new Date().toISOString(),
      familyId,
      data: {
        // Family settings
        ...(includeData.family && {
          family: await prisma.family.findUnique({
            where: { id: familyId },
            select: {
              name: true,
              settings: true
            }
          })
        }),
        
        // Users (excluding passwords)
        ...(includeData.users && {
          users: await prisma.user.findMany({
            where: { familyId },
            select: {
              id: true,
              name: true,
              role: true,
              avatar: true,
              status: true,
              dingtalkSecret: true,
              dingtalkWebhook: true,
              dingtalkWebhookUrl: true
            }
          })
        }),
        
        // Tasks
        ...(includeData.tasks && {
          tasks: await prisma.task.findMany({
            where: { familyId }
          })
        }),
        
        // Task templates
        ...(includeData.taskTemplates && {
          taskTemplates: await prisma.taskTemplate.findMany({
            where: { familyId }
          })
        }),
        
        // Books
        ...(includeData.books && {
          books: await prisma.book.findMany({
            where: { familyId }
          })
        }),
        
        // User AI configs
        ...(includeData.userAIConfigs && {
          userAIConfigs: await prisma.userAIConfig.findMany({
            where: { familyId }
          })
        }),
        
        // Achievements
        ...(includeData.achievements && {
          achievements: await prisma.achievement.findMany({
            where: { familyId }
          })
        }),
        
        // Reading records
        ...(includeData.readingLogs && {
          readingLogs: await prisma.readingLog.findMany({
            where: { familyId }
          })
        }),
        ...(includeData.bookReadStates && {
          bookReadStates: await prisma.bookReadState.findMany({
            where: { familyId }
          })
        }),
        ...(includeData.activeReadings && {
          activeReadings: await prisma.activeReading.findMany({
            where: { familyId }
          })
        }),
        
        // Plan data
        ...(includeData.weeklyPlans && {
          weeklyPlans: await prisma.weeklyPlan.findMany({
            where: { familyId }
          })
        }),
        ...(includeData.dailyCheckins && {
          dailyCheckins: await prisma.dailyCheckin.findMany({
            where: { familyId }
          })
        }),
        ...(includeData.childTasks && {
          childTasks: await prisma.childTask.findMany({
            where: { familyId }
          })
        }),
        
        // Achievement records
        ...(includeData.achievementLogs && {
          achievementLogs: await prisma.achievementLog.findMany({
            where: { familyId }
          })
        }),
        
        // AI related data
        ...(includeData.bookAIInsights && {
          bookAIInsights: await prisma.bookAIInsight.findMany({
            where: { familyId }
          })
        })
      }
    }

    // Generate backup file name with version
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    // Get current version for this family
    const backupFiles = await fs.readdir(path.join(__dirname, '../../backups'))
    const familyBackups = backupFiles.filter(file => file.includes(`backup_${familyId}_`))
    const version = familyBackups.length + 1
    
    const backupFileName = `backup_${familyId}_v${version}_${timestamp}.json`
    const backupFilePath = path.join(__dirname, '../../backups', backupFileName)

    // Ensure backups directory exists
    await fs.mkdir(path.join(__dirname, '../../backups'), { recursive: true })

    // Add hash to backup data
    const backupContent = JSON.stringify(backupData, null, 2)
    const hash = crypto.createHash('sha256').update(backupContent).digest('hex')
    ;(backupData as any).hash = hash
    
    // Encrypt backup if password is provided
    let finalBackupContent = JSON.stringify(backupData, null, 2)
    if (password) {
      ;(backupData as any).encrypted = true
      finalBackupContent = encryptBackup(backupData, password as string)
    }
    
    // Write backup to file
    await fs.writeFile(backupFilePath, finalBackupContent)

    // Send backup file as response
    res.download(backupFilePath, backupFileName, (err) => {
      if (err) {
        console.error('[Config Backup] Error sending backup file:', err)
        res.status(500).json({
          status: 'error',
          message: '备份文件生成失败'
        })
      }
      // Don't clean up the backup file - keep it for backup history
    })
  } catch (error) {
    console.error('[Config Backup] Error creating backup:', error)
    res.status(500).json({
      status: 'error',
      message: '创建备份失败'
    })
  }
})

/**
 * POST /restore - Restore configuration from backup
 */
configRouter.post('/restore', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { backupData, include, password } = req.body

  if (!backupData) {
    throw new AppError(400, '备份数据不能为空')
  }

  // Decrypt backup if encrypted
  let decryptedBackupData = backupData
  if (backupData.encrypted) {
    if (!password) {
      throw new AppError(400, '备份文件已加密，请提供密码')
    }
    try {
      decryptedBackupData = decryptBackup(backupData, password)
    } catch (error) {
      throw new AppError(400, '密码错误或备份文件损坏')
    }
  }

  // Parse include parameter
  const includeData = include || {
    family: true,
    users: true,
    tasks: true,
    taskTemplates: true,
    books: true,
    userAIConfigs: true,
    achievements: true,
    readingLogs: true,
    bookReadStates: true,
    activeReadings: true,
    weeklyPlans: true,
    dailyCheckins: true,
    childTasks: true,
    achievementLogs: true,
    bookAIInsights: true
  }

  try {
    // Validate backup data
    if (decryptedBackupData.familyId !== familyId) {
      throw new AppError(400, '备份数据与当前家庭不匹配')
    }

    // Validate backup integrity
    if (decryptedBackupData.hash) {
      // Remove hash from backup data before recalculating
      const { hash: originalHash, ...dataWithoutHash } = decryptedBackupData
      const backupContent = JSON.stringify(dataWithoutHash, null, 2)
      const calculatedHash = crypto.createHash('sha256').update(backupContent).digest('hex')
      
      if (originalHash !== calculatedHash) {
        throw new AppError(400, '备份文件已损坏或被篡改')
      }
    }

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Update family settings
      if (includeData.family && decryptedBackupData.data.family) {
        await tx.family.update({
          where: { id: familyId },
          data: {
            name: decryptedBackupData.data.family.name,
            settings: decryptedBackupData.data.family.settings
          }
        })
      }

      // Update users (excluding passwords)
      if (includeData.users && decryptedBackupData.data.users && decryptedBackupData.data.users.length > 0) {
        for (const user of decryptedBackupData.data.users) {
          const existingUser = await tx.user.findFirst({
            where: { id: user.id, familyId }
          })

          if (existingUser) {
            await tx.user.update({
              where: { id: user.id },
              data: {
                name: user.name,
                role: user.role,
                avatar: user.avatar,
                status: user.status,
                dingtalkSecret: user.dingtalkSecret,
                dingtalkWebhook: user.dingtalkWebhook,
                dingtalkWebhookUrl: user.dingtalkWebhookUrl
              }
            })
          }
        }
      }

      // Update tasks
      if (includeData.tasks && decryptedBackupData.data.tasks && decryptedBackupData.data.tasks.length > 0) {
        for (const task of decryptedBackupData.data.tasks) {
          const { id, familyId: _fid, ...taskData } = task
          const existingTask = await tx.task.findFirst({
            where: { id, familyId }
          })

          if (existingTask) {
            await tx.task.update({
              where: { id },
              data: taskData
            })
          } else {
            await tx.task.create({
              data: {
                ...taskData,
                familyId
              }
            })
          }
        }
      }

      // Update task templates
      if (includeData.taskTemplates && decryptedBackupData.data.taskTemplates && decryptedBackupData.data.taskTemplates.length > 0) {
        for (const template of decryptedBackupData.data.taskTemplates) {
          const { id, familyId: _fid, ...templateData } = template
          const existingTemplate = await tx.taskTemplate.findFirst({
            where: { id, familyId }
          })

          if (existingTemplate) {
            await tx.taskTemplate.update({
              where: { id },
              data: templateData
            })
          } else {
            await tx.taskTemplate.create({
              data: {
                ...templateData,
                familyId
              }
            })
          }
        }
      }

      // Update books
      if (includeData.books && decryptedBackupData.data.books && decryptedBackupData.data.books.length > 0) {
        for (const book of decryptedBackupData.data.books) {
          const { id, familyId: _fid, ...bookData } = book
          const existingBook = await tx.book.findFirst({
            where: { id, familyId }
          })

          if (existingBook) {
            await tx.book.update({
              where: { id },
              data: bookData
            })
          } else {
            await tx.book.create({
              data: {
                ...bookData,
                familyId
              }
            })
          }
        }
      }

      // Update user AI configs
      if (includeData.userAIConfigs && decryptedBackupData.data.userAIConfigs && decryptedBackupData.data.userAIConfigs.length > 0) {
        for (const config of decryptedBackupData.data.userAIConfigs) {
          const existingConfig = await tx.userAIConfig.findFirst({
            where: {
              familyId,
              provider: config.provider
            }
          })

          if (existingConfig) {
            await tx.userAIConfig.update({
              where: { id: existingConfig.id },
              data: config
            })
          } else {
            await tx.userAIConfig.create({
              data: {
                ...config,
                familyId
              }
            })
          }
        }
      }

      // Update achievements
      if (includeData.achievements && decryptedBackupData.data.achievements && decryptedBackupData.data.achievements.length > 0) {
        for (const achievement of decryptedBackupData.data.achievements) {
          const existingAchievement = await tx.achievement.findFirst({
            where: { id: achievement.id, familyId }
          })

          if (existingAchievement) {
            await tx.achievement.update({
              where: { id: achievement.id },
              data: achievement
            })
          } else {
            await tx.achievement.create({
              data: {
                ...achievement,
                familyId
              }
            })
          }
        }
      }

      // Update reading records
      if (includeData.readingLogs && decryptedBackupData.data.readingLogs && decryptedBackupData.data.readingLogs.length > 0) {
        for (const log of decryptedBackupData.data.readingLogs) {
          const existingLog = await tx.readingLog.findFirst({
            where: { id: log.id, familyId }
          })

          if (existingLog) {
            await tx.readingLog.update({
              where: { id: log.id },
              data: log
            })
          } else {
            await tx.readingLog.create({
              data: {
                ...log,
                familyId
              }
            })
          }
        }
      }

      if (includeData.bookReadStates && decryptedBackupData.data.bookReadStates && decryptedBackupData.data.bookReadStates.length > 0) {
        for (const state of decryptedBackupData.data.bookReadStates) {
          const existingState = await tx.bookReadState.findFirst({
            where: { id: state.id, familyId }
          })

          if (existingState) {
            await tx.bookReadState.update({
              where: { id: state.id },
              data: state
            })
          } else {
            await tx.bookReadState.create({
              data: {
                ...state,
                familyId
              }
            })
          }
        }
      }

      if (includeData.activeReadings && decryptedBackupData.data.activeReadings && decryptedBackupData.data.activeReadings.length > 0) {
        for (const reading of decryptedBackupData.data.activeReadings) {
          const existingReading = await tx.activeReading.findFirst({
            where: { id: reading.id, familyId }
          })

          if (existingReading) {
            await tx.activeReading.update({
              where: { id: reading.id },
              data: reading
            })
          } else {
            await tx.activeReading.create({
              data: {
                ...reading,
                familyId
              }
            })
          }
        }
      }

      // Update plan data
      if (includeData.weeklyPlans && decryptedBackupData.data.weeklyPlans && decryptedBackupData.data.weeklyPlans.length > 0) {
        for (const plan of decryptedBackupData.data.weeklyPlans) {
          const existingPlan = await tx.weeklyPlan.findFirst({
            where: { id: plan.id, familyId }
          })

          if (existingPlan) {
            await tx.weeklyPlan.update({
              where: { id: plan.id },
              data: plan
            })
          } else {
            await tx.weeklyPlan.create({
              data: {
                ...plan,
                familyId
              }
            })
          }
        }
      }

      if (includeData.dailyCheckins && decryptedBackupData.data.dailyCheckins && decryptedBackupData.data.dailyCheckins.length > 0) {
        for (const checkin of decryptedBackupData.data.dailyCheckins) {
          const existingCheckin = await tx.dailyCheckin.findFirst({
            where: { id: checkin.id, familyId }
          })

          if (existingCheckin) {
            await tx.dailyCheckin.update({
              where: { id: checkin.id },
              data: checkin
            })
          } else {
            await tx.dailyCheckin.create({
              data: {
                ...checkin,
                familyId
              }
            })
          }
        }
      }

      if (includeData.childTasks && decryptedBackupData.data.childTasks && decryptedBackupData.data.childTasks.length > 0) {
        for (const task of decryptedBackupData.data.childTasks) {
          const existingTask = await tx.childTask.findFirst({
            where: { id: task.id, familyId }
          })

          if (existingTask) {
            await tx.childTask.update({
              where: { id: task.id },
              data: task
            })
          } else {
            await tx.childTask.create({
              data: {
                ...task,
                familyId
              }
            })
          }
        }
      }

      // Update achievement records
      if (includeData.achievementLogs && decryptedBackupData.data.achievementLogs && decryptedBackupData.data.achievementLogs.length > 0) {
        for (const log of decryptedBackupData.data.achievementLogs) {
          const existingLog = await tx.achievementLog.findFirst({
            where: { id: log.id, familyId }
          })

          if (existingLog) {
            await tx.achievementLog.update({
              where: { id: log.id },
              data: log
            })
          } else {
            await tx.achievementLog.create({
              data: {
                ...log,
                familyId
              }
            })
          }
        }
      }

      // Update AI related data
      if (includeData.bookAIInsights && decryptedBackupData.data.bookAIInsights && decryptedBackupData.data.bookAIInsights.length > 0) {
        for (const insight of decryptedBackupData.data.bookAIInsights) {
          const existingInsight = await tx.bookAIInsight.findFirst({
            where: { id: insight.id, familyId }
          })

          if (existingInsight) {
            await tx.bookAIInsight.update({
              where: { id: insight.id },
              data: insight
            })
          } else {
            await tx.bookAIInsight.create({
              data: {
                ...insight,
                familyId
              }
            })
          }
        }
      }
    })

    res.json({
      status: 'success',
      message: '配置恢复成功'
    })
  } catch (error) {
    console.error('[Config Restore] Error restoring backup:', error)
    res.status(500).json({
      status: 'error',
      message: '恢复备份失败'
    })
  }
})

/**
 * GET /backup-history - Get backup history
 */
configRouter.get('/backup-history', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  try {
    const backupsDirectory = path.join(__dirname, '../../backups')
    
    // Check if backups directory exists
    try {
      await fs.access(backupsDirectory)
    } catch {
      return res.json({
        status: 'success',
        data: []
      })
    }

    // Get backup files for this family
    const files = await fs.readdir(backupsDirectory)
    console.log('[Config Backup History] Files found:', files)
    
    const familyBackups = await Promise.all(
      files
        .filter(file => file.includes(`backup_${familyId}_`))
        .map(async file => {
          try {
            console.log('[Config Backup History] Processing file:', file)
            const parts = file.split('_')
            console.log('[Config Backup History] File parts:', parts)
            
            // Find the index of the timestamp part (should start with a year)
            let timestampIndex = 2
            while (timestampIndex < parts.length && !/^\d{4}$/.test(parts[timestampIndex])) {
              timestampIndex++
            }
            console.log('[Config Backup History] Timestamp index:', timestampIndex)
            
            const timestamp = parts.slice(timestampIndex).join('_').replace('.json', '').replace(/-/g, ':')
            console.log('[Config Backup History] Extracted timestamp:', timestamp)
            
            const filePath = path.join(backupsDirectory, file)
            const stats = await fs.stat(filePath)
            console.log('[Config Backup History] File stats:', stats)
            
            const date = new Date(timestamp)
            console.log('[Config Backup History] Created date:', date)
            
            return {
              fileName: file,
              timestamp: date.toISOString(),
              size: stats.size,
              sizeFormatted: formatFileSize(stats.size)
            }
          } catch (error) {
            console.error('[Config Backup History] Error processing file', file, ':', error)
            return null
          }
        })
    )
    
    console.log('[Config Backup History] Family backups:', familyBackups)
    
    // Filter out null values and sort backups by timestamp (newest first)
    const validBackups = familyBackups.filter((b): b is NonNullable<typeof b> => b !== null)
    validBackups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    res.json({
      status: 'success',
      data: validBackups
    })
  } catch (error) {
    console.error('[Config Backup History] Error getting backup history:', error)
    res.status(500).json({
      status: 'error',
      message: '获取备份历史失败'
    })
  }
})

/**
 * GET /download-backup/:fileName - Download a specific backup file
 */
configRouter.get('/download-backup/:fileName', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { fileName } = req.params

  try {
    const backupsDirectory = path.join(__dirname, '../../backups')
    // Sanitize filename to prevent path traversal
    const safeName = path.basename(fileName)
    const filePath = path.join(backupsDirectory, safeName)

    // Validate resolved path stays within backups directory
    if (!filePath.startsWith(path.resolve(backupsDirectory))) {
      return res.status(403).json({
        status: 'error',
        message: '无效的文件路径'
      })
    }

    // Validate the file belongs to this family
    if (!safeName.includes(`backup_${familyId}_`)) {
      return res.status(403).json({
        status: 'error',
        message: '无权限访问此备份文件'
      })
    }

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).json({
        status: 'error',
        message: '备份文件不存在'
      })
    }

    res.download(filePath, fileName)
  } catch (error) {
    console.error('[Config Download Backup] Error downloading backup:', error)
    res.status(500).json({
      status: 'error',
      message: '下载备份失败'
    })
  }
})

/**
 * DELETE /delete-backup/:fileName - Delete a specific backup file
 */
configRouter.delete('/delete-backup/:fileName', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { fileName } = req.params

  try {
    const backupsDirectory = path.join(__dirname, '../../backups')
    // Sanitize filename to prevent path traversal
    const safeName = path.basename(fileName)
    const filePath = path.join(backupsDirectory, safeName)

    // Validate resolved path stays within backups directory
    if (!filePath.startsWith(path.resolve(backupsDirectory))) {
      return res.status(403).json({
        status: 'error',
        message: '无效的文件路径'
      })
    }

    // Validate the file belongs to this family
    if (!safeName.includes(`backup_${familyId}_`)) {
      return res.status(403).json({
        status: 'error',
        message: '无权限删除此备份文件'
      })
    }

    // Delete the file
    try {
      await fs.unlink(filePath)
    } catch {
      return res.status(404).json({
        status: 'error',
        message: '备份文件不存在'
      })
    }

    res.json({
      status: 'success',
      message: '备份文件删除成功'
    })
  } catch (error) {
    console.error('[Config Delete Backup] Error deleting backup:', error)
    res.status(500).json({
      status: 'error',
      message: '删除备份失败'
    })
  }
})

/**
 * Helper function to format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Helper functions for backup encryption
 */
function encryptBackup(data: any, password: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), password).toString()
}

function decryptBackup(encryptedData: string, password: string): any {
  const bytes = CryptoJS.AES.decrypt(encryptedData, password)
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
}

/**
 * GET /system-status - Get system status and configuration
 */
configRouter.get('/system-status', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  try {
    // Get system status
    const status = {
      timestamp: new Date().toISOString(),
      familyId,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      },
      database: {
        connected: true // We could add actual database connection check here
      },
      stats: {
        users: await prisma.user.count({ where: { familyId } }),
        tasks: await prisma.task.count({ where: { familyId } }),
        books: await prisma.book.count({ where: { familyId } }),
        achievements: await prisma.achievement.count({ where: { familyId } }),
        backups: (await fs.readdir(path.join(__dirname, '../../backups'))).filter(file => file.includes(`backup_${familyId}_`)).length
      },
      health: {
        database: 'healthy',
        disk: {
          status: 'healthy',
          total: 0,
          free: 0,
          used: 0,
          percentage: 0
        },
        backupDir: 'healthy',
        cloudStorage: 'not_configured'
      }
    }

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`
      status.health.database = 'healthy'
    } catch (error) {
      status.health.database = 'unhealthy'
    }

    // Check disk space
    try {
      const stats = await fs.statfs(path.join(__dirname, '../../'))
      const blockSize = stats.bsize
      const totalBlocks = stats.blocks
      const freeBlocks = stats.bfree
      
      status.health.disk = {
        total: blockSize * totalBlocks,
        free: blockSize * freeBlocks,
        used: blockSize * (totalBlocks - freeBlocks),
        percentage: Math.round(((totalBlocks - freeBlocks) / totalBlocks) * 100),
        status: Math.round(((totalBlocks - freeBlocks) / totalBlocks) * 100) < 90 ? 'healthy' : 'warning'
      }
    } catch (error) {
      console.error('[Config] Error checking disk space:', error)
      status.health.disk.status = 'error'
    }

    // Check backup directory
    try {
      const backupDir = path.join(__dirname, '../../backups')
      await fs.access(backupDir)
      status.health.backupDir = 'healthy'
    } catch (error) {
      status.health.backupDir = 'unhealthy'
    }

    // Check cloud storage connection
    try {
      const cloudStorageConfig = await prisma.cloudStorageConfig.findFirst({
        where: { familyId, isActive: true }
      })
      
      if (cloudStorageConfig) {
        status.health.cloudStorage = 'configured'
      }
    } catch (error) {
      console.error('[Config] Error checking cloud storage status:', error)
      status.health.cloudStorage = 'error'
    }

    res.json({
      status: 'success',
      data: status
    })
  } catch (error) {
    console.error('[Config System Status] Error getting system status:', error)
    res.status(500).json({
      status: 'error',
      message: '获取系统状态失败'
    })
  }
})
