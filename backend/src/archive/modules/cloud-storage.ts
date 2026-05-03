import { Router } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import fs from 'fs/promises'
import path from 'path'
import { google } from 'googleapis'
import { Dropbox } from 'dropbox'
import { BlobServiceClient } from '@azure/storage-blob'

// Cloud storage types
export type CloudStorageProvider = 'google' | 'dropbox' | 'onedrive' | 'baidu'

export type CloudStorageConfig = {
  id: string
  familyId: string
  provider: CloudStorageProvider
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  isActive: boolean
}

// Cloud storage service interface
interface CloudStorageService {
  uploadFile(localPath: string, remotePath: string): Promise<void>
  downloadFile(remotePath: string, localPath: string): Promise<void>
  listFiles(remotePath: string): Promise<Array<{ name: string; size: number; modifiedAt: Date }>>
  deleteFile(remotePath: string): Promise<void>
}

// Google Drive service
class GoogleDriveService implements CloudStorageService {
  private drive: any

  constructor(accessToken: string) {
    this.drive = google.drive({ version: 'v3', auth: accessToken })
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    const file = await fs.readFile(localPath)
    await this.drive.files.create({
      requestBody: {
        name: path.basename(remotePath),
        parents: [remotePath.split('/').slice(0, -1).join('/') || 'root']
      },
      media: {
        body: file
      }
    })
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const response = await this.drive.files.get(
      { fileId: remotePath, alt: 'media' },
      { responseType: 'stream' }
    )
    
    const writeStream = fs.createWriteStream(localPath)
    await new Promise((resolve, reject) => {
      response.data
        .pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject)
    })
  }

  async listFiles(remotePath: string): Promise<Array<{ name: string; size: number; modifiedAt: Date }>> {
    const response = await this.drive.files.list({
      q: `'${remotePath || 'root'}' in parents and trashed = false`,
      fields: 'files(name, size, modifiedTime)'
    })

    return response.data.files.map((file: any) => ({
      name: file.name,
      size: file.size || 0,
      modifiedAt: new Date(file.modifiedTime)
    }))
  }

  async deleteFile(remotePath: string): Promise<void> {
    await this.drive.files.delete({ fileId: remotePath })
  }
}

// Dropbox service
class DropboxService implements CloudStorageService {
  private dbx: Dropbox

  constructor(accessToken: string) {
    this.dbx = new Dropbox({ accessToken })
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    const file = await fs.readFile(localPath)
    await this.dbx.filesUpload({
      path: remotePath,
      contents: file
    })
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const response = await this.dbx.filesDownload({ path: remotePath })
    await fs.writeFile(localPath, response.result.fileBinary as Buffer)
  }

  async listFiles(remotePath: string): Promise<Array<{ name: string; size: number; modifiedAt: Date }>> {
    const response = await this.dbx.filesListFolder({
      path: remotePath || ''
    })

    return response.result.entries
      .filter((entry: any) => entry['.tag'] === 'file')
      .map((entry: any) => ({
        name: entry.name,
        size: entry.size,
        modifiedAt: new Date(entry.server_modified)
      }))
  }

  async deleteFile(remotePath: string): Promise<void> {
    await this.dbx.filesDeleteV2({ path: remotePath })
  }
}

// OneDrive service
class OneDriveService implements CloudStorageService {
  private blobService: BlobServiceClient
  private containerName: string

