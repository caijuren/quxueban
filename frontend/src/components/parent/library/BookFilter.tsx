import { useState } from 'react';
import { Search, X, LayoutGrid, List, Plus, Upload, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ReadStatus, ViewMode } from '@/types/library';
import { bookTypes, readStatusOptions, sortOptions, ageRanges } from '@/types/library';

interface BookFilterProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  selectedReadStatus: ReadStatus;
  onReadStatusChange: (value: ReadStatus) => void;
  selectedAgeRange: string;
  onAgeRangeChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  batchMode: boolean;
  onBatchModeToggle: () => void;
  onImportClick: () => void;
  onAddBookClick: () => void;
  importing: boolean;
  importProgress: number;
  resultCount: number;
}

export function BookFilter({
  searchInput,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedReadStatus,
  onReadStatusChange,
  selectedAgeRange,
  onAgeRangeChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  batchMode,
  onBatchModeToggle,
  onImportClick,
  onAddBookClick,
  importing,
  importProgress,
  resultCount,
}: BookFilterProps) {
  const hasActiveFilters = selectedReadStatus !== 'all' || selectedAgeRange !== 'all' || sortBy !== '';

  const clearAllFilters = () => {
    onReadStatusChange('all');
    onAgeRangeChange('all');
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
  
  const selectedAgeLabel = selectedAgeRange === 'all'
    ? '全部年龄'
    : ageRanges.find(a => a.value === selectedAgeRange)?.label || '全部年龄';
  
  const selectedSortLabel = sortBy === ''
    ? '默认排序'
    : sortOptions.find(s => s.value === sortBy)?.label || '默认排序';

  return (
    <div className="space-y-3">
      {/* Filter Bar - All in one row */}
      <div className="bg-muted/50 border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input - Compact */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索书名、作者..."
              className="pl-8 pr-7 h-9 w-44 text-sm rounded-lg border-gray-200 bg-white focus:border-primary focus:ring-primary"
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

          <div className="w-px h-6 bg-border hidden sm:block" />

          {/* Book Type Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200",
              "hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20",
              "bg-white border border-gray-200 shadow-sm",
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

          {/* Read Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200",
              "hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20",
              "bg-white border border-gray-200 shadow-sm",
              selectedReadStatus !== 'all' && "border-primary/50 bg-primary/5"
            )}>
              <span className="text-sm font-medium text-gray-700">{selectedStatusLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <div className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                选择阅读状态
              </div>
              {readStatusOptions.map((status) => (
                <DropdownMenuItem
                  key={status.value}
                  onClick={() => onReadStatusChange(status.value as ReadStatus)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-2 cursor-pointer",
                    selectedReadStatus === status.value && "bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "text-sm",
                    selectedReadStatus === status.value ? "font-medium text-gray-900" : "text-gray-700"
                  )}>{status.label}</span>
                  {selectedReadStatus === status.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Age Range Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200",
              "hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20",
              "bg-white border border-gray-200 shadow-sm",
              selectedAgeRange !== 'all' && "border-primary/50 bg-primary/5"
            )}>
              <span className="text-sm font-medium text-gray-700">{selectedAgeLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <div className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                选择适读年龄
              </div>
              {ageRanges.map((age) => (
                <DropdownMenuItem
                  key={age.value}
                  onClick={() => onAgeRangeChange(age.value)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-2 cursor-pointer",
                    selectedAgeRange === age.value && "bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "text-sm",
                    selectedAgeRange === age.value ? "font-medium text-gray-900" : "text-gray-700"
                  )}>{age.label}</span>
                  {selectedAgeRange === age.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200",
              "hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20",
              "bg-white border border-gray-200 shadow-sm",
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

          <div className="flex-1" />

          {/* View Mode Toggle */}
          <div className="flex gap-0.5 flex-shrink-0 bg-white rounded-lg p-0.5 border border-gray-200 shadow-sm">
            <button
              onClick={() => onViewModeChange('grid')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                viewMode === 'grid'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              )}
              title="网格视图"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                viewMode === 'list'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              )}
              title="列表视图"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1.5 flex-shrink-0">
            <Button
              variant="outline"
              onClick={onBatchModeToggle}
              className={cn(
                "h-9 px-2.5 rounded-lg border-gray-200 shadow-sm",
                batchMode && "bg-primary/10 border-primary text-primary"
              )}
            >
              {batchMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </Button>

            <Button
              variant="outline"
              onClick={onImportClick}
              disabled={importing}
              className="h-9 px-2.5 rounded-lg border-gray-200 shadow-sm relative"
            >
              <Upload className="w-4 h-4" />
              {importing && (
                <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-primary/20 rounded-b-lg">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-b-lg"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              )}
            </Button>

            <Button
              onClick={onAddBookClick}
              className="h-9 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span className="text-sm">添加</span>
            </Button>
          </div>
        </div>

        {/* Search Result & Active Filters Display */}
        {(searchInput || hasActiveFilters) && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
            {searchInput && (
              <span className="text-xs text-muted-foreground">
                找到 <strong className="text-primary">{resultCount}</strong> 本相关书籍
              </span>
            )}
            {hasActiveFilters && (
              <>
                <span className="text-xs text-muted-foreground">筛选:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedReadStatus !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                      {readStatusOptions.find(s => s.value === selectedReadStatus)?.label}
                      <button onClick={() => onReadStatusChange('all')} className="hover:bg-primary/20 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedAgeRange !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                      {ageRanges.find(a => a.value === selectedAgeRange)?.label}
                      <button onClick={() => onAgeRangeChange('all')} className="hover:bg-primary/20 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {sortBy && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                      {sortOptions.find(s => s.value === sortBy)?.label}
                      <button onClick={() => onSortChange('')} className="hover:bg-primary/20 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-primary hover:underline ml-auto"
                >
                  清除全部
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
