import { AIService } from './AIService';
import { BaiduProvider } from './BaiduProvider';
import { KimiProvider } from './KimiProvider';

export interface AIConfig {
  provider: string;
  config: any;
}

export class AIServiceFactory {
  /**
   * 根据配置创建AI服务实例
   * @param config AI配置
   * @returns AI服务实例
   */
  static createService(config: AIConfig): AIService {
    switch (config.provider) {
      case 'baidu':
        return new BaiduProvider(config.config);
      case 'kimi':
        return new KimiProvider(config.config);
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  /**
   * 获取所有支持的AI提供商
   * @returns 支持的提供商列表
   */
  static getSupportedProviders(): Array<{ value: string; label: string }> {
    return [
      { value: 'baidu', label: '百度文心一言' },
      { value: 'kimi', label: 'Kimi' },
      { value: 'openai', label: 'OpenAI (GPT)' }
    ];
  }

  /**
   * 获取提供商的配置字段
   * @param provider 提供商名称
   * @returns 配置字段列表
   */
  static getProviderConfigFields(provider: string): Array<{ name: string; label: string; type: string; required: boolean }> {
    switch (provider) {
      case 'baidu':
        return [
          { name: 'accessToken', label: 'Access Token', type: 'password', required: true }
        ];
      case 'kimi':
        return [
          { name: 'apiKey', label: 'API Key', type: 'password', required: true }
        ];
      case 'openai':
        return [
          { name: 'apiKey', label: 'API Key', type: 'password', required: true }
        ];
      default:
        return [];
    }
  }
}