  constructor(accessToken: string, containerName: string = 'backups') {
    this.blobService = BlobServiceClient.fromConnectionString(accessToken)
    this.containerName = containerName
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    const containerClient = this.blobService.getContainerClient(this.containerName)
    await containerClient.createIfNotExists()
    
    const blobClient = containerClient.getBlobClient(remotePath)
    const file = await fs.readFile(localPath)
    await blobClient.uploadData(file)
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const containerClient = this.blobService.getContainerClient(this.containerName)
    const blobClient = containerClient.getBlobClient(remotePath)
    
    const downloadBlockBlobResponse = await blobClient.download()
    const file = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody!)
    await fs.writeFile(localPath, file)
  }

  async listFiles(remotePath: string): Promise<Array<{ name: string; size: number; modifiedAt: Date }>> {
    const containerClient = this.blobService.getContainerClient(this.containerName)
    const blobs = []
    
    for await (const blob of containerClient.listBlobsFlat({
      prefix: remotePath || ''
    })) {
      blobs.push({
        name: blob.name,
        size: blob.properties.contentLength || 0,
        modifiedAt: blob.properties.lastModified || new Date()
      })
    }

    return blobs
  }

  async deleteFile(remotePath: string): Promise<void> {
    const containerClient = this.blobService.getContainerClient(this.containerName)
    const blobClient = containerClient.getBlobClient(remotePath)
    await blobClient.deleteIfExists()
  }
}

// Helper function to convert stream to buffer
function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    readableStream.on('data', (data) => chunks.push(data as Buffer))
    readableStream.on('end', () => resolve(Buffer.concat(chunks)))
    readableStream.on('error', reject)
  })
}

// Cloud storage factory
function createCloudStorageService(provider: CloudStorageProvider, accessToken: string): CloudStorageService {
  switch (provider) {
    case 'google':
      return new GoogleDriveService(accessToken)
    case 'dropbox':
      return new DropboxService(accessToken)
    case 'onedrive':
      return new OneDriveService(accessToken)
    case 'baidu':
      // 百度云API需要单独实现
      throw new AppError(501, '百度云存储服务暂未实现')
    default:
      throw new AppError(400, '不支持的云存储提供商')
  }
}

// Router setup
export const cloudStorageRouter: Router = Router()

// All routes require authentication and parent role
cloudStorageRouter.use(authMiddleware)
cloudStorageRouter.use(requireRole('parent'))

/**
 * GET /cloud-storage/configs - Get cloud storage configurations
 */
cloudStorageRouter.get('/configs', async (req: AuthRequest, res) => {
  const { familyId } = req.user!

  try {
    const configs = await prisma.cloudStorageConfig.findMany({
      where: { familyId }
    })

    res.json({
      status: 'success',
      data: configs
    })
  } catch (error) {
    console.error('[Cloud Storage] Error getting configs:', error)
    res.status(500).json({
      status: 'error',
      message: '获取云存储配置失败'
    })
  }
})

/**
 * POST /cloud-storage/configs - Create or update cloud storage configuration
 */
cloudStorageRouter.post('/configs', async (req: AuthRequest, res) => {
  const { familyId } = req.user!
  const { provider, accessToken, refreshToken, expiresAt, isActive } = req.body

  if (!provider || !accessToken) {
    throw new AppError(400, '提供商和访问令牌不能为空')
  }

  try {
    // Check if config already exists
    const existingConfig = await prisma.cloudStorageConfig.findFirst({
      where: { familyId, provider }
    })

    let config
    if (existingConfig) {
      // Update existing config
      config = await prisma.cloudStorageConfig.update({
        where: { id: existingConfig.id },
        data: {
          accessToken,
          refreshToken,
          expiresAt,
          isActive
        }
      })
    } else {
      // Create new config
      config = await prisma.cloudStorageConfig.create({
        data: {
          familyId,
          provider,
          accessToken,
          refreshToken,
          expiresAt,
          isActive
        }
      })
    }

    // If this config is active, deactivate others
    if (isActive) {
      await prisma.cloudStorageConfig.updateMany({
        where: {
          familyId,
          provider: { not: provider }
        },
        data: { isActive: false }
      })
    }

    res.json({
      status: 'success',
      data: config
    })
  } catch (error) {
    console.error('[Cloud Storage] Error creating/updating config:', error)
    res.status(500).json({
      status: 'error',
      message: '创建/更新云存储配置失败'
    })
  }
})

/**
 * DELETE /cloud-storage/configs/:id - Delete cloud storage configuration
 */
