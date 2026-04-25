import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookOpen, Clock, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    const next = { ...settings, [key]: value };
    setSettings(next);
    updateMutation.mutate({ [key]: value });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-border/70 bg-gradient-to-br from-slate-50/70 via-white to-indigo-50/40 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-4">
            <Badge variant="secondary" className="rounded-full px-3 py-1">学习设置</Badge>
            <h3 className="mt-3 text-base font-semibold text-slate-900">学习时间与提醒策略</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              控制每日学习时长、休息提醒和周报推送，让学习节奏更稳定。
            </p>
          </div>

          <div className="max-w-md space-y-4">
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
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">达到上限后将提醒休息。</p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>休息提醒</Label>
                  <p className="text-xs text-muted-foreground">学习一段时间后提醒休息。</p>
                </div>
                <Switch
                  checked={settings.enableBreakReminder}
                  onCheckedChange={(checked) => handleUpdate('enableBreakReminder', checked)}
                />
              </div>

              {settings.enableBreakReminder && (
                <div className="mt-4 space-y-2 rounded-xl bg-slate-50/80 p-3">
                  <Label>提醒间隔（分钟）</Label>
                  <Input
                    type="number"
                    value={settings.breakInterval}
                    onChange={(e) => handleUpdate('breakInterval', parseInt(e.target.value) || 0)}
                    min={15}
                    max={120}
                    className="h-10 rounded-xl"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border/70 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">学习提醒</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              决定学习过程中哪些提醒需要保留，避免无效通知干扰。
            </p>
          </div>

          <div className="max-w-md space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  成就通知
                </Label>
                <p className="text-xs text-muted-foreground">孩子获得成就时通知家长。</p>
              </div>
              <Switch
                checked={settings.enableAchievementNotifications}
                onCheckedChange={(checked) => handleUpdate('enableAchievementNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  周报推送
                </Label>
                <p className="text-xs text-muted-foreground">每周发送学习总结报告。</p>
              </div>
              <Switch
                checked={settings.enableWeeklyReport}
                onCheckedChange={(checked) => handleUpdate('enableWeeklyReport', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
