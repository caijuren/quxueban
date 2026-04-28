import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

  return (
    <Card className="sticky top-3 z-10 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-white to-sky-50 shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">批量操作</p>
            <p className="text-xs text-muted-foreground">统一处理当前筛选结果中的书籍，减少重复操作。</p>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-xs text-muted-foreground shadow-sm">
            共 {totalCount} 本，已选 {selectedCount} 本
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                selectedCount > 0 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              )}>
                {selectedCount}
              </div>
              <span className="text-sm text-gray-700">
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Add to List */}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value === 'new') {
                  onCreateList();
                } else if (e.target.value) {
                  onAddToList(e.target.value);
                }
              }}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm transition-colors hover:border-primary"
              disabled={selectedCount === 0 || isProcessing}
            >
              <option value="">添加到书单...</option>
              {bookLists.map(list => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
              <option value="new">+ 创建新书单</option>
            </select>

            {/* Change Type */}
            <select
              value=""
              onChange={(e) => e.target.value && onBatchTypeChange(e.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm transition-colors hover:border-primary"
              disabled={selectedCount === 0 || isProcessing}
            >
              <option value="">修改分类...</option>
              {bookTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            {/* Read Stage */}
            <select
              value={batchReadStage}
              onChange={(e) => onBatchReadStageChange(e.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm transition-colors hover:border-primary"
              disabled={isProcessing}
            >
              <option value="">选择阅读阶段...</option>
              {readStages.map(stage => (
                <option key={stage.value} value={stage.value}>{stage.label}</option>
              ))}
            </select>

            <Button
              onClick={onBatchFinish}
              disabled={selectedCount === 0 || isProcessing}
              className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              标记已读完
            </Button>

            <Button
              onClick={onBatchDelete}
              disabled={selectedCount === 0 || isProcessing}
              variant="destructive"
              className="rounded-xl"
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