cloudStorageRouter.delete('/configs/:id', async (req: AuthRequest, res) => {
  const { familyId } = req.user!
  const { id } = req.params

  try {
    const config = await prisma.cloudStorageConfig.findFirst({
      where: { id, familyId }
    })

    if (!config) {
      throw new AppError(404, '云存储配置不存在')
    }

    await prisma.cloudStorageConfig.delete({
      where: { id }
    })

    res.json({
      status: 'success',
      message: '云存储配置删除成功'
    })
  } catch (error) {
    console.error('[Cloud Storage] Error deleting config:', error)
    res.status(500).json({
      status: 'error',
      message: '删除云存储配置失败'
    })
  }
})

/**
 * POST /cloud-storage/sync-backup - Sync backup to cloud storage
 */
cloudStorageRouter.post('/sync-backup', async (req: AuthRequest, res) => {
  const { familyId } = req.user!
  const { backupFileName } = req.body

  if (!backupFileName) {
    throw new AppError(400, '备份文件名不能为空')
  }

  try {
    // Get active cloud storage config
    const config = await prisma.cloudStorageConfig.findFirst({
      where: { familyId, isActive: true }
    })

    if (!config) {
      throw new AppError(400, '没有激活的云存储配置')
    }

    // Create cloud storage service
    const service = createCloudStorageService(config.provider, config.accessToken)

    // Local backup path
    const localBackupPath = path.join(__dirname, '../../backups', backupFileName)

    // Remote backup path
    const remoteBackupPath = `/quxueban-backups/${backupFileName}`

    // Upload backup to cloud storage
    await service.uploadFile(localBackupPath, remoteBackupPath)

    res.json({
      status: 'success',
      message: '备份同步到云存储成功'
    })
  } catch (error) {
    console.error('[Cloud Storage] Error syncing backup:', error)
    res.status(500).json({
      status: 'error',
      message: '同步备份到云存储失败'
    })
  }
})

/**
 * GET /cloud-storage/backups - List backups in cloud storage
 */
cloudStorageRouter.get('/backups', async (req: AuthRequest, res) => {
  const { familyId } = req.user!

  try {
    // Get active cloud storage config
    const config = await prisma.cloudStorageConfig.findFirst({
      where: { familyId, isActive: true }
    })

    if (!config) {
      throw new AppError(400, '没有激活的云存储配置')
    }

    // Create cloud storage service
    const service = createCloudStorageService(config.provider, config.accessToken)

    // List backups in cloud storage
    const backups = await service.listFiles('/quxueban-backups')

    res.json({
      status: 'success',
      data: backups
    })
  } catch (error) {
    console.error('[Cloud Storage] Error listing backups:', error)
    res.status(500).json({
      status: 'error',
      message: '列出云存储中的备份失败'
    })
  }
})

/**
 * POST /cloud-storage/download-backup - Download backup from cloud storage
 */
cloudStorageRouter.post('/download-backup', async (req: AuthRequest, res) => {
  const { familyId } = req.user!
  const { backupFileName } = req.body

  if (!backupFileName) {
    throw new AppError(400, '备份文件名不能为空')
  }

  try {
    // Get active cloud storage config
    const config = await prisma.cloudStorageConfig.findFirst({
      where: { familyId, isActive: true }
    })

    if (!config) {
      throw new AppError(400, '没有激活的云存储配置')
    }

    // Create cloud storage service
    const service = createCloudStorageService(config.provider, config.accessToken)

    // Local backup path
    const localBackupPath = path.join(__dirname, '../../backups', backupFileName)

    // Remote backup path
    const remoteBackupPath = `/quxueban-backups/${backupFileName}`

    // Download backup from cloud storage
    await service.downloadFile(remoteBackupPath, localBackupPath)

    res.json({
      status: 'success',
      message: '从云存储下载备份成功'
    })
  } catch (error) {
    console.error('[Cloud Storage] Error downloading backup:', error)
    res.status(500).json({
      status: 'error',
      message: '从云存储下载备份失败'
    })
  }
})
