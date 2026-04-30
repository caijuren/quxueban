import { BookMarked, CheckCircle2, FolderPlus, Tags, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { bookTypes, readStages } from '@/types/library';

interface BatchActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchFinish: () => void;
  onBatchDelete: () => void;
  onBatchTypeChange: (type: string) => void;
  onAddToList: (listId: string) => void;
  bookLists: Array<{ id: string; name: string }>;
  onCreateList: () => void;
  batchReadStage: string;
  onBatchReadStageChange: (stage: string) => void;
  isProcessing: boolean;
}

export function BatchActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBatchFinish,
  onBatchDelete,
  onBatchTypeChange,
  onAddToList,
  bookLists,
  onCreateList,
  batchReadStage,
  onBatchReadStageChange,
  isProcessing,
}: BatchActionBarProps) {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const disabled = selectedCount === 0 || isProcessing;

  return (
    <Card className="sticky top-3 z-10 rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">批量操作</p>
            <p className="mt-1 text-xs text-slate-500">统一处理当前筛选结果中的书籍，减少重复操作。</p>
          </div>
          <div className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            共 {totalCount} 本，已选 {selectedCount} 本
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold",
                selectedCount > 0 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              )}>
                {selectedCount}
              </div>
              <span className="text-sm font-medium text-slate-700">
                本书已选中
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="rounded-xl" onClick={onSelectAll}>
                {isAllSelected ? '取消全选' : '全选'}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl" onClick={onClearSelection}>
                清空
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              disabled={disabled}
              onValueChange={(value) => {
                if (value === '__new__') {
                  onCreateList();
                  return;
                }
                onAddToList(value);
              }}
            >
              <SelectTrigger className="h-10 w-[164px] rounded-lg bg-white">
                <FolderPlus className="mr-2 size-4 text-slate-400" />
                <SelectValue placeholder="添加到书单" />
              </SelectTrigger>
              <SelectContent align="end">
                {bookLists.map(list => (
                  <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                ))}
                <SelectItem value="__new__">创建新书单</SelectItem>
              </SelectContent>
            </Select>

            <Select disabled={disabled} onValueChange={onBatchTypeChange}>
              <SelectTrigger className="h-10 w-[148px] rounded-lg bg-white">
                <Tags className="mr-2 size-4 text-slate-400" />
                <SelectValue placeholder="修改分类" />
              </SelectTrigger>
              <SelectContent align="end">
                {bookTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={batchReadStage || undefined}
              disabled={isProcessing}
              onValueChange={onBatchReadStageChange}
            >
              <SelectTrigger className="h-10 w-[164px] rounded-lg bg-white">
                <BookMarked className="mr-2 size-4 text-slate-400" />
                <SelectValue placeholder="阅读阶段" />
              </SelectTrigger>
              <SelectContent align="end">
                {readStages.map(stage => (
                  <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={onBatchFinish}
              disabled={disabled}
              className="h-10 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              标记已读完
            </Button>

            <Button
              onClick={onBatchDelete}
              disabled={disabled}
              variant="destructive"
              className="h-10 rounded-lg"
            >
              <X className="w-4 h-4 mr-2" />
              删除
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
