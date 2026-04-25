import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Home, Users, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

async function getFamilySettings(): Promise<any> {
  const response = await apiClient.get('/settings');
  return response.data;
}

async function updateFamilySettings(data: { familyName: string }): Promise<void> {
  await apiClient.put('/settings', data);
}

export default function FamilySettings() {
  const [familyName, setFamilyName] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: familyData } = useQuery({
    queryKey: ['family-settings'],
    queryFn: getFamilySettings,
  });

  const updateMutation = useMutation({
    mutationFn: updateFamilySettings,
    onSuccess: () => toast.success('家庭名称已更新'),
    onError: (error) => toast.error(`更新失败：${getErrorMessage(error)}`),
  });

  useEffect(() => {
    if (familyData?.data) {
      setFamilyName(familyData.data.familyName || '');
    }
  }, [familyData]);

  const handleCopyCode = () => {
    const code = familyData?.data?.familyCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('家庭码已复制');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const family = familyData?.data;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-slate-50/70 via-white to-indigo-50/40 shadow-sm">
        <CardContent className="p-6">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div>
                <Badge variant="secondary" className="rounded-full px-3 py-1">家庭信息</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">维护家庭名称与共享信息</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  家庭名称、家庭码和成员人数会贯穿任务、图书馆、阅读和报告等页面，建议保持清晰统一。
                </p>
              </div>

              <div className="space-y-2 max-w-lg">
                <Label className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  家庭名称
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="输入家庭名称"
                    className="h-11 rounded-xl"
                  />
                  <Button
                    onClick={() => updateMutation.mutate({ familyName })}
                    disabled={!familyName || familyName === family?.familyName || updateMutation.isPending}
                    className="rounded-xl shadow-sm"
                  >
                    {updateMutation.isPending ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">家庭码</span>
                  <Button variant="ghost" size="sm" onClick={handleCopyCode} className="rounded-lg">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <code className="mt-3 block text-2xl font-mono font-bold tracking-wider text-foreground">
                  {family?.familyCode || '------'}
                </code>
                <p className="mt-2 text-xs text-muted-foreground">
                  分享给家人后，可以通过家庭码加入当前家庭。
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>当前成员</span>
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">{family?.memberCount || 1} 人</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  家长与孩子都会计入当前家庭成员数。
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
