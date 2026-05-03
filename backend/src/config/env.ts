import dotenv from 'dotenv'
import path from 'path'
import { z } from 'zod'

// Clear any existing DATABASE_URL to ensure backend .env takes precedence
delete process.env.DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_PREFIX: z.string().default('/api'),
  DATABASE_URL: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:8080'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  JISU_API_KEY: z.string().default(''),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().default('book-covers'),
  INTERNAL_API_KEY: z.string().default(''),
  // Enable mock mode for testing without database
  ENABLE_MOCK_MODE: z.string().transform((val) => val === 'true').default('false'),
})

const parseEnv = () => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:', error)
    process.exit(1)
  }
}

export const env = parseEnv()
