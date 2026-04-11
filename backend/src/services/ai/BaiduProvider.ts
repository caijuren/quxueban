import axios from 'axios';
import { AIService } from './AIService';

interface BaiduConfig {
  accessToken: string;
}

export class BaiduProvider implements AIService {
  private config: BaiduConfig;

  constructor(config: BaiduConfig) {
    this.config = config;
  }

  async generateReadingReport(prompt: string): Promise<any> {
    const API_URL = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${this.config.accessToken}`;

    try {
      const response = await axios.post(API_URL, {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'ERNIE-4.0-8K' // 指定模型
      });

      console.log('Baidu AI API response:', response.data);

      // 文心一言返回格式需解析
      const aiResponseText = response.data.result;
      console.log('Baidu AI response text:', aiResponseText);

      // 尝试将返回的文本解析为JSON对象
      try {
        return JSON.parse(aiResponseText);
      } catch (e) {
        console.error('Baidu AI返回结果非JSON格式:', aiResponseText);
        // 降级：返回模拟数据
        return this.getMockResponse(prompt);
      }
    } catch (error) {
      console.error('Error calling Baidu AI API:', error);
      // 降级：返回模拟数据
      return this.getMockResponse(prompt);
    }
  }

  async testConnection(): Promise<boolean> {
    const API_URL = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${this.config.accessToken}`;

    try {
      const response = await axios.post(API_URL, {
        messages: [
          {
            role: 'user',
            content: '测试连接'
          }
        ],
        model: 'ERNIE-4.0-8K'
      });
      return response.status === 200;
    } catch (error) {
      console.error('Baidu AI connection test failed:', error);
      return false;
    }
  }

  getProviderName(): string {
    return 'baidu';
  }

  private getMockResponse(prompt: string) {
    // 从prompt中提取关键信息
    const bookName = prompt.match(/书名：《(.*?)》/)?.[1] || '这本书';
    const childName = prompt.match(/为(.*?)生成/)?.[1] || '孩子';
    const readingTime = prompt.match(/总用时：(\d+)分钟/)?.[1] || '0';
    const readingTimes = prompt.match(/阅读次数：(\d+)次/)?.[1] || '0';
    const readingPages = prompt.match(/阅读页数：(\d+)页/)?.[1] || '0';

    return {
      contentAnalysis: `《${bookName}》是一本适合${childName}阅读的书籍，通过生动的故事情节传递了积极向上的价值观。`,
      readingProgress: `${childName}在${readingTime}分钟内阅读了${readingPages}页，共阅读了${readingTimes}次，阅读进度良好。`,
      abilityDevelopment: `阅读《${bookName}》有助于培养${childName}的语言表达能力、想象力和情感认知能力。`,
      readingSuggestions: `建议家长与${childName}一起阅读《${bookName}》，鼓励分享书中的故事和感受，还可以进行相关的延伸活动。`,
      parentGuidance: `家长可以通过提问的方式帮助${childName}理解《${bookName}》中的道理，培养思考能力和表达能力。`
    };
  }
}
