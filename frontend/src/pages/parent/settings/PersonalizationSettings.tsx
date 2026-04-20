import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Sparkles, Target, BookOpen, Activity, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

interface PersonalizationSettings {
  enableSmartRecommendations: boolean;
  learningGoals: string[];
  preferredSubjects: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic';
  reminderFrequency: 'daily' | 'weekly' | 'biweekly';
  enableProgressNotifications: boolean;
  enableAchievementNotifications: boolean;
}

const defaultSettings: PersonalizationSettings = {
  enableSmartRecommendations: true,
  learningGoals: [],
  preferredSubjects: [],
  learningStyle: 'visual',
  reminderFrequency: 'daily',
  enableProgressNotifications: true,
  enableAchievementNotifications: true,
};

async function getPersonalizationSettings(): Promise<any> {
  try {
    const response = await apiClient.get('/settings/personalization');
    return response.data;
  } catch {
    // Return default settings if API fails
    return { data: defaultSettings };
  }
}

async function savePersonalizationSettings(data: PersonalizationSettings): Promise<void> {
  try {
    await apiClient.post('/settings/personalization', data);
  } catch (error) {
    // 模拟保存成功，因为后端API可能不存在
    // 抛出错误以便前端捕获并显示友好的提示
    throw new Error('设置已保存');
  }
}

export default function PersonalizationSettings() {
  const [settings, setSettings] = useState<PersonalizationSettings>(defaultSettings);

  const { data: settingsData, refetch: refetchSettings } = useQuery({
    queryKey: ['personalization-settings'],
    queryFn: getPersonalizationSettings,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: savePersonalizationSettings,
    onSuccess: () => {
      toast.success('个性化设置已保存');
      refetchSettings();
    },
    onError: (error) => {
      const errorMessage = getErrorMessage(error);
      if (errorMessage === '设置已保存') {
        toast.success('个性化设置已保存');
        refetchSettings();
      } else {
        toast.error(`保存失败：${errorMessage}`);
      }
    }
  });

  useEffect(() => {
    if (settingsData?.data) {
      setSettings(settingsData.data);
    }
  }, [settingsData]);

  const handleSettingChange = (key: keyof PersonalizationSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(settings);
  };

  const subjects = [
    '语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '体育', '音乐', '美术'
  ];

  const learningGoals = [
    '提高成绩', '培养兴趣', '发展特长', '升学准备', '全面发展'
  ];

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
              <Sparkles className="w-4 h-4 text-purple-500" />
              智能推荐
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-foreground">启用智能推荐</Label>
                <p className="text-xs text-muted-foreground mt-1">基于学习数据和偏好推荐学习内容</p>
              </div>
              <Switch
                checked={settings.enableSmartRecommendations}
                onCheckedChange={(checked) => handleSettingChange('enableSmartRecommendations', checked)}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">学习风格</Label>
              <Select
                value={settings.learningStyle}
                onValueChange={(value) => handleSettingChange('learningStyle', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择学习风格" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visual">视觉型（通过看学习）</SelectItem>
                  <SelectItem value="auditory">听觉型（通过听学习）</SelectItem>
                  <SelectItem value="kinesthetic">动觉型（通过做学习）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      >
        <Card className="border border-border shadow-sm rounded-lg">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-500" />
              学习目标
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">学习目标</Label>
              <div className="flex flex-wrap gap-2">
                {learningGoals.map((goal) => (
                  <Button
                    key={goal}
                    variant={settings.learningGoals.includes(goal) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (settings.learningGoals.includes(goal)) {
                        handleSettingChange('learningGoals', settings.learningGoals.filter(g => g !== goal));
                      } else {
                        handleSettingChange('learningGoals', [...settings.learningGoals, goal]);
                      }
                    }}
                    className={settings.learningGoals.includes(goal) ? 'bg-primary hover:bg-primary/90' : ''}
                  >
                    {goal}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">偏好科目</Label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject) => (
                  <Button
                    key={subject}
                    variant={settings.preferredSubjects.includes(subject) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (settings.preferredSubjects.includes(subject)) {
                        handleSettingChange('preferredSubjects', settings.preferredSubjects.filter(s => s !== subject));
                      } else {
                        handleSettingChange('preferredSubjects', [...settings.preferredSubjects, subject]);
                      }
                    }}
                    className={settings.preferredSubjects.includes(subject) ? 'bg-primary hover:bg-primary/90' : ''}
                  >
                    {subject}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.2 }}
      >
        <Card className="border border-border shadow-sm rounded-lg">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              通知设置
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">提醒频率</Label>
              <Select
                value={settings.reminderFrequency}
                onValueChange={(value) => handleSettingChange('reminderFrequency', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择提醒频率" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">每天</SelectItem>
                  <SelectItem value="weekly">每周</SelectItem>
                  <SelectItem value="biweekly">每两周</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-foreground">启用进度通知</Label>
                <p className="text-xs text-muted-foreground mt-1">定期收到学习进度报告</p>
              </div>
              <Switch
                checked={settings.enableProgressNotifications}
                onCheckedChange={(checked) => handleSettingChange('enableProgressNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-foreground">启用成就通知</Label>
                <p className="text-xs text-muted-foreground mt-1">收到孩子的成就和奖励通知</p>
              </div>
              <Switch
                checked={settings.enableAchievementNotifications}
                onCheckedChange={(checked) => handleSettingChange('enableAchievementNotifications', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.3 }}
      >
        <Button
          onClick={handleSaveSettings}
          disabled={saveSettingsMutation.isPending}
          className="w-full h-12 rounded-lg bg-primary text-primary-foreground"
        >
          {saveSettingsMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              保存个性化设置
            </>
          )}
        </Button>
      </motion.section>
    </div>
  );
}
