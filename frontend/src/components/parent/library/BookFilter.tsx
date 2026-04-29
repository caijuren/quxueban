import { useState } from 'react';
import { Search, X, Upload, ChevronDown, Plus, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ReadStatus } from '@/types/library';
import { bookTypes, readStatusOptions, sortOptions } from '@/types/library';

interface BookFilterProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  selectedReadStatus: ReadStatus;
  onReadStatusChange: (value: ReadStatus) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  onImportClick: () => void;
  onAddClick?: () => void;
  onExportClick?: () => void;
  onTemplateClick?: () => void;
  exporting?: boolean;
  importing: boolean;
  importProgress: number;
  resultCount: number;
  resultLabel?: string;
}

export function BookFilter({
  searchInput,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedReadStatus,
  onReadStatusChange,
  sortBy,
  onSortChange,
  onImportClick,
  onAddClick,
  onExportClick,
  onTemplateClick,
  exporting = false,
  importing,
  importProgress,
  resultCount,
  resultLabel = '当前结果',
}: BookFilterProps) {
  const hasActiveFilters =
    selectedType !== 'all' || selectedReadStatus !== 'all' || sortBy !== '' || !!searchInput;

  const clearAllFilters = () => {
    onReadStatusChange('all');
    onTypeChange('all');
    onSortChange('');
    onSearchChange('');
  };

  // Get current selected labels
  const selectedTypeLabel = selectedType === 'all' 
    ? '全部类型' 
    : bookTypes.find(t => t.value === selectedType)?.label || '全部类型';
  
  const selectedStatusLabel = selectedReadStatus === 'all'
    ? '全部状态'
    : readStatusOptions.find(s => s.value === selectedReadStatus)?.label || '全部状态';

  const selectedSortLabel = sortBy === ''
    ? '默认排序'
    : sortOptions.find(s => s.value === sortBy)?.label || '默认排序';

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索书名、作者..."
              className="h-10 w-52 rounded-lg border-border bg-white pl-8 pr-7 text-sm focus:border-primary focus:ring-primary"
            />
            {searchInput && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {readStatusOptions.map((status) => (
            <button
              key={status.value}
              onClick={() => onReadStatusChange(status.value as ReadStatus)}
              className={cn(
                'shrink-0 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg',
                selectedReadStatus === status.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              {status.label}
            </button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 transition-all duration-200",
              "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20",
              "bg-white border border-border shadow-sm",
              selectedType !== 'all' && "border-primary/50 bg-primary/5"
            )}>
              <span className="text-sm font-medium text-gray-700">{selectedTypeLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <div className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                选择图书类型
              </div>
              <DropdownMenuItem
                onClick={() => onTypeChange('all')}
                className={cn(
                  "flex items-center justify-between px-2.5 py-2 cursor-pointer",
                  selectedType === 'all' && "bg-primary/5"
                )}
              >
                <span className={cn(
                  "text-sm",
                  selectedType === 'all' ? "font-medium text-gray-900" : "text-gray-700"
                )}>全部类型</span>
                {selectedType === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </DropdownMenuItem>
              {bookTypes.map((type) => (
                <DropdownMenuItem
                  key={type.value}
                  onClick={() => onTypeChange(type.value)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-2 cursor-pointer",
                    selectedType === type.value && "bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "text-sm",
                    selectedType === type.value ? "font-medium text-gray-900" : "text-gray-700"
                  )}>{type.label}</span>
                  {selectedType === type.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 transition-all duration-200",
              "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20",
              "bg-white border border-border shadow-sm",
              sortBy !== '' && "border-primary/50 bg-primary/5"
            )}>
              <span className="text-sm font-medium text-gray-700">{selectedSortLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <div className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                选择排序方式
              </div>
              {sortOptions.map((sort) => (
                <DropdownMenuItem
                  key={sort.value}
                  onClick={() => onSortChange(sort.value)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-2 cursor-pointer",
                    sortBy === sort.value && "bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "text-sm",
                    sortBy === sort.value ? "font-medium text-gray-900" : "text-gray-700"
                  )}>{sort.label}</span>
                  {sortBy === sort.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex gap-2">
          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <span>{resultLabel}</span>
            <span className="rounded-lg bg-muted px-3 py-2 font-medium text-primary">{resultCount} 本</span>
          </div>

          <Button
            variant="outline"
            onClick={onImportClick}
            disabled={importing}
            className="relative h-10 rounded-lg border-border hover:bg-muted min-w-20"
          >
            <Upload className="w-4 h-4 mr-1.5 text-primary" />
            <span className="text-sm">导入</span>
            {importing && (
              <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-primary/20 rounded-b-lg">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-b-lg"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            )}
          </Button>

          {onTemplateClick && (
            <Button
              variant="outline"
              onClick={onTemplateClick}
              className="h-10 rounded-lg border-border hover:bg-muted min-w-20"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-primary" />
              <span className="text-sm">模板</span>
            </Button>
          )}

          {onAddClick && (
            <Button
              onClick={onAddClick}
              className="h-10 rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm min-w-20"
            >
              <Plus className="size-4 mr-1.5" />
              <span className="text-sm">添加图书</span>
            </Button>
          )}

          {onExportClick && (
            <Button
              variant="outline"
              onClick={onExportClick}
              disabled={exporting}
              className="h-10 rounded-lg border-border hover:bg-muted min-w-20"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-primary" />
              ) : (
                <Download className="w-4 h-4 mr-1.5 text-primary" />
              )}
              <span className="text-sm">{exporting ? '导出中' : '导出'}</span>
            </Button>
          )}

        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {searchInput && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs text-primary">
              搜索: {searchInput}
              <button onClick={() => onSearchChange('')} className="rounded-full p-0.5 hover:bg-primary/20">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedType !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs text-primary">
              {selectedTypeLabel}
              <button onClick={() => onTypeChange('all')} className="rounded-full p-0.5 hover:bg-primary/20">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedReadStatus !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs text-primary">
              {readStatusOptions.find(s => s.value === selectedReadStatus)?.label}
              <button onClick={() => onReadStatusChange('all')} className="rounded-full p-0.5 hover:bg-primary/20">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {sortBy && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs text-primary">
              {sortOptions.find(s => s.value === sortBy)?.label}
              <button onClick={() => onSortChange('')} className="rounded-full p-0.5 hover:bg-primary/20">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={clearAllFilters}
            className="ml-auto text-xs font-medium text-primary hover:underline"
          >
            清除全部
          </button>
        </div>
      )}
    </div>
  );
}
