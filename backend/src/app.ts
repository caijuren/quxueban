import express, { Application } from 'express'
import cors from 'cors'
import compression from 'compression'
import 'express-async-errors'
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

export const createApp = (): Application => {
  const app = express()

  // HTTP request logging
  app.use(httpLogger)

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN,
      credentials: env.CORS_ORIGIN !== '*',
    })
  )

  // Body parsing and compression
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(compression())

  // API routes - System & Health
  app.use(env.API_PREFIX, systemRouter)

  // ============================================
  // Domain module routes
  // ============================================
  app.use(`${env.API_PREFIX}/auth`, authRouter)
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

  // Error handling
  app.use(errorHandler)

  return app
}
