import express, { Application } from 'express'
import cors from 'cors'
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
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

  // nginx terminates public requests and forwards the real client IP.
  // Without this, production rate limits group every request under 127.0.0.1.
  app.set('trust proxy', 'loopback')

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }))

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
  // Keep operational checks outside business rate limits so deploy verification
  // and health probes cannot lock users out of the app.
  app.use(env.API_PREFIX, systemRouter)

  // Rate limiting - skip in development
  if (env.NODE_ENV === 'production') {
    // Single-page app pages can trigger many parallel data requests. Use a
    // production floor even if an old .env still carries the previous low value.
    const businessRateLimitMax = Math.max(env.RATE_LIMIT_MAX_REQUESTS, 2000)
    const limiter = rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: businessRateLimitMax,
      skip: req => req.path === `${env.API_PREFIX}/login` || req.path === `${env.API_PREFIX}/register`,
      message: { status: 'error', message: '请求过于频繁，请稍后再试' },
      standardHeaders: true,
      legacyHeaders: false,
    })

    // Stricter rate limiting for auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20, // 20 attempts per window
      message: { status: 'error', message: '登录尝试过于频繁，请15分钟后再试' },
      standardHeaders: true,
      legacyHeaders: false,
    })
    app.use(`${env.API_PREFIX}/login`, authLimiter)
    app.use(`${env.API_PREFIX}/register`, authLimiter)
    app.use(limiter)
  }

  app.use(env.API_PREFIX, authRouter)

  // ============================================
  // Domain module routes
  // ============================================
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
