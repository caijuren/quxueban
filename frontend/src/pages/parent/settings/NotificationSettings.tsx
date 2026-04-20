import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    updateMutation.mutate({ [key]: value });
  };

  const notificationItems = [
    {
      key: 'taskReminders' as const,
      label: '任务提醒',
      description: '孩子未完成任务时提醒',
    },
    {
      key: 'planPublished' as const,
      label: '计划发布',
      description: '新的学习计划发布时通知',
    },
    {
      key: 'weeklySummary' as const,
      label: '每周总结',
      description: '每周学习报告推送',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Channels */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">通知渠道</h4>
        <div className="space-y-4 max-w-md">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                邮件通知
              </Label>
              <p className="text-xs text-muted-foreground">接收邮件形式的通知</p>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => handleUpdate('emailNotifications', checked)}
              disabled
            />
          </div>
          <p className="text-xs text-muted-foreground">邮件通知功能即将上线</p>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                推送通知
              </Label>
              <p className="text-xs text-muted-foreground">浏览器推送通知</p>
            </div>
            <Switch
              checked={settings.pushNotifications}
              onCheckedChange={(checked) => handleUpdate('pushNotifications', checked)}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Notification Types */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">通知类型</h4>
        <div className="space-y-4 max-w-md">
          {notificationItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={settings[item.key]}
                onCheckedChange={(checked) => handleUpdate(item.key, checked)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
