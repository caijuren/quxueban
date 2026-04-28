import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Book } from '@/types/library';

interface BookCardProps {
  book: Book;
  index: number;
  onDelete?: (book: Book) => void;
  selected?: boolean;
  onSelectChange?: (book: Book, selected: boolean) => void;
}

export function formatBookName(name: string): string {
  return name.replace(/《|》|【|】/g, '').trim();
}

export function BookCard({
  book,
  index,
  onDelete,
  selected = false,
  onSelectChange,
}: BookCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleClick = () => {
    navigate(`/parent/library/${book.id}`);
  };

  const progress = book.totalPages > 0 ? Math.min(100, Math.round(((book.totalReadPages || 0) / book.totalPages) * 100)) : 0;
  const isFinished = book.readState?.status === 'finished';
  const statusMeta = isFinished
    ? { label: '已读完', className: 'bg-emerald-100 text-emerald-700', detail: '已读完' }
    : { label: '在读中', className: 'bg-blue-100 text-blue-700', detail: '阅读中' };

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
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="group relative"
    >
      <Card className={cn(
        'group/card flex h-full flex-col overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border/70'
      )}>
        {onSelectChange ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectChange(book, !selected);
            }}
            className={cn(
              'absolute left-5 top-5 z-20 flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-white/80 bg-white/90 text-slate-400 hover:bg-primary/10 hover:text-primary'
            )}
            aria-label={selected ? '取消选择图书' : '选择图书'}
          >
            {selected ? <Check className="h-4 w-4" /> : <span className="h-3.5 w-3.5 rounded border border-current" />}
          </button>
        ) : null}
        <button type="button" onClick={handleClick} className="flex h-full flex-col text-left">
          <div className="relative rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
            <span className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <div className="mx-auto aspect-[3/4] w-[68%] overflow-hidden rounded-md bg-slate-100 shadow-lg shadow-slate-200">
              {renderCover()}
            </div>
          </div>

          <div className="flex flex-1 flex-col pt-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-base font-semibold leading-6 text-foreground line-clamp-2">
                {formatBookName(book.name)}
              </h4>
              <p className="mt-1 truncate text-sm text-muted-foreground">{book.author || '未知作者'}</p>
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {isFinished ? '已读完' : `阅读中 · ${progress}%`}
                </p>
              </div>
            </div>
          </div>
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(book);
            }}
            className="absolute right-5 top-5 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-white/80 bg-white/90 text-slate-400 opacity-100 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover/card:opacity-100"
            aria-label="删除图书"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </Card>
    </motion.div>
  );
}
