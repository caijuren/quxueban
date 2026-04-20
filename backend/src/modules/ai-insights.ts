import { Router, Response, Request } from 'express'
import fetch from 'node-fetch'
import axios from 'axios'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth'
import { env } from '../config/env'
import { AIServiceFactory, AIConfig } from '../services/ai/AIServiceFactory'

export const aiInsightsRouter: Router = Router()

// All routes require authentication and parent role
aiInsightsRouter.use(authMiddleware)
aiInsightsRouter.use(requireRole('parent'))

/**
 * GET /user/ai-config - Get user AI configuration
 */
aiInsightsRouter.get('/user/ai-config', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!

  try {
    const configs = await prisma.userAIConfig.findMany({
      where: { familyId },
      orderBy: { updatedAt: 'desc' }
    })

    res.json({
      status: 'success',
      data: configs
    })
  } catch (error) {
    console.error('[AI Config] Error getting config:', error)
    res.status(500).json({
      status: 'error',
      message: '获取AI配置失败'
    })
  }
})

/**
 * POST /user/ai-config - Save user AI configuration
 */
aiInsightsRouter.post('/user/ai-config', async (req: AuthRequest, res: Response) => {
  const { familyId } = req.user!
  const { provider, config, isActive = true } = req.body

  if (!provider || !config) {
    throw new AppError(400, 'Provider and config are required')
  }

  try {
    // Upsert configuration
    const aiConfig = await prisma.userAIConfig.upsert({
      where: {
        familyId_provider: {
          familyId,
          provider
        }
      },
      create: {
        familyId,
        provider,
        config,
        isActive
      },
      update: {
        config,
        isActive
      }
    })

    res.json({
      status: 'success',
      message: 'AI配置保存成功',
      data: aiConfig
    })
  } catch (error) {
    console.error('[AI Config] Error saving config:', error)
    res.status(500).json({
      status: 'error',
      message: '保存AI配置失败'
    })
  }
})

/**
 * POST /ai/test - Test AI service connection
 */
