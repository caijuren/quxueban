import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Mail, Smartphone, Bell, MessageSquare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  taskReminders: boolean;
  planPublished: boolean;
  weeklySummary: boolean;
}

async function getNotificationSettings(): Promise<any> {
  const response = await apiClient.get('/settings/notifications');
  return response.data;
}

async function updateNotificationSettings(data: Partial<NotificationPreferences>): Promise<void> {
  await apiClient.put('/settings/notifications', data);
}

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationPreferences>({
    emailNotifications: false,
    pushNotifications: true,
    taskReminders: true,
    planPublished: true,
    weeklySummary: true,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: getNotificationSettings,
  });

  const updateMutation = useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => toast.success('通知设置已保存'),
    onError: (error) => toast.error(`保存失败：${getErrorMessage(error)}`),
  });

  useEffect(() => {
    if (settingsData?.data) {
      setSettings(prev => ({ ...prev, ...settingsData.data }));
    }
  }, [settingsData]);

  const handleUpdate = (key: keyof NotificationPreferences, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    updateMutation.mutate({ [key]: value });
  };

  const notificationItems = [
    {
      key: 'taskReminders' as const,
      label: '任务提醒',
      description: '孩子未完成任务时提醒',
      icon: MessageSquare,
    },
    {
      key: 'planPublished' as const,
      label: '计划发布',
      description: '新的学习计划发布时通知',
      icon: Bell,
    },
    {
      key: 'weeklySummary' as const,
      label: '每周总结',
      description: '每周学习报告推送',
      icon: MessageSquare,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-border/70 bg-gradient-to-br from-slate-50/70 via-white to-indigo-50/40 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-4">
            <Badge variant="secondary" className="rounded-full px-3 py-1">通知偏好</Badge>
            <h3 className="mt-3 text-base font-semibold text-slate-900">通知渠道与消息类型</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              统一管理接收通知的方式，以及任务、计划和周报相关提醒。
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      邮件通知
                    </Label>
                    <p className="text-xs text-muted-foreground">接收邮件形式的通知。</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => handleUpdate('emailNotifications', checked)}
                    disabled
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">邮件通知功能即将上线。</p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      推送通知
                    </Label>
                    <p className="text-xs text-muted-foreground">浏览器推送通知。</p>
                  </div>
                  <Switch
                    checked={settings.pushNotifications}
                    onCheckedChange={(checked) => handleUpdate('pushNotifications', checked)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {notificationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch
                      checked={settings[item.key]}
                      onCheckedChange={(checked) => handleUpdate(item.key, checked)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
