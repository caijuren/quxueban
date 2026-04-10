import { Router, Response } from 'express'
import fetch from 'node-fetch'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { env } from '../config/env'

export const aiInsightsRouter: Router = Router()

// All routes require authentication and parent role
aiInsightsRouter.use(authMiddleware)
aiInsightsRouter.use(requireRole('parent'))

/**
 * GET / - Get AI insights for a book
 */
aiInsightsRouter.get('/books/:bookId', async (req: AuthRequest, res: Response) => {
  const bookId = parseInt(req.params.bookId as string)
  const { familyId } = req.user!

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock AI insight
    const mockInsight = {
      id: 1,
      familyId: familyId,
      bookId: bookId,
      childId: 2,
      insights: {
        contentAnalysis: "这是一本关于友谊和勇气的儿童故事书，通过主人公的冒险经历，传递了积极向上的价值观。",
        readingProgress: "孩子的阅读速度适中，能够理解书中的主要内容，建议增加阅读时间以提高阅读流畅度。",
        abilityDevelopment: "阅读这本书有助于培养孩子的语言表达能力、想象力和情感认知能力。",
        readingSuggestions: "建议家长与孩子一起阅读，鼓励孩子分享书中的故事和感受，还可以进行角色扮演等延伸活动。",
        parentGuidance: "家长可以通过提问的方式帮助孩子理解书中的道理，培养孩子的思考能力和表达能力。"
      },
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    res.json({
      status: 'success',
      data: mockInsight,
    })
    return
  }

  // Verify book belongs to family
  const book = await prisma.book.findFirst({
    where: { id: bookId, familyId }
  })

  if (!book) {
    throw new AppError(404, '书籍不存在')
  }

  const insight = await prisma.bookAIInsight.findFirst({
    where: { bookId, familyId },
    orderBy: { createdAt: 'desc' }
  })

  res.json({
    status: 'success',
    data: insight,
  })
})

/**
 * POST /generate - Generate AI insights for a book
 */
aiInsightsRouter.post('/books/:bookId/generate', async (req: AuthRequest, res: Response) => {
  const bookId = parseInt(req.params.bookId as string)
  const { familyId } = req.user!
  const { childId } = req.body

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock AI insight
    const mockInsight = {
      id: Math.floor(Math.random() * 10000),
      familyId: familyId,
      bookId: bookId,
      childId: childId || 2,
      insights: {
        contentAnalysis: "这是一本关于友谊和勇气的儿童故事书，通过主人公的冒险经历，传递了积极向上的价值观。",
        readingProgress: "孩子的阅读速度适中，能够理解书中的主要内容，建议增加阅读时间以提高阅读流畅度。",
        abilityDevelopment: "阅读这本书有助于培养孩子的语言表达能力、想象力和情感认知能力。",
        readingSuggestions: "建议家长与孩子一起阅读，鼓励孩子分享书中的故事和感受，还可以进行角色扮演等延伸活动。",
        parentGuidance: "家长可以通过提问的方式帮助孩子理解书中的道理，培养孩子的思考能力和表达能力。"
      },
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    res.json({
      status: 'success',
      message: 'AI分析已生成',
      data: mockInsight,
    })
    return
  }

  // Verify book belongs to family
  const book = await prisma.book.findFirst({
    where: { id: bookId, familyId }
  })

  if (!book) {
    throw new AppError(404, '书籍不存在')
  }

  // Get reading logs for the book
  const readingLogs = await prisma.readingLog.findMany({
    where: { bookId, familyId, childId },
    orderBy: { readDate: 'asc' }
  })

  // Get child information
  let childInfo = null
  if (childId) {
    childInfo = await prisma.user.findFirst({
      where: { id: childId, familyId }
    })
  }

  // Prepare prompt for AI
  const prompt = generateAIPrompt(book, readingLogs, childInfo)

  try {
    // Call AI API (using a placeholder for now)
    const aiResponse = await callAIAPI(prompt)

    // Create or update insight record
    const insight = await prisma.bookAIInsight.create({
      data: {
        familyId,
        bookId,
        childId,
        insights: aiResponse,
        status: 'completed',
      }
    })

    res.json({
      status: 'success',
      message: 'AI分析已生成',
      data: insight,
    })
  } catch (error) {
    console.error('[AI Insight] Error:', error)
    res.status(500).json({
      status: 'error',
      message: 'AI分析生成失败，请稍后重试'
    })
  }
})

/**
 * Generate AI prompt for book analysis
 */
function generateAIPrompt(book: any, readingLogs: any[], childInfo: any) {
  let prompt = `你是一位专业的儿童阅读分析专家，请根据以下信息为这本书生成一份详细的阅读分析报告：\n\n`

  // Book information
  prompt += `**书籍信息**\n`
  prompt += `书名：${book.name}\n`
  prompt += `作者：${book.author}\n`
  prompt += `出版社：${book.publisher || '未知'}\n`
  prompt += `总页数：${book.totalPages}\n`
  prompt += `ISBN：${book.isbn || '未知'}\n\n`

  // Child information
  if (childInfo) {
    prompt += `**孩子信息**\n`
    prompt += `姓名：${childInfo.name}\n`
    prompt += `年龄：${calculateAge(childInfo.birthDate)}岁\n\n`
  }

  // Reading logs
  if (readingLogs.length > 0) {
    prompt += `**阅读记录**\n`
    readingLogs.forEach((log, index) => {
      prompt += `阅读 ${index + 1}：${new Date(log.readDate).toLocaleDateString('zh-CN')}\n`
      prompt += `页码：第 ${log.startPage}-${log.endPage} 页\n`
      if (log.note) {
        prompt += `备注：${log.note}\n`
      }
      prompt += `\n`
    })
  }

  // Analysis requirements
  prompt += `**分析要求**\n`
  prompt += `1. 书籍内容分析：总结书籍的主要内容、主题思想和教育价值\n`
  prompt += `2. 阅读进度分析：分析孩子的阅读速度和习惯\n`
  prompt += `3. 能力发展分析：基于阅读内容，分析对孩子语言、认知、情感等方面的发展影响\n`
  prompt += `4. 阅读建议：提供针对性的阅读建议和延伸活动\n`
  prompt += `5. 家长指导：给家长的具体指导建议\n`
  prompt += `\n请以JSON格式返回分析结果，包含以下字段：\n`
  prompt += `{\n`
  prompt += `  "contentAnalysis": "",\n`
  prompt += `  "readingProgress": "",\n`
  prompt += `  "abilityDevelopment": "",\n`
  prompt += `  "readingSuggestions": "",\n`
  prompt += `  "parentGuidance": ""\n`
  prompt += `}`

  return prompt
}

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate: string) {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

/**
 * Call AI API
 */
async function callAIAPI(_prompt: string) {
  // This is a placeholder for the actual AI API call
  // In a real implementation, you would call OpenAI API or another LLM
  return {
    contentAnalysis: "这是一本关于友谊和勇气的儿童故事书，通过主人公的冒险经历，传递了积极向上的价值观。",
    readingProgress: "孩子的阅读速度适中，能够理解书中的主要内容，建议增加阅读时间以提高阅读流畅度。",
    abilityDevelopment: "阅读这本书有助于培养孩子的语言表达能力、想象力和情感认知能力。",
    readingSuggestions: "建议家长与孩子一起阅读，鼓励孩子分享书中的故事和感受，还可以进行角色扮演等延伸活动。",
    parentGuidance: "家长可以通过提问的方式帮助孩子理解书中的道理，培养孩子的思考能力和表达能力。"
  }
}
