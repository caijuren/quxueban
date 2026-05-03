import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DayPickerCalendar } from '@/components/ui/calendar';
import { Download, Image as ImageIcon, FileText, Calendar, Users, ChevronDown, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { format, startOfWeek, addWeeks, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface ChildOption {
  id: number;
  name: string;
  avatar: string;
}

export interface AdvancedExportConfig {
  range: 'current' | 'last' | 'custom';
  customStartDate?: Date;
  customEndDate?: Date;
  childId: number | null;
  format: 'png' | 'pdf';
  pngMode: 'viewport' | 'full';
}

interface AdvancedExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetRef: React.RefObject<HTMLElement | null>;
  children?: ChildOption[];
  title?: string;
  filenamePrefix?: string;
  currentWeekStart?: Date;
  onExport?: (config: AdvancedExportConfig) => Promise<void>;
}

export function AdvancedExportDialog({
  open,
  onOpenChange,
  targetRef,
  children: childOptions = [],
  title = '导出学习计划',
  filenamePrefix = '学习计划',
  currentWeekStart,
  onExport,
}: AdvancedExportDialogProps) {
  const [config, setConfig] = useState<AdvancedExportConfig>({
    range: 'current',
    childId: childOptions.length > 0 ? childOptions[0].id : null,
    format: 'png',
    pngMode: 'full',
  });
  const [isExporting, setIsExporting] = useState(false);

  const weekDates = useMemo(() => {
    const baseDate = currentWeekStart || new Date();
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(baseDate, i));
    }
    return dates;
  }, [currentWeekStart]);

  const getWeekLabel = (weekStart: Date) => {
    const weekEnd = addDays(weekStart, 6);
    return `${format(weekStart, 'M月d日')} - ${format(weekEnd, 'M月d日')}`;
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      if (onExport) {
        await onExport(config);
        onOpenChange(false);
        return;
      }

      if (config.format === 'png') {
        await exportToPNG();
      } else {
        await exportToPDF();
      }
      onOpenChange(false);
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
    wrapper.style.padding = '48px'; // 增加页边距
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
          if (node instanceof HTMLElement) {
            return !node.classList?.contains('no-export');
          }
          return true;
        },
      });

      const link = document.createElement('a');
      const dateStr = format(currentWeekStart || new Date(), 'yyyy-MM-dd');
      const childName = childOptions.find(c => c.id === config.childId)?.name || '';
      const childSuffix = childName ? `_${childName}` : '';
      link.download = `${filenamePrefix}_${dateStr}${childSuffix}_${config.pngMode}.png`;
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

  const exportToPDF = async () => {
    toast.info('PDF导出功能即将推出，敬请期待！');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto rounded-3xl border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Download className="w-5 h-5 text-purple-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            配置导出选项，生成专业的学习计划报告
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {childOptions.length > 1 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                选择孩子
              </Label>
              <div className="flex gap-2">
                {childOptions.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setConfig({ ...config, childId: child.id })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      config.childId === child.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              导出范围
            </Label>
            <RadioGroup
              value={config.range}
              onValueChange={(value) => setConfig({ ...config, range: value as 'current' | 'last' | 'custom' })}
              className="grid grid-cols-3 gap-3"
            >
              <div>
                <RadioGroupItem value="current" id="range-current" className="peer sr-only" />
                <Label
                  htmlFor="range-current"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-50 cursor-pointer transition-all h-full"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                      <FileSpreadsheet className="w-3 h-3 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium">本周</span>
                  </div>
                  <span className="text-xs text-gray-500 text-center w-full">
                    {currentWeekStart ? getWeekLabel(currentWeekStart) : ''}
                  </span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="last" id="range-last" className="peer sr-only" />
                <Label
                  htmlFor="range-last"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-50 cursor-pointer transition-all h-full"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                      <FileSpreadsheet className="w-3 h-3 text-gray-600" />
                    </div>
                    <span className="text-sm font-medium">上周</span>
                  </div>
                  <span className="text-xs text-gray-500 text-center w-full">
                    {currentWeekStart ? getWeekLabel(addWeeks(currentWeekStart, -1)) : ''}
                  </span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="custom" id="range-custom" className="peer sr-only" />
                <Label
                  htmlFor="range-custom"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-50 cursor-pointer transition-all h-full relative"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Calendar className="w-3 h-3 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium">自定义</span>
                  </div>
                  <span className="text-xs text-gray-500 text-center w-full">
                    {config.customStartDate && config.customEndDate
                      ? `${format(config.customStartDate, 'M月d日')} - ${format(config.customEndDate, 'M月d日')}`
                      : '选择日期'}
                  </span>
                  {config.range === 'custom' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 h-6 w-6 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 border-0 shadow-xl rounded-2xl" align="end">
                        <div className="p-3">
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-gray-500 mb-1 block">开始日期</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                  >
                                    {config.customStartDate ? format(config.customStartDate, 'yyyy-MM-dd') : '选择日期'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 border-0 shadow-xl rounded-2xl">
                                  <DayPickerCalendar
                                    mode="single"
                                    selected={config.customStartDate}
                                    onSelect={(date) => setConfig({ ...config, customStartDate: date })}
                                    locale={zhCN}
                                    className="p-3"
                                    classNames={{
                                      day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg",
                                      day_today: "bg-purple-100 text-purple-700 font-bold rounded-lg",
                                      nav_button: "h-8 w-8 rounded-lg hover:bg-gray-100",
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 mb-1 block">结束日期</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                  >
                                    {config.customEndDate ? format(config.customEndDate, 'yyyy-MM-dd') : '选择日期'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 border-0 shadow-xl rounded-2xl">
                                  <DayPickerCalendar
                                    mode="single"
                                    selected={config.customEndDate}
                                    onSelect={(date) => setConfig({ ...config, customEndDate: date })}
                                    locale={zhCN}
                                    className="p-3"
                                    classNames={{
                                      day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg",
                                      day_today: "bg-purple-100 text-purple-700 font-bold rounded-lg",
                                      nav_button: "h-8 w-8 rounded-lg hover:bg-gray-100",
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">导出格式</Label>
            <RadioGroup
              value={config.format}
              onValueChange={(value) => setConfig({ ...config, format: value as 'png' | 'pdf' })}
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

          {config.format === 'png' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">图片模式</Label>
              <RadioGroup
                value={config.pngMode}
                onValueChange={(value) => setConfig({ ...config, pngMode: value as 'viewport' | 'full' })}
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
            className="flex-1 rounded-xl h-11"
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
