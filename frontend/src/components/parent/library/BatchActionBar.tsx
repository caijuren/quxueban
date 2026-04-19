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
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-blue-50 rounded-lg shadow-sm">
      <CardContent className="p-4">
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
                本书已选择
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onSelectAll}>
                {isAllSelected ? '取消全选' : '全选'}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClearSelection}>
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
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white hover:border-primary transition-colors"
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
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white hover:border-primary transition-colors"
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
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white hover:border-primary transition-colors"
              disabled={isProcessing}
            >
              <option value="">选择阅读阶段...</option>
              {readStages.map(stage => (
                <option key={stage.value} value={stage.value}>{stage.label}</option>
              ))}
            </select>

            <Button
              onClick={onBatchFinish}
              disabled={selectedCount === 0 && !batchReadStage || isProcessing}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              标记已读完
            </Button>

            <Button
              onClick={onBatchDelete}
              disabled={selectedCount === 0 || isProcessing}
              variant="destructive"
              className="rounded-lg"
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
