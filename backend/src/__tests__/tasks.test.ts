import request from 'supertest'
import { createApp } from '../app'
import { env } from '../config/env'

const app = createApp()

describe('Tasks API', () => {
  let authToken: string
  let familyId: number

  beforeAll(async () => {
    // Register and login a test user
    const testUser = {
      username: `tasks-test-${Date.now()}`,
      password: 'Test123456',
    }

    const registerResponse = await request(app)
      .post(`${env.API_PREFIX}/register`)
      .send(testUser)

    authToken = registerResponse.body.data.token
    familyId = registerResponse.body.data.user.familyId
  })

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const taskData = {
        name: 'Test Task',
        category: 'chinese',
        timePerUnit: 30,
        scheduleRule: 'daily',
      }

      const response = await request(app)
        .post(`${env.API_PREFIX}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201)

      expect(response.body.status).toBe('success')
      expect(response.body.data).toBeDefined()
      expect(response.body.data.name).toBe(taskData.name)
    })

    it('should reject task without name', async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'chinese' })
        .expect(400)

      expect(response.body.status).toBe('error')
    })
  })

  describe('GET /api/tasks', () => {
    it('should return tasks list', async () => {
      const response = await request(app)
        .get(`${env.API_PREFIX}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.status).toBe('success')
      expect(Array.isArray(response.body.data)).toBe(true)
    })

    it('should reject request without auth', async () => {
      await request(app)
        .get(`${env.API_PREFIX}/tasks`)
        .expect(401)
    })
  })

  describe('PUT /api/tasks/:id', () => {
    let taskId: number

    beforeAll(async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Task to Update', category: 'math', timePerUnit: 20 })
      taskId = response.body.data.id
    })

    it('should update a task', async () => {
      const response = await request(app)
        .put(`${env.API_PREFIX}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Task Name' })
        .expect(200)

      expect(response.body.status).toBe('success')
      expect(response.body.data.name).toBe('Updated Task Name')
    })
  })

  describe('DELETE /api/tasks/:id', () => {
    let taskId: number

    beforeAll(async () => {
      const response = await request(app)
        .post(`${env.API_PREFIX}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Task to Delete', category: 'english', timePerUnit: 15 })
      taskId = response.body.data.id
    })

    it('should delete a task', async () => {
      const response = await request(app)
        .delete(`${env.API_PREFIX}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.status).toBe('success')
    })
  })
})
