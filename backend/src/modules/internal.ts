import express, { Router, Request, Response } from 'express'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { env } from '../config/env'

const internalRouter: Router = express.Router()

// 简单的认证中间件
const internalAuth = (req: Request, res: Response, next: any) => {
  const apiKey = req.headers['x-api-key']
  if (!apiKey || apiKey !== env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// 触发测试运行
internalRouter.post('/trigger-tests', internalAuth, async (_req: Request, res: Response) => {
  try {
    // 异步执行测试命令
    exec('npm run test:all', { cwd: path.join(__dirname, '../../') }, (error, stdout, stderr) => {
      if (error) {
        console.error('测试执行失败:', error)
        return
      }
      console.log('测试执行完成:', stdout)
      if (stderr) {
        console.error('测试执行错误:', stderr)
      }
    })

    res.json({ success: true, message: '测试已开始执行' })
  } catch (error) {
    console.error('触发测试失败:', error)
    res.status(500).json({ error: '触发测试失败' })
  }
})

// 获取测试结果
internalRouter.get('/test-results', internalAuth, async (_req: Request, res: Response) => {
  try {
    const testResultsPath = path.join(__dirname, '../../test-results.json')
    
    if (!fs.existsSync(testResultsPath)) {
      res.json({
        status: 'pending',
        message: '测试结果文件不存在'
      })
      return
    }

    const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'))
    res.json(testResults)
  } catch (error) {
    console.error('获取测试结果失败:', error)
    res.status(500).json({ error: '获取测试结果失败' })
  }
})

export { internalRouter }