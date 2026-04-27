import express, { Application } from 'express'
import cors from 'cors'
import compression from 'compression'
import 'express-async-errors'
import path from 'path'
import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { httpLogger } from './middleware/logger'
import { systemRouter } from './modules/system'
// ============================================
// Domain module imports
// ============================================
import { authRouter } from './modules/auth'
import { tasksRouter } from './modules/tasks'
import { plansRouter } from './modules/plans'
import { libraryRouter } from './modules/library'
import { readingRouter } from './modules/reading'
import { readingRouter as readingLogsRouter } from './modules/reading-logs'
import { reportsRouter } from './modules/reports'
import { statisticsRouter } from './modules/statistics'
import { dashboardRouter } from './modules/dashboard'
import { taskTemplatesRouter } from './modules/task-templates'
import { childrenRouter } from './modules/children'
import { dingtalkRouter } from './modules/dingtalk'
import { settingsRouter } from './modules/settings'
import { aiInsightsRouter } from './modules/ai-insights'
import { aiRouter } from './modules/ai'
import { uploadRouter } from './modules/upload'
// import { internalRouter } from './modules/internal'  // 暂时注释掉有问题的模块

export const createApp = (): Application => {
  const app = express()

  // HTTP request logging
  app.use(httpLogger)

  app.use(
    cors({
      origin: env.CORS_ORIGIN.includes(',')
        ? env.CORS_ORIGIN.split(',').map(s => s.trim())
        : env.CORS_ORIGIN,
      credentials: true,
    })
  )

  // Body parsing and compression
  app.use(express.json({ limit: '5mb' }))
  app.use(express.urlencoded({ extended: true, limit: '5mb' }))
  app.use(compression())

  // API routes - System & Health
  app.use(env.API_PREFIX, systemRouter)

  // ============================================
  // Domain module routes
  // ============================================
  app.use(env.API_PREFIX, authRouter)
  app.use(`${env.API_PREFIX}/tasks`, tasksRouter)
  app.use(`${env.API_PREFIX}/plans`, plansRouter)
  app.use(`${env.API_PREFIX}/library`, libraryRouter)
  app.use(`${env.API_PREFIX}/reading`, readingRouter)
  app.use(`${env.API_PREFIX}/reading-logs`, readingLogsRouter)
  app.use(`${env.API_PREFIX}/reports`, reportsRouter)
  app.use(`${env.API_PREFIX}/statistics`, statisticsRouter)
  app.use(`${env.API_PREFIX}/dashboard`, dashboardRouter)
  app.use(`${env.API_PREFIX}/children`, childrenRouter)
  app.use(`${env.API_PREFIX}/task-templates`, taskTemplatesRouter)
  app.use(`${env.API_PREFIX}/dingtalk`, dingtalkRouter)
  app.use(`${env.API_PREFIX}/settings`, settingsRouter)
  app.use(`${env.API_PREFIX}/ai-insights`, aiInsightsRouter)
  app.use(`${env.API_PREFIX}/ai`, aiRouter)
  app.use(`${env.API_PREFIX}/upload`, uploadRouter)

  // Serve uploaded files statically. The /api/uploads alias works behind nginx
  // configs that only proxy /api to the backend.
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
  app.use(`${env.API_PREFIX}/uploads`, express.static(path.join(__dirname, '../uploads')))

  // Internal routes for quality monitoring dashboard - 暂时禁用
  // app.use(`${env.API_PREFIX}/internal`, internalRouter)

  // Error handling
  app.use(errorHandler)

  return app
}
