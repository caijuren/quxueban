import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Home, Users, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
    <div className="space-y-8">
      {/* Family Name */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">家庭信息</h4>
        <div className="grid gap-4 max-w-md">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              家庭名称
            </Label>
            <div className="flex gap-2">
              <Input
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="输入家庭名称"
              />
              <Button
                onClick={() => updateMutation.mutate({ familyName })}
                disabled={!familyName || familyName === family?.familyName || updateMutation.isPending}
              >
                {updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Family Code */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">家庭码</h4>
        <div className="bg-muted rounded-lg p-4 max-w-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">邀请成员加入</span>
            <Button variant="ghost" size="sm" onClick={handleCopyCode}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <code className="text-2xl font-mono font-bold tracking-wider">
            {family?.familyCode || '------'}
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            将家庭码分享给家人，他们可以通过此码加入家庭
          </p>
        </div>
      </section>

      <Separator />

      {/* Members Count */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">家庭成员</h4>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span>当前成员：</span>
          </div>
          <span className="font-medium">{family?.memberCount || 1} 人</span>
        </div>
      </section>
    </div>
  );
}
