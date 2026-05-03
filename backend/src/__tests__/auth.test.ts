import request from 'supertest'
import { createApp } from '../app'
import { env } from '../config/env'

const app = createApp()

describe('Auth API', () => {
  const testUser = {
    username: `test-${Date.now()}`,
    password: 'Test123456',
  }

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/register`)
        .send(testUser)
        .expect(201)

      expect(response.body.status).toBe('success')
      expect(response.body.data).toBeDefined()
      expect(response.body.data.token).toBeDefined()
    })

    it('should reject duplicate username', async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/register`)
        .send(testUser)
        .expect(409)

      expect(response.body.status).toBe('error')
    })

    it('should reject short password', async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/register`)
        .send({ username: `test-short-${Date.now()}`, password: '123' })
        .expect(400)

      expect(response.body.status).toBe('error')
    })

    it('should reject missing username', async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/register`)
        .send({ password: 'Test123456' })
        .expect(400)

      expect(response.body.status).toBe('error')
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/login`)
        .send({ username: testUser.username, password: testUser.password })
        .expect(200)

      expect(response.body.status).toBe('success')
      expect(response.body.data).toBeDefined()
      expect(response.body.data.token).toBeDefined()
    })

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/login`)
        .send({ username: testUser.username, password: 'wrong-password' })
        .expect(401)

      expect(response.body.status).toBe('error')
    })

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/login`)
        .send({ username: 'nonexistent-user', password: 'Test123456' })
        .expect(401)

      expect(response.body.status).toBe('error')
    })
  })

  describe('GET /api/auth/me', () => {
    let authToken: string

    beforeAll(async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/login`)
        .send({ username: testUser.username, password: testUser.password })
      authToken = response.body.data.token
    })

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get(`${env.API_PREFIX}/me`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.status).toBe('success')
      expect(response.body.data).toBeDefined()
      expect(response.body.data.name).toBe(testUser.username)
    })

    it('should reject request without token', async () => {
      await request(app)
        .get(`${env.API_PREFIX}/me`)
        .expect(401)
    })

    it('should reject request with invalid token', async () => {
      await request(app)
        .get(`${env.API_PREFIX}/me`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
    })
  })
})
