import { Router } from 'express'
import cron from 'node-cron'
import { prisma } from '../config/database'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
// AuthRequest type definition
interface AuthRequest extends Request {
  user?: {
    id: number
    name: string
    role: string
    familyId: number
    avatar: string
  }
}

export const schedulerRouter: Router = Router()

// Schedule types
export type BackupSchedule = {
  familyId: number
  frequency: 'daily' | 'weekly' | 'monthly'
  time: string // HH:MM format
  enabled: boolean
}

// In-memory storage for schedules (in production, this would be in a database)
const backupSchedules: Map<number, BackupSchedule> = new Map()

// Create backup for a family
async function createBackupForFamily(familyId: number) {
  try {
    // Get all configuration data
    const backupData = {
      timestamp: new Date().toISOString(),
      familyId,
      data: {
        // Family settings
        family: await prisma.family.findUnique({
          where: { id: familyId },
          select: {
            name: true,
            settings: true
          }
        }),
        
        // Users (excluding passwords)
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
        }),
        
        // Tasks
        tasks: await prisma.task.findMany({
          where: { familyId }
        }),
        
        // Task templates
        taskTemplates: await prisma.taskTemplate.findMany({
          where: { familyId }
        }),
        
        // Books
        books: await prisma.book.findMany({
          where: { familyId }
        }),
        
        // User AI configs
        userAIConfigs: await prisma.userAIConfig.findMany({
          where: { familyId }
        }),
        
        // Achievements
        achievements: await prisma.achievement.findMany({
          where: { familyId }
        }),
        
        // Reading records
        readingLogs: await prisma.readingLog.findMany({
          where: { familyId }
        }),
        bookReadStates: await prisma.bookReadState.findMany({
          where: { familyId }
        }),
        activeReadings: await prisma.activeReading.findMany({
          where: { familyId }
        }),
        
        // Plan data
        weeklyPlans: await prisma.weeklyPlan.findMany({
          where: { familyId }
        }),
        dailyCheckins: await prisma.dailyCheckin.findMany({
          where: { familyId }
        }),
        childTasks: await prisma.childTask.findMany({
          where: { familyId }
        }),
        
        // Achievement records
        achievementLogs: await prisma.achievementLog.findMany({
          where: { familyId }
        }),
        
        // AI related data
        bookAIInsights: await prisma.bookAIInsight.findMany({
          where: { familyId }
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

    // Write backup to file
    const backupContent = JSON.stringify(backupData, null, 2)
    
    // Calculate SHA256 hash of the backup
    const hash = crypto.createHash('sha256').update(backupContent).digest('hex')
    
    // Add hash to backup data
    backupData.hash = hash
    
    // Write updated backup data with hash
    await fs.writeFile(backupFilePath, JSON.stringify(backupData, null, 2))

    console.log(`[Scheduler] Created backup for family ${familyId}: ${backupFileName}`)

  } catch (error) {
    console.error(`[Scheduler] Error creating backup for family ${familyId}:`, error)
  }
}

// Clean up old backups for a family
async function cleanupOldBackups(familyId: number) {
  try {
    const backupsDirectory = path.join(__dirname, '../../backups')
    
    // Check if backups directory exists
    try {
      await fs.access(backupsDirectory)
    } catch {
      return
    }

    // Get backup files for this family
    const files = await fs.readdir(backupsDirectory)
    const familyBackups = files
      .filter(file => file.includes(`backup_${familyId}_`))
      .map(file => ({
        fileName: file,
        timestamp: new Date(file.split('_').slice(2).join('_').replace('.json', '').replace(/-/g, ':')).getTime()
      }))
      .sort((a, b) => b.timestamp - a.timestamp)

    // Keep only the most recent 5 backups
    if (familyBackups.length > 5) {
      const backupsToDelete = familyBackups.slice(5)
      for (const backup of backupsToDelete) {
        const filePath = path.join(backupsDirectory, backup.fileName)
        await fs.unlink(filePath)
        console.log(`[Scheduler] Deleted old backup for family ${familyId}: ${backup.fileName}`)
      }
    }

  } catch (error) {
    console.error(`[Scheduler] Error cleaning up old backups for family ${familyId}:`, error)
  }
}

// Main backup job
async function runBackupJobs() {
  console.log(`[Scheduler] Running backup jobs at ${new Date().toISOString()}`)
  
  // Get all families
  const families = await prisma.family.findMany()
  
  for (const family of families) {
    const schedule = backupSchedules.get(family.id)
    if (schedule && schedule.enabled) {
      // Check if it's time to run the backup
      const now = new Date()
      const [hours, minutes] = schedule.time.split(':').map(Number)
      
      // For daily backups, run at the specified time
      if (schedule.frequency === 'daily' && 
          now.getHours() === hours && 
          now.getMinutes() === minutes) {
        await createBackupForFamily(family.id)
        await cleanupOldBackups(family.id)
      }
      
      // For weekly backups, run on Sunday at the specified time
      if (schedule.frequency === 'weekly' && 
          now.getDay() === 0 && // Sunday
          now.getHours() === hours && 
          now.getMinutes() === minutes) {
        await createBackupForFamily(family.id)
        await cleanupOldBackups(family.id)
      }
      
      // For monthly backups, run on the 1st of the month at the specified time
      if (schedule.frequency === 'monthly' && 
          now.getDate() === 1 && 
          now.getHours() === hours && 
          now.getMinutes() === minutes) {
        await createBackupForFamily(family.id)
        await cleanupOldBackups(family.id)
      }
    }
  }
}

// Start the scheduler
function startScheduler() {
  // Run backup jobs every minute to check if it's time to run
  cron.schedule('* * * * *', runBackupJobs)
  console.log('[Scheduler] Started backup scheduler')
}

// API routes
schedulerRouter.get('/backup-schedule', (req: AuthRequest, res) => {
  const { familyId } = req.user!
  const schedule = backupSchedules.get(familyId)
  res.json({
    status: 'success',
    data: schedule || null
  })
})

schedulerRouter.post('/backup-schedule', (req: AuthRequest, res) => {
  const { familyId } = req.user!
  const { frequency, time, enabled } = req.body
  
  const schedule: BackupSchedule = {
    familyId,
    frequency,
    time,
    enabled
  }
  
  backupSchedules.set(familyId, schedule)
  res.json({
    status: 'success',
    data: schedule
  })
})

// Export startScheduler function
export { startScheduler }
