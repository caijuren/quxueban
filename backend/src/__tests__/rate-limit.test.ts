import request from 'supertest'
import { jest } from '@jest/globals'

const originalEnv = { ...process.env }

const hasRateLimitHeaders = (headers: Record<string, unknown>) =>
  Object.keys(headers).some(key => key.toLowerCase().startsWith('ratelimit'))

const loadProductionApp = async () => {
  jest.resetModules()

  process.env.NODE_ENV = 'production'
  process.env.SKIP_DB_CLEANUP = 'true'
  process.env.API_PREFIX = '/api'
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-rate-limit-tests-min-32-chars'
  process.env.RATE_LIMIT_WINDOW_MS = '900000'
  process.env.RATE_LIMIT_MAX_REQUESTS = '1'

  const { createApp } = await import('../app')
  const { env } = await import('../config/env')

  return {
    app: createApp(),
    apiPrefix: env.API_PREFIX,
  }
}

describe('Production rate limiting', () => {
  afterEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, SKIP_DB_CLEANUP: 'true' }
  })

  afterAll(() => {
    process.env = { ...originalEnv }
  })

  it('keeps health and version endpoints outside business rate limits', async () => {
    const { app, apiPrefix } = await loadProductionApp()

    const healthResponse = await request(app).get(`${apiPrefix}/health`).expect(200)
    const versionResponse = await request(app).get(`${apiPrefix}/version`).expect(200)

    expect(hasRateLimitHeaders(healthResponse.headers)).toBe(false)
    expect(hasRateLimitHeaders(versionResponse.headers)).toBe(false)
  })

  it('keeps auth and authenticated business endpoints behind rate limits', async () => {
    const { app, apiPrefix } = await loadProductionApp()

    const loginResponse = await request(app)
      .post(`${apiPrefix}/login`)
      .send({})
      .expect(400)
    const childrenResponse = await request(app)
      .get(`${apiPrefix}/children`)
      .expect(401)

    expect(hasRateLimitHeaders(loginResponse.headers)).toBe(true)
    expect(loginResponse.headers['ratelimit-limit']).toBe('20')
    expect(hasRateLimitHeaders(childrenResponse.headers)).toBe(true)
    expect(childrenResponse.headers['ratelimit-limit']).toBe('2000')
  })
})
