import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bot, Send, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

async function getAIConfigs(): Promise<any> {
  const response = await apiClient.get('/ai-insights/user/ai-config');
  return response.data;
}

async function saveAIConfig(data: { provider: string; config: any; isActive: boolean }): Promise<void> {
  await apiClient.post('/ai-insights/user/ai-config', data);
}

async function testAIConnection(data: { provider: string; config: any }): Promise<any> {
  const response = await apiClient.post('/ai-insights/ai/test', data);
  return response.data;
}

export default function AISettings() {
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('baidu');
  const [aiConfigForm, setAiConfigForm] = useState<any>({
    accessToken: '',
    apiKey: ''
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: aiConfigsData, refetch: refetchAIConfigs } = useQuery({
    queryKey: ['ai-configs'],
    queryFn: getAIConfigs,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const saveAIConfigMutation = useMutation({
    mutationFn: saveAIConfig,
    onSuccess: () => {
      toast.success('AI配置已保存');
      refetchAIConfigs();
    },
    onError: (error) => {
      toast.error(`保存失败：${getErrorMessage(error)}`);
    }
  });

  const testAIConnectionMutation = useMutation({
    mutationFn: testAIConnection,
    onSuccess: (data) => {
      setTestResult({
        success: data.data.connected,
        message: data.data.message
      });
    },
    onError: (error) => {
      setTestResult({
        success: false,
        message: `测试失败：${getErrorMessage(error)}`
      });
    }
  });

  useEffect(() => {
    if (aiConfigsData?.data) {
      setAiConfigs(aiConfigsData.data);
      const activeConfig = aiConfigsData.data.find((config: any) => config.isActive);
      if (activeConfig) {
        setSelectedProvider(activeConfig.provider);
        setAiConfigForm(activeConfig.config || {
          accessToken: '',
          apiKey: ''
        });
      }
    }
  }, [aiConfigsData]);

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setAiConfigForm({
      accessToken: '',
      apiKey: ''
    });
    setTestResult(null);
    const existingConfig = aiConfigs.find((config: any) => config.provider === provider);
    if (existingConfig) {
      setAiConfigForm(existingConfig.config || {
        accessToken: '',
        apiKey: ''
      });
    }
  };

  const handleAIConfigChange = (field: string, value: string) => {
    setAiConfigForm((prev: any) => ({
      ...prev,
      [field]: value
    }));
    setTestResult(null);
  };

  const handleSaveAIConfig = () => {
    if (selectedProvider === 'baidu' && !aiConfigForm.accessToken) {
      toast.error('请输入Access Token');
      return;
    }
    if ((selectedProvider === 'kimi' || selectedProvider === 'openai') && !aiConfigForm.apiKey) {
      toast.error('请输入API Key');
      return;
    }
    saveAIConfigMutation.mutate({
      provider: selectedProvider,
      config: aiConfigForm,
      isActive: true
    });
  };

  const handleTestAIConnection = () => {
    if (selectedProvider === 'baidu' && !aiConfigForm.accessToken) {
      toast.error('请输入Access Token');
      return;
    }
    if ((selectedProvider === 'kimi' || selectedProvider === 'openai') && !aiConfigForm.apiKey) {
      toast.error('请输入API Key');
      return;
    }
    setTestResult(null);
    testAIConnectionMutation.mutate({
      provider: selectedProvider,
      config: aiConfigForm
    });
  };

  return (
    <div className="space-y-4">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="border border-border shadow-sm rounded-lg">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-500" />
              AI模型配置
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">AI服务提供商</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { value: 'baidu', label: '百度文心一言' },
                  { value: 'kimi', label: 'Kimi' },
                  { value: 'openai', label: 'OpenAI (GPT)' }
                ].map((provider) => (
                  <Button
                    key={provider.value}
                    variant={selectedProvider === provider.value ? "default" : "outline"}
                    onClick={() => handleProviderChange(provider.value)}
                    className={`h-10 ${selectedProvider === provider.value ? 'bg-primary hover:bg-primary/90' : ''}`}
                  >
                    {provider.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">配置信息</Label>
              
              {selectedProvider === 'baidu' && (
                <div className="space-y-2">
                  <Label htmlFor="baidu-access-token" className="text-xs text-muted-foreground">Access Token</Label>
                  <Input
                    id="baidu-access-token"
                    value={aiConfigForm.accessToken}
                    onChange={(e) => handleAIConfigChange('accessToken', e.target.value)}
                    placeholder="请输入百度文心一言的Access Token"
                    className="h-10 rounded-lg bg-muted/50 border-0"
                  />
                  <p className="text-xs text-muted-foreground">
                    如何获取Access Token：<a href="https://ai.baidu.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">百度AI开放平台</a>
                  </p>
                </div>
              )}

              {(selectedProvider === 'kimi' || selectedProvider === 'openai') && (
                <div className="space-y-2">
                  <Label htmlFor="api-key" className="text-xs text-muted-foreground">
                    {selectedProvider === 'kimi' ? 'Kimi API Key' : 'OpenAI API Key'}
                  </Label>
                  <Input
                    id="api-key"
                    value={aiConfigForm.apiKey}
                    onChange={(e) => handleAIConfigChange('apiKey', e.target.value)}
                    placeholder={`请输入${selectedProvider === 'kimi' ? 'Kimi' : 'OpenAI'}的API Key`}
                    className="h-10 rounded-lg bg-muted/50 border-0"
                  />
                  <p className="text-xs text-muted-foreground">
                    如何获取API Key：
                    {selectedProvider === 'kimi' ? (
                      <a href="https://www.moonshot.cn/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Moonshot Kimi</a>
                    ) : (
                      <a href="https://platform.openai.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenAI平台</a>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">连接测试</Label>
              <div className="flex gap-2">
                <Button
                  onClick={handleTestAIConnection}
                  disabled={testAIConnectionMutation.isPending}
                  variant="outline"
                  className="flex-1 h-10 rounded-lg"
                >
                  {testAIConnectionMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                      测试中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      测试连接
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSaveAIConfig}
                  disabled={saveAIConfigMutation.isPending}
                  className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground"
                >
                  {saveAIConfigMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      保存配置
                    </>
                  )}
                </Button>
              </div>
              {testResult && (
                <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {testResult.message}
                </div>
              )}
            </div>

            {aiConfigs.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label className="text-sm font-medium text-foreground">已保存的配置</Label>
                <div className="space-y-2">
                  {aiConfigs.map((config: any) => (
                    <div key={config.provider} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                      <div>
                        <p className="font-medium text-foreground">
                          {config.provider === 'baidu' ? '百度文心一言' : config.provider === 'kimi' ? 'Kimi' : 'OpenAI (GPT)'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          最后更新：{new Date(config.updatedAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <Badge variant={config.isActive ? "default" : "outline"} className={config.isActive ? 'bg-primary' : ''}>
                        {config.isActive ? '当前使用' : '已保存'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}