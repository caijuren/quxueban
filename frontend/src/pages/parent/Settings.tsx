import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Bell,
  Trash2,
  AlertTriangle,
  Send,
  Save,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

// Schema
const settingsSchema = z.object({
  familyName: z.string().min(1, '请输入家庭名称').max(30, '名称不能超过30个字符'),
  dingtalkWebhook: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  dailyTimeLimit: z.number().min(60).max(480)
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// API functions
async function updateSettings(data: SettingsFormData): Promise<void> {
  await apiClient.put('/settings', data);
}

async function testWebhook(webhook: string): Promise<void> {
  await apiClient.post('/settings/test-webhook', { webhook });
}

async function deleteFamilyData(): Promise<void> {
  await apiClient.delete('/settings/family-data');
}

export default function SettingsPage() {
  const [dailyTimeLimit, setDailyTimeLimit] = useState(210);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { familyName: '我的家庭', dingtalkWebhook: '', dailyTimeLimit: 210 }
  });

  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => toast.success('设置已保存'),
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const testWebhookMutation = useMutation({
    mutationFn: testWebhook,
    onSuccess: () => toast.success('测试消息发送成功'),
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFamilyData,
    onSuccess: () => {
      toast.success('数据已删除');
      setDeleteConfirmOpen(false);
      setDeleteConfirmText('');
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const onSubmit = (data: SettingsFormData) => updateMutation.mutate({ ...data, dailyTimeLimit });

  const handleTestWebhook = () => {
    const webhook = watch('dingtalkWebhook');
    if (!webhook) { toast.error('请先输入钉钉Webhook地址'); return; }
    testWebhookMutation.mutate(webhook);
  };

  const handleDeleteData = () => {
    if (deleteConfirmText !== '删除') { toast.error('请输入"删除"确认'); return; }
    deleteMutation.mutate();
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="text-gray-500 mt-1">管理家庭设置和通知配置</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Family Settings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
            <CardHeader className="pb-4 pt-6 px-6">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <User className="size-5 text-white" />
                </div>
                <span className="font-bold text-gray-900">家庭设置</span>
              </CardTitle>
              <CardDescription className="text-gray-500 ml-[52px]">基本家庭信息配置</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="familyName" className="text-sm font-medium text-gray-700">家庭名称</Label>
                <Input id="familyName" {...register('familyName')} placeholder="例如：快乐学习之家" className="rounded-xl h-12 bg-gray-50 border-0" />
                {errors.familyName && <p className="text-red-500 text-xs">{errors.familyName.message}</p>}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dailyTimeLimit" className="text-sm font-medium text-gray-700">每日学习时长上限</Label>
                  <span className="text-lg font-bold text-gray-900">{formatTime(dailyTimeLimit)}</span>
                </div>
                <Slider
                  value={[dailyTimeLimit]}
                  onValueChange={([value]) => { setDailyTimeLimit(value); setValue('dailyTimeLimit', value); }}
                  min={60} max={480} step={15}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">建议：低年级1.5-2小时，高年级3-4小时</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
            <CardHeader className="pb-4 pt-6 px-6">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Bell className="size-5 text-white" />
                </div>
                <span className="font-bold text-gray-900">通知设置</span>
              </CardTitle>
              <CardDescription className="text-gray-500 ml-[52px]">配置钉钉通知推送</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">
                <div className="space-y-0.5">
                  <Label className="font-medium text-gray-900">启用通知</Label>
                  <p className="text-xs text-gray-500">开启后将推送学习进度通知到钉钉群</p>
                </div>
                <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-blue-500" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dingtalkWebhook" className="text-sm font-medium text-gray-700">钉钉群机器人 Webhook</Label>
                <div className="flex gap-2">
                  <Input id="dingtalkWebhook" {...register('dingtalkWebhook')} placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." className="flex-1 rounded-xl h-12 bg-gray-50 border-0" disabled={!notificationsEnabled} />
                  <Button type="button" variant="outline" onClick={handleTestWebhook} disabled={!notificationsEnabled || testWebhookMutation.isPending} className="rounded-xl h-12 px-5 shrink-0">
                    <Send className="size-4 mr-2" />测试
                  </Button>
                </div>
                {errors.dingtalkWebhook && <p className="text-red-500 text-xs">{errors.dingtalkWebhook.message}</p>}
                <p className="text-xs text-gray-400">在钉钉群设置中添加自定义机器人，获取Webhook地址</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Save Button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Button type="submit" disabled={updateMutation.isPending} className="w-full sm:w-auto h-12 px-8 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25">
            <Save className="size-4 mr-2" />
            {updateMutation.isPending ? '保存中...' : '保存设置'}
          </Button>
        </motion.div>
      </form>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-0 shadow-lg shadow-red-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="pb-4 pt-6 px-6">
            <CardTitle className="text-lg flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <AlertTriangle className="size-5 text-white" />
              </div>
              <span className="font-bold">危险区域</span>
            </CardTitle>
            <CardDescription className="text-gray-500 ml-[52px]">以下操作不可撤销，请谨慎操作</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-red-50 border border-red-100">
              <div>
                <h4 className="font-semibold text-gray-900">删除所有数据</h4>
                <p className="text-sm text-gray-500 mt-0.5">永久删除所有家庭成员、任务、计划和学习记录</p>
              </div>
              <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="shrink-0 rounded-xl h-11 bg-red-500 hover:bg-red-600">
                    <Trash2 className="size-4 mr-2" />删除数据
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl text-red-600">确认删除所有数据？</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-500">
                      此操作将永久删除所有数据，包括：
                      <ul className="list-disc list-inside mt-3 text-sm space-y-1">
                        <li>所有孩子账户和学习记录</li>
                        <li>所有任务和周计划</li>
                        <li>所有图书和阅读记录</li>
                        <li>所有成就和解锁记录</li>
                      </ul>
                      <p className="mt-3 font-medium text-red-600">此操作无法撤销！</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="my-4">
                    <Label htmlFor="confirmDelete">请输入"删除"确认</Label>
                    <Input id="confirmDelete" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="删除" className="mt-2 rounded-xl h-12 bg-gray-50 border-0" />
                  </div>
                  <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel onClick={() => setDeleteConfirmText('')} className="rounded-xl h-11">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteData} disabled={deleteMutation.isPending || deleteConfirmText !== '删除'} className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-11">
                      确认删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* App Info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/25">
                <span className="text-3xl">🐛</span>
              </div>
              <p className="font-bold text-gray-900 text-lg">小书虫学习助手</p>
              <p className="text-sm text-gray-400 mt-1">v1.0.0 · 帮助家长科学管理孩子的学习计划</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
