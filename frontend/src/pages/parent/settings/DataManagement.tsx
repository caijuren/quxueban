import { useState } from 'react';
import { Download, Upload, Trash2, FileJson, Database, Clock3, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function DataManagement() {
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await apiClient.get('/settings/export');
      const exportData = response.data.data;

      // Create a blob with the data
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and click it
      const link = document.createElement('a');
      link.href = url;
      link.download = `quxueban_backup_${exportData.family.name}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(url);

      toast.success('数据导出成功');
    } catch (error) {
      toast.error(`导出失败：${getErrorMessage(error)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await apiClient.delete('/settings/family-data');
      toast.success('数据已清理');
      setIsClearDialogOpen(false);
      // Refresh the page to reflect changes
      window.location.reload();
    } catch (error) {
      toast.error(`清理失败：${getErrorMessage(error)}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Export */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">数据导出</h4>
        <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h5 className="font-medium">导出所有数据</h5>
            <p className="text-sm text-muted-foreground mt-1">
              下载包含所有家庭数据、任务记录、学习进度的 JSON 文件
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                variant="outline"
                size="sm"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                    导出中...
                  </>
                ) : (
                  <>
                    <FileJson className="w-4 h-4 mr-2" />
                    导出数据
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Import */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">数据导入</h4>
        <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h5 className="font-medium">从备份恢复</h5>
            <p className="text-sm text-muted-foreground mt-1">
              上传之前导出的 JSON 文件恢复数据
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button disabled variant="outline" size="sm">
                <Database className="w-4 h-4 mr-2" />
                选择文件
              </Button>
              <Badge variant="secondary">即将上线</Badge>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Clear Data */}
      <section className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">数据清理</h4>
        <div className="flex items-start gap-4 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h5 className="font-medium text-destructive">清理学习记录</h5>
            <p className="text-sm text-muted-foreground mt-1">
              删除所有历史学习记录和统计数据，此操作不可撤销
            </p>
            <Button
              onClick={() => setIsClearDialogOpen(true)}
              variant="outline"
              size="sm"
              className="mt-3 border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              清理数据
            </Button>
          </div>
        </div>
      </section>

      {/* Clear Dialog */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              确认清理数据？
            </AlertDialogTitle>
            <AlertDialogDescription>
              这将删除所有学习记录、任务完成历史和统计数据。账户信息和设置将保留。
              <br /><br />
              <span className="text-destructive font-medium">此操作不可撤销！</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              disabled={isClearing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isClearing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  清理中...
                </>
              ) : (
                '确认清理'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