aiInsightsRouter.post('/ai/test', async (req: AuthRequest, res: Response) => {
  const { provider, config } = req.body

  if (!provider || !config) {
    throw new AppError(400, 'Provider and config are required')
  }

  try {
    // Test connection based on provider
    let testResult = false
    let errorMessage = ''

    switch (provider) {
      case 'baidu':
        // Test Baidu AI connection
        if (config.accessToken) {
          try {
            const API_URL = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${config.accessToken}`
            const response = await axios.post(API_URL, {
              messages: [
                {
                  role: 'user',
                  content: '测试连接'
                }
              ],
              model: 'ERNIE-4.0-8K'
            })
            testResult = response.status === 200
          } catch (error) {
            errorMessage = '连接失败：' + (error as any).message
          }
        } else {
          errorMessage = '缺少accessToken'
        }
        break
      case 'kimi':
        // Test Kimi AI connection
        if (config.apiKey) {
          try {
            const API_URL = 'https://api.moonshot.cn/v1/chat/completions'
            const response = await axios.post(API_URL, {
              messages: [
                {
                  role: 'user',
                  content: '测试连接'
                }
              ],
              model: 'moonshot-v1-8k'
            }, {
              headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
              }
            })
            testResult = response.status === 200
          } catch (error) {
            errorMessage = '连接失败：' + (error as any).message
          }
        } else {
          errorMessage = '缺少apiKey'
        }
        break
      case 'openai':
        // Test OpenAI connection
        if (config.apiKey) {
          try {
            const API_URL = 'https://api.openai.com/v1/chat/completions'
            const response = await axios.post(API_URL, {
              messages: [
                {
                  role: 'user',
                  content: '测试连接'
                }
              ],
              model: 'gpt-3.5-turbo'
            }, {
              headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
              }
            })
            testResult = response.status === 200
          } catch (error) {
            errorMessage = '连接失败：' + (error as any).message
          }
        } else {
          errorMessage = '缺少apiKey'
        }
        break
      default:
        errorMessage = '不支持的AI提供商'
    }

    res.json({
      status: 'success',
      data: {
        provider,
        connected: testResult,
        message: testResult ? '连接成功' : errorMessage
      }
    })
  } catch (error) {
    console.error('[AI Test] Error testing connection:', error)
    res.status(500).json({
      status: 'error',
      message: '测试连接失败'
    })
  }
})

// Test endpoint for AI analysis
aiInsightsRouter.post('/test/generate', async (req: AuthRequest, res: Response) => {
  const { bookId = 1, childId = 2 } = req.body
  const { familyId } = req.user!

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock AI insight
    const mockInsight = {
      id: Math.floor(Math.random() * 10000),
      familyId: familyId,
      bookId: bookId,
      childId: childId,
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
  const childInfo = await prisma.user.findFirst({
    where: { id: childId, familyId }
  })

  // Calculate reading statistics
  const readingStats = calculateReadingStats(readingLogs)

  // Get book content description (from ISBN API or database)
  const bookDescription = await getBookDescription(book.isbn, book.name, book.id)

  // Prepare prompt for AI
  const prompt = generateAIPrompt(book, bookDescription, readingLogs, readingStats, childInfo)

  try {
    // Call AI API (using a placeholder for now)
    const aiResponse = await callAIAPI(prompt, familyId)

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

  // Validate childId if provided
  const parsedChildId = childId ? parseInt(childId) : null
  if (childId && isNaN(parsedChildId)) {
    throw new AppError(400, 'Invalid childId: must be a number')
  }

  // Handle mock mode
  if (!env.DATABASE_URL) {
    // Return mock AI insight
    const mockInsight = {
      id: Math.floor(Math.random() * 10000),
      familyId: familyId,
      bookId: bookId,
      childId: parsedChildId || 2,
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
    where: { bookId, familyId, childId: parsedChildId },
    orderBy: { readDate: 'asc' }
  })

  // Get child information
  let childInfo = null
  if (parsedChildId) {
    childInfo = await prisma.user.findFirst({
      where: { id: parsedChildId, familyId }
    })
  }

  // Calculate reading statistics
  const readingStats = calculateReadingStats(readingLogs)

  // Get book content description (from ISBN API or database)
  const bookDescription = await getBookDescription(book.isbn, book.name, book.id)

  // Prepare prompt for AI
  const prompt = generateAIPrompt(book, bookDescription, readingLogs, readingStats, childInfo)

  try {
    // Call AI API (using a placeholder for now)
    const aiResponse = await callAIAPI(prompt, familyId)

    // Create or update insight record
    const insight = await prisma.bookAIInsight.create({
      data: {
        familyId,
        bookId,
        childId: parsedChildId,
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
 * Calculate reading statistics from reading logs
 */
function calculateReadingStats(readingLogs: any[]) {
  if (readingLogs.length === 0) {
    return {
      totalDays: 0,
      totalTimes: 0,
      totalMinutes: 0,
      totalPages: 0,
      averageMinutesPerSession: 0,
      averagePagesPerSession: 0
    }
  }

  const totalMinutes = readingLogs.reduce((sum, log) => sum + (log.minutes || 0), 0)
  const totalPages = readingLogs.reduce((sum, log) => sum + (log.pages || 0), 0)
  const uniqueDays = new Set(readingLogs.map(log => new Date(log.readDate).toDateString())).size

  return {
    totalDays: uniqueDays,
    totalTimes: readingLogs.length,
    totalMinutes,
    totalPages,
    averageMinutesPerSession: Math.round(totalMinutes / readingLogs.length),
    averagePagesPerSession: Math.round(totalPages / readingLogs.length)
  }
}

/**
 * Get book description from ISBN API or database
 */
async function getBookDescription(isbn: string, bookName: string, bookId: number): Promise<string> {
  if (!isbn) {
    return '暂无内容简介'
  }

  try {
    // Call ISBN API to get book description
    // Using Jisu API as an example (you may need to adjust based on your actual API)
    const API_KEY = env.JISU_API_KEY || 'your_api_key';
    const API_URL = `https://api.jisuapi.com/isbn/query?appkey=${API_KEY}&isbn=${isbn}`;
    
    console.log('Fetching book description from API:', API_URL);
    
    const response = await axios.get(API_URL);
    const data = response.data;
    
    if (data.status === '0' && data.result) {
      const description = data.result.summary || `这是《${bookName}》的内容简介，描述了书籍的主要内容和主题思想。`;
      
      // Update book description in database
      await prisma.book.update({
        where: { id: bookId },
        data: { description }
      });
      
      console.log('Book description updated in database for book:', bookName);
      return description;
    } else {
      console.log('No description found for ISBN:', isbn);
      return `这是《${bookName}》的内容简介，描述了书籍的主要内容和主题思想。`;
    }
  } catch (error) {
    console.error('Error fetching book description:', error);
    return `这是《${bookName}》的内容简介，描述了书籍的主要内容和主题思想。`;
  }
}

/**
 * Generate AI prompt for book analysis
 */
function generateAIPrompt(book: any, bookDescription: string, readingLogs: any[], readingStats: any, childInfo: any) {
  let prompt = `你是一位资深儿童阅读导师。请基于以下信息，为${childInfo?.name || '孩子'}生成一份专属阅读报告。\n\n`

  // Book information
  prompt += `【书籍信息】\n`
  prompt += `书名：《${book.name}》\n`
  prompt += `作者：${book.author}\n`
  prompt += `出版社：${book.publisher || '未知'}\n`
  prompt += `ISBN：${book.isbn || '未知'}\n`
  prompt += `总页数：${book.totalPages}\n`
  prompt += `内容简介：${bookDescription}\n\n`

  // Child information
  if (childInfo) {
    prompt += `【${childInfo.name}的基本信息】\n`
    prompt += `昵称：${childInfo.name}\n`
    prompt += `年龄：${calculateAge(childInfo.birthDate || new Date())}岁\n\n`
  }

  // Reading statistics
  if (readingStats.totalTimes > 0) {
    prompt += `【${childInfo?.name || '孩子'}的阅读数据】\n`
    prompt += `总用时：${readingStats.totalMinutes}分钟\n`
    prompt += `阅读天数：${readingStats.totalDays}天\n`
    prompt += `阅读次数：${readingStats.totalTimes}次\n`
    prompt += `阅读页数：${readingStats.totalPages}页\n`
    prompt += `平均每次阅读：${readingStats.averageMinutesPerSession}分钟，${readingStats.averagePagesPerSession}页\n\n`

    // Detailed reading process
    if (readingLogs.length > 0) {
      prompt += `阅读过程：分${readingLogs.length}次读完，详细记录如下：\n`
      readingLogs.forEach((log, index) => {
        prompt += `${index + 1}. ${new Date(log.readDate).toLocaleDateString('zh-CN')}：第${log.startPage}-${log.endPage}页`
        if (log.minutes) {
          prompt += `，用时${log.minutes}分钟`
        }
        prompt += `\n`
      })
      prompt += `\n`

      // Child notes
      const notes = readingLogs.filter(log => log.note).map(log => log.note).join('\n')
      if (notes) {
        prompt += `孩子笔记："${notes}"\n\n`
      }
    }
  }

  // Analysis requirements
  prompt += `【请生成报告】\n`
  prompt += `请确保所有分析严格基于上方提供的【书籍信息】和【阅读数据】，不得使用通用模板。\n\n`
  prompt += `1. **内容提炼**：用孩子听得懂的话，提炼本书最特别的2个核心情节或道理。\n`
  prompt += `2. **行为画像**：根据上述数据，描述孩子的阅读习惯（如"你展现了很好的坚持力，尤其在周末读得更多"）。\n`
  prompt += `3. **亲子互动建议**：基于本书具体内容，设计2个可以问孩子的具体问题。\n`
  prompt += `4. **延伸推荐**：推荐1本在主题或难度上相关的书，并简单说明理由。\n\n`
  prompt += `请以JSON格式返回分析结果，包含以下字段：\n`
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
 * Call AI API using the configured service
 */
async function callAIAPI(prompt: string, familyId: number) {
  console.log('Sending prompt to AI API:', prompt);
  
  try {
    // Get the active AI configuration for the family
    const aiConfig = await prisma.userAIConfig.findFirst({
      where: { familyId, isActive: true },
      orderBy: { updatedAt: 'desc' }
    });

    if (aiConfig) {
      console.log('Using AI configuration:', aiConfig.provider);
      
      // Create AI service instance using factory
      const service = AIServiceFactory.createService({
        provider: aiConfig.provider,
        config: aiConfig.config
      });

      // Generate reading report
      return await service.generateReadingReport(prompt);
    } else {
      console.warn('No active AI configuration found, returning mock AI insight');
      // Fallback to mock response
      return getMockResponse(prompt);
    }
  } catch (error) {
    console.error('Error calling AI API:', error);
    // Fallback to mock response
    return getMockResponse(prompt);
  }
}

/**
 * Get mock AI response
 */
function getMockResponse(prompt: string) {
  // 从prompt中提取关键信息
  const bookName = prompt.match(/书名：《(.*?)》/)?.[1] || '这本书';
  const childName = prompt.match(/为(.*?)生成/)?.[1] || '孩子';
  const readingTime = prompt.match(/总用时：(\d+)分钟/)?.[1] || '0';
  const readingTimes = prompt.match(/阅读次数：(\d+)次/)?.[1] || '0';
  const readingPages = prompt.match(/阅读页数：(\d+)页/)?.[1] || '0';
  
  const mockResponse = {
    contentAnalysis: `《${bookName}》是一本适合${childName}阅读的书籍，通过生动的故事情节传递了积极向上的价值观。`,
    readingProgress: `${childName}在${readingTime}分钟内阅读了${readingPages}页，共阅读了${readingTimes}次，阅读进度良好。`,
    abilityDevelopment: `阅读《${bookName}》有助于培养${childName}的语言表达能力、想象力和情感认知能力。`,
    readingSuggestions: `建议家长与${childName}一起阅读《${bookName}》，鼓励分享书中的故事和感受，还可以进行相关的延伸活动。`,
    parentGuidance: `家长可以通过提问的方式帮助${childName}理解《${bookName}》中的道理，培养思考能力和表达能力。`
  };
  
  console.log('Generated mock AI response:', mockResponse);
  return mockResponse;
}
