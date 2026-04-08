import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';

export interface ExportConfig {
  range: 'current' | 'week' | 'all';
  format: 'png' | 'pdf';
  viewMode: 'viewport' | 'full';
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetRef: React.RefObject<HTMLElement | null>;
  title?: string;
  filename?: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  targetRef,
  title = '导出任务',
  filename = '任务列表',
}: ExportDialogProps) {
  const [config, setConfig] = useState<ExportConfig>({
    range: 'current',
    format: 'png',
    viewMode: 'viewport',
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!targetRef.current) {
      toast.error('未找到导出内容');
      return;
    }

    setIsExporting(true);

    try {
      if (config.format === 'png') {
        await exportToPNG();
        onOpenChange(false);
      } else {
        toast.info('PDF导出功能开发中，请先使用PNG导出');
      }
    } catch (error) {
      console.error('导出失败:', error);
      toast.error(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPNG = async () => {
    const element = targetRef.current;
    if (!element) {
      throw new Error('未找到导出元素');
    }

    const loadingToastId = toast.loading('正在生成高清图片...');

    // 创建带边距的包装容器
    const wrapper = document.createElement('div');
    wrapper.style.padding = '48px'; // 增加页边距（原来是0，现在48px = 3rem）
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.style.display = 'inline-block';
    
    // 克隆原元素
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.margin = '0';
    clone.style.boxShadow = 'none'; // 移除阴影避免边距问题
    
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      const dataUrl = await toPng(wrapper, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        skipFonts: false,
        filter: (node: Node) => {
          // 过滤掉不需要的节点
          if (node instanceof HTMLElement) {
            return !node.classList?.contains('no-export');
          }
          return true;
        },
      });

      const link = document.createElement('a');
      link.download = `${filename}_${getFormattedDate()}_${config.viewMode}.png`;
      link.href = dataUrl;
      link.click();

      toast.dismiss(loadingToastId);
      toast.success('图片导出成功！');
    } catch (error) {
      toast.dismiss(loadingToastId);
      throw error;
    } finally {
      // 清理临时元素
      document.body.removeChild(wrapper);
    }
  };

  const getFormattedDate = () => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Download className="w-5 h-5 text-purple-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            选择导出范围和格式
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 导出范围 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">导出范围</Label>
            <RadioGroup
              value={config.range}
              onValueChange={(value) => setConfig({ ...config, range: value as ExportConfig['range'] })}
              className="grid grid-cols-3 gap-2"
            >
              <div>
                <RadioGroupItem value="current" id="range-current" className="peer sr-only" />
                <Label
                  htmlFor="range-current"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-50 cursor-pointer transition-all"
                >
                  <span className="text-sm font-medium">当前视图</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="week" id="range-week" className="peer sr-only" />
                <Label
                  htmlFor="range-week"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-50 cursor-pointer transition-all"
                >
                  <span className="text-sm font-medium">本周</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="all" id="range-all" className="peer sr-only" />
                <Label
                  htmlFor="range-all"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-50 cursor-pointer transition-all"
                >
                  <span className="text-sm font-medium">全部</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 导出格式 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">导出格式</Label>
            <RadioGroup
              value={config.format}
              onValueChange={(value) => setConfig({ ...config, format: value as ExportConfig['format'] })}
              className="grid grid-cols-2 gap-3"
            >
              <div>
                <RadioGroupItem value="png" id="format-png" className="peer sr-only" />
                <Label
                  htmlFor="format-png"
                  className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-50 cursor-pointer transition-all"
                >
                  <ImageIcon className="w-5 h-5 text-purple-500" />
                  <div>
                    <span className="text-sm font-medium block">PNG 图片</span>
                    <span className="text-xs text-gray-500">3倍高清、适合分享</span>
                  </div>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="pdf" id="format-pdf" className="peer sr-only" disabled />
                <Label
                  htmlFor="format-pdf"
                  className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 p-4 opacity-60 cursor-not-allowed"
                >
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="text-sm font-medium block text-gray-400">PDF 文档</span>
                    <span className="text-xs text-gray-400">即将推出</span>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 视图模式（仅PNG） */}
          {config.format === 'png' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">图片模式</Label>
              <RadioGroup
                value={config.viewMode}
                onValueChange={(value) => setConfig({ ...config, viewMode: value as ExportConfig['viewMode'] })}
                className="grid grid-cols-2 gap-2"
              >
                <div>
                  <RadioGroupItem value="viewport" id="view-viewport" className="peer sr-only" />
                  <Label
                    htmlFor="view-viewport"
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-50 cursor-pointer transition-all"
                  >
                    <span className="text-sm font-medium">当前视图</span>
                    <span className="text-xs text-gray-500">仅可见区域</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="full" id="view-full" className="peer sr-only" />
                  <Label
                    htmlFor="view-full"
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-50 cursor-pointer transition-all"
                  >
                    <span className="text-sm font-medium">完整长图</span>
                    <span className="text-xs text-gray-500">包含所有内容</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl h-11"
            disabled={isExporting}
          >
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 rounded-xl h-11 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                导出
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
