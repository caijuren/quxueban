import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookOpen, Clock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

interface LearningPreferences {
  dailyTimeLimit: number;
  enableBreakReminder: boolean;
  breakInterval: number;
  enableAchievementNotifications: boolean;
  enableWeeklyReport: boolean;
}

async function getLearningSettings(): Promise<any> {
  const response = await apiClient.get('/settings/learning');
  return response.data;
}

async function updateLearningSettings(data: Partial<LearningPreferences>): Promise<void> {
  await apiClient.put('/settings/learning', data);
}

export default function LearningSettings() {
  const [settings, setSettings] = useState<LearningPreferences>({
    dailyTimeLimit: 120,
    enableBreakReminder: true,
    breakInterval: 30,
    enableAchievementNotifications: true,
    enableWeeklyReport: true,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['learning-settings'],
    queryFn: getLearningSettings,
  });

  const updateMutation = useMutation({
    mutationFn: updateLearningSettings,
    onSuccess: () => toast.success('设置已保存'),
    onError: (error) => toast.error(`保存失败：${getErrorMessage(error)}`),
  });

  useEffect(() => {
    if (settingsData?.data) {
      setSettings(prev => ({ ...prev, ...settingsData.data }));
    }
  }, [settingsData]);

  const handleUpdate = (key: keyof LearningPreferences, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    updateMutation.mutate({ [key]: value });
  };

  return (
    <div className="space-y-8">
      {/* Time Settings */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">时间管理</h4>
        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              每日学习时长上限（分钟）
            </Label>
            <Input
              type="number"
              value={settings.dailyTimeLimit}
              onChange={(e) => handleUpdate('dailyTimeLimit', parseInt(e.target.value) || 0)}
              min={30}
              max={300}
            />
            <p className="text-xs text-muted-foreground">达到上限后将提醒休息</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>休息提醒</Label>
              <p className="text-xs text-muted-foreground">学习一段时间后提醒休息</p>
            </div>
            <Switch
              checked={settings.enableBreakReminder}
              onCheckedChange={(checked) => handleUpdate('enableBreakReminder', checked)}
            />
          </div>

          {settings.enableBreakReminder && (
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              <Label>提醒间隔（分钟）</Label>
              <Input
                type="number"
                value={settings.breakInterval}
                onChange={(e) => handleUpdate('breakInterval', parseInt(e.target.value) || 0)}
                min={15}
                max={120}
              />
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* Notifications */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">通知偏好</h4>
        <div className="space-y-4 max-w-md">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                成就通知
              </Label>
              <p className="text-xs text-muted-foreground">孩子获得成就时通知家长</p>
            </div>
            <Switch
              checked={settings.enableAchievementNotifications}
              onCheckedChange={(checked) => handleUpdate('enableAchievementNotifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                周报推送
              </Label>
              <p className="text-xs text-muted-foreground">每周发送学习总结报告</p>
            </div>
            <Switch
              checked={settings.enableWeeklyReport}
              onCheckedChange={(checked) => handleUpdate('enableWeeklyReport', checked)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
