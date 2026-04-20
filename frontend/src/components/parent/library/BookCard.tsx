import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, MoreVertical, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Book } from '@/types/library';
import { bookTypes } from '@/types/library';

interface BookCardProps {
  book: Book;
  index: number;
  batchMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  onStartReading: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onBorrow: () => void;
  viewMode: 'grid' | 'list';
}

export function formatBookName(name: string): string {
  return name.replace(/《|》|【|】/g, '').trim();
}

export function BookCard({
  book,
  index,
  batchMode,
  isSelected,
  onToggleSelection,
  onStartReading,
  onEdit,
  onDelete,
  onBorrow,
  viewMode,
}: BookCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const totalPages = book.totalPages || 0;
  const readPages = book.totalReadPages || 0;
  const progress = totalPages > 0 ? Math.round((readPages / totalPages) * 100) : 0;
  const lastReadLabel = book.lastReadDate
    ? new Date(book.lastReadDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
    : '暂无记录';

  let readStatus = '未开始';
  let statusColor = 'text-muted-foreground';
  let statusBg = 'bg-muted';

  if (book.readState?.status === 'finished') {
    readStatus = '已读完';
    statusColor = 'text-green-600';
    statusBg = 'bg-green-50';
  } else if (book.activeReadings?.length > 0) {
    readStatus = '在读中';
    statusColor = 'text-blue-600';
    statusBg = 'bg-blue-50';
  }

  const handleClick = () => {
    if (batchMode) {
      onToggleSelection();
    } else {
      navigate(`/parent/library/${book.id}`);
    }
  };

  const renderCover = () => (
    <div className="relative w-full h-full bg-muted">
      {book.coverUrl && !imageError ? (
        <>
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={book.coverUrl}
            alt={formatBookName(book.name)}
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              imageLoading ? "opacity-0" : "opacity-100"
            )}
            loading="lazy"
            onError={() => setImageError(true)}
            onLoad={() => setImageLoading(false)}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/50" />
        </div>
      )}
      {book.characterTag && (
        <div className="absolute top-2 right-2">
          <Badge className="text-xs bg-primary text-white px-2 py-0.5 rounded shadow-sm">
            {book.characterTag}
          </Badge>
        </div>
      )}
      {progress > 0 && progress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.3) }}
        className="group relative"
      >
        {batchMode && (
          <div
            className="absolute top-4 left-4 z-20"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection();
            }}
          >
            <div className={cn(
              "w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
              isSelected
                ? "bg-primary border-primary"
                : "bg-white border-border hover:border-primary"
            )}>
              {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
            </div>
          </div>
        )}

        <Card className="border border-border shadow-sm rounded-lg overflow-hidden hover:shadow-md transition-all duration-300">
          <div className="flex">
            <div
              className="w-24 h-32 relative cursor-pointer flex-shrink-0"
              onClick={handleClick}
            >
              {renderCover()}
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <CardContent className="p-4 flex-1">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground text-lg truncate">
                      {formatBookName(book.name)}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {book.author || '未知作者'}{book.publisher ? ` / ${book.publisher}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {book.totalPages > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {book.totalPages}页
                        </Badge>
                      )}
                      {book.suitableAge && (
                        <Badge variant="secondary" className="text-xs">
                          {book.suitableAge}
                        </Badge>
                      )}
                      <Badge className={cn("text-xs", statusColor, statusBg)}>
                        {readStatus}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full md:w-48 flex-shrink-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">阅读进度</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>

              <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                <div className="flex gap-2">
                  {book.readState?.status === 'finished' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs bg-green-50 text-green-600 hover:bg-green-100"
                      disabled
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      已读完
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartReading();
                      }}
                      className="text-xs"
                    >
                      {book.activeReadings?.length > 0 ? '继续阅读' : '开始阅读'}
                    </Button>
                  )}
                </div>
                {!batchMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={onEdit}>编辑信息</DropdownMenuItem>
                      <DropdownMenuItem onClick={onBorrow}>借出</DropdownMenuItem>
                      <DropdownMenuItem onClick={onDelete} className="text-destructive">
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  // Grid view
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="group relative"
    >
      {batchMode && (
        <div
          className="absolute top-2 left-2 z-20"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
        >
          <div className={cn(
            "w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
            isSelected
              ? "bg-primary border-primary"
              : "bg-white border-border hover:border-primary"
          )}>
            {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
          </div>
        </div>
      )}

      <Card className="border border-border shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col">
        <div className="flex flex-col h-full">
          <div
            className="aspect-[3/4] relative cursor-pointer"
            onClick={handleClick}
          >
            {renderCover()}
          </div>

          <div className="flex-1 flex flex-col p-3.5">
            <div className="flex-1">
              <h4 className="font-semibold text-foreground text-sm line-clamp-2 min-h-[2.5rem]">
                {formatBookName(book.name)}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {book.author || '未知作者'}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {bookTypes.find(t => t.value === book.type)?.label || '其他'}
                </Badge>
                <Badge className={cn("text-xs px-1.5 py-0", statusColor, statusBg)}>
                  {readStatus}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-muted-foreground">已读页数</p>
                  <p className="mt-1 font-semibold text-foreground">{readPages}/{totalPages || '--'}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-muted-foreground">最近阅读</p>
                  <p className="mt-1 font-semibold text-foreground">{lastReadLabel}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">进度</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                {book.readState?.status === 'finished' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs bg-green-50 text-green-600 hover:bg-green-100 w-full rounded-lg"
                    disabled
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    已读完
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartReading();
                    }}
                    className="text-xs w-full rounded-lg"
                  >
                    {book.activeReadings?.length > 0 ? '继续' : '开始'}
                  </Button>
                )}
                {!batchMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8 ml-2 rounded-lg">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={onEdit}>编辑</DropdownMenuItem>
                      <DropdownMenuItem onClick={onBorrow}>借出</DropdownMenuItem>
                      <DropdownMenuItem onClick={onDelete} className="text-destructive">
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
