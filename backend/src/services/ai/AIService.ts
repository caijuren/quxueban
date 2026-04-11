export interface AIService {
  /**
   * 生成阅读报告
   * @param prompt 提示词
   * @returns 生成的报告内容
   */
  generateReadingReport(prompt: string): Promise<any>;

  /**
   * 测试连接
   * @returns 是否连接成功
   */
  testConnection(): Promise<boolean>;

  /**
   * 获取提供商名称
   * @returns 提供商名称
   */
  getProviderName(): string;
}
